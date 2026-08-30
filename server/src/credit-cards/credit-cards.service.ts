import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handle } from '../common/handle';
import { buildSchedule } from '../loans/amortization';
import {
  emiFor,
  lastStatementDateOnOrBefore,
  round2,
  statementDateSeries,
  todayIso,
} from './cycle';
import {
  CreateCreditCardDto,
  CreateEmiPlanDto,
  PayStatementDto,
  UpdateCreditCardDto,
  UpdateStatementDto,
} from './credit-cards.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { cardOutstanding, runCardCatchUp } from './generate';
import { statusFor } from './status';
import { CARD_EMBED, CreditCardRow, EmiPlanRow, StatementRow } from './types';

const TXN_EMBED =
  '*, category:categories(id,name,need_class), account:accounts!transactions_account_id_fkey(id,name,type)';

/** Lease name and lifetime for the statement catch-up (see job_locks). */
const CATCH_UP_JOB = 'card-catchup';
const CATCH_UP_TTL_SECONDS = 60;

/**
 * Everything the credit-card endpoints actually do. The RLS-scoped Supabase
 * client is passed in per call rather than injected, because it is built from
 * the caller's JWT on each request — see the `@Db()` decorator.
 */
@Injectable()
export class CreditCardsService {
  // ---------------------------------------------------------------- cards

  /**
   * Every configured card with what's owed on it right now, its utilisation
   * and the next bill waiting to be paid.
   */
  async list(db: SupabaseClient) {
    const cards =
      (await handle<CreditCardRow[]>(
        db.from('credit_cards').select(CARD_EMBED),
      )) ?? [];
    if (!cards.length) return [];

    const ids = cards.map((c) => c.account_id);
    const outstanding = await cardOutstanding(db, ids);
    const open =
      (await handle<StatementRow[]>(
        db
          .from('card_statements')
          .select('*')
          .in('card_account_id', ids)
          .in('status', ['unpaid', 'partially_paid'])
          .order('due_date'),
      )) ?? [];

    return cards.map((card) => {
      const used = outstanding.get(card.account_id) ?? 0;
      const limit = Number(card.credit_limit);
      const bills = open.filter((s) => s.card_account_id === card.account_id);
      const dueTotal = round2(
        bills.reduce(
          (sum, s) => sum + (Number(s.total_amount) - Number(s.paid_amount)),
          0,
        ),
      );
      return {
        ...card,
        outstanding: used,
        available: limit > 0 ? round2(limit - used) : null,
        utilisation_pct: limit > 0 ? Math.round((used / limit) * 100) : null,
        open_statements: bills,
        due_total: dueTotal,
        next_due_date: bills[0]?.due_date ?? null,
      };
    });
  }

  /** Turns an existing credit_card account into a billed card. */
  async create(db: SupabaseClient, userId: string, dto: CreateCreditCardDto) {
    const account = await handle<{ id: string; type: string }>(
      db.from('accounts').select('id, type').eq('id', dto.account_id).single(),
    );
    if (account.type !== 'credit_card') {
      throw new BadRequestException(
        'Billing can only be set up on a credit card account.',
      );
    }
    return handle(
      db
        .from('credit_cards')
        .insert({ ...dto, user_id: userId })
        .select(CARD_EMBED)
        .single(),
    );
  }

  update(db: SupabaseClient, accountId: string, dto: UpdateCreditCardDto) {
    return handle(
      db
        .from('credit_cards')
        .update(dto)
        .eq('account_id', accountId)
        .select(CARD_EMBED)
        .single(),
    );
  }

  /** Stops billing the card. Its statements and history are kept. */
  remove(db: SupabaseClient, accountId: string) {
    return handle(db.from('credit_cards').delete().eq('account_id', accountId));
  }

  /**
   * Card purchases not yet on a bill and not already on a plan — exactly
   * the ones that can still be converted to EMI.
   */
  async unbilled(db: SupabaseClient, accountId: string) {
    const plans = await handle<{ transaction_id: string | null }[]>(
      db
        .from('card_emi_plans')
        .select('transaction_id')
        .eq('card_account_id', accountId),
    );
    const converted = (plans ?? [])
      .map((p) => p.transaction_id)
      .filter((id): id is string => !!id);

    let q = db
      .from('transactions')
      .select(TXN_EMBED)
      .eq('account_id', accountId)
      .eq('direction', 'expense')
      .is('statement_id', null)
      .order('txn_date', { ascending: false })
      .limit(100);
    if (converted.length) q = q.not('id', 'in', `(${converted.join(',')})`);
    return handle(q);
  }

  // ----------------------------------------------------------- statements

  statements(db: SupabaseClient, cardId?: string, limit?: string) {
    let q = db
      .from('card_statements')
      .select('*')
      .order('statement_date', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200));
    if (cardId) q = q.eq('card_account_id', cardId);
    return handle(q);
  }

  /** One bill, with the transactions and installments that make it up. */
  async statement(db: SupabaseClient, id: string) {
    const statement = await handle<StatementRow>(
      db.from('card_statements').select('*').eq('id', id).single(),
    );
    const transactions = await handle(
      db
        .from('transactions')
        .select(TXN_EMBED)
        .eq('statement_id', id)
        .order('txn_date'),
    );
    const installments = await handle(
      db
        .from('card_emi_installments')
        .select('*, plan:card_emi_plans(id,description,tenure_months)')
        .eq('statement_id', id)
        .order('due_date'),
    );
    return { ...statement, transactions, installments };
  }

  /** Correct the bill to match what the bank actually charged. */
  async updateStatement(
    db: SupabaseClient,
    id: string,
    dto: UpdateStatementDto,
  ) {
    const current = await handle<StatementRow>(
      db.from('card_statements').select('*').eq('id', id).single(),
    );
    const total = dto.total_amount ?? Number(current.total_amount);
    const paid = Number(current.paid_amount);
    return handle(
      db
        .from('card_statements')
        .update({
          ...dto,
          status: statusFor(total, paid, current.status),
        })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  /**
   * Settles a bill (fully or in part) as a bank → card transfer, which is
   * the point the money finally leaves the bank account.
   */
  async pay(
    db: SupabaseClient,
    userId: string,
    id: string,
    dto: PayStatementDto,
  ) {
    const statement = await handle<StatementRow>(
      db.from('card_statements').select('*').eq('id', id).single(),
    );
    const card = await handle<CreditCardRow>(
      db
        .from('credit_cards')
        .select(CARD_EMBED)
        .eq('account_id', statement.card_account_id)
        .single(),
    );

    const from = dto.from_account_id ?? card.default_payment_account_id;
    if (!from) {
      throw new BadRequestException(
        'No bank account to pay from — pick one, or set a default on the card.',
      );
    }
    if (from === statement.card_account_id) {
      throw new BadRequestException('A card cannot pay its own bill.');
    }

    const amount = round2(dto.amount);
    const txn = await handle(
      db
        .from('transactions')
        .insert({
          user_id: userId,
          txn_date: dto.txn_date ?? todayIso(),
          description: `Credit card payment — ${card.account?.name ?? 'card'}`,
          amount,
          direction: 'transfer',
          account_id: from,
          transfer_account_id: statement.card_account_id,
          statement_id: statement.id,
        })
        .select(TXN_EMBED)
        .single(),
    );

    const paid = round2(Number(statement.paid_amount) + amount);
    const updated = await handle<StatementRow>(
      db
        .from('card_statements')
        .update({
          paid_amount: paid,
          status: statusFor(Number(statement.total_amount), paid, 'unpaid'),
        })
        .eq('id', id)
        .select()
        .single(),
    );

    // Clear the reminders for a bill that's now settled.
    if (updated.status === 'paid') {
      await handle(
        db
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('entity_id', id)
          .is('read_at', null),
      );
    }

    return { statement: updated, transaction: txn };
  }

  // ------------------------------------------------------------------ EMI

  emiPlans(db: SupabaseClient, cardId?: string) {
    let q = db
      .from('card_emi_plans')
      .select('*, installments:card_emi_installments(*)')
      .order('created_at', { ascending: false });
    if (cardId) q = q.eq('card_account_id', cardId);
    return handle(q);
  }

  /**
   * Converts a card purchase into installments. The original transaction
   * stays put — you still owe the whole amount, so the card balance stays
   * honest — but it drops out of the statement in favour of the schedule.
   */
  async createEmi(db: SupabaseClient, userId: string, dto: CreateEmiPlanDto) {
    const txn = await handle<{
      id: string;
      description: string;
      amount: number;
      direction: string;
      account_id: string | null;
      category_id: string | null;
      txn_date: string;
      statement_id: string | null;
    }>(
      db
        .from('transactions')
        .select(
          'id, description, amount, direction, account_id, category_id, txn_date, statement_id',
        )
        .eq('id', dto.transaction_id)
        .single(),
    );

    if (txn.direction !== 'expense' || !txn.account_id) {
      throw new BadRequestException('Only a card purchase can be put on EMI.');
    }
    if (txn.statement_id) {
      throw new BadRequestException(
        'That purchase is already on a generated bill — EMI can only be set up before it is billed.',
      );
    }

    const card = await handle<CreditCardRow>(
      db
        .from('credit_cards')
        .select('*')
        .eq('account_id', txn.account_id)
        .single(),
    );

    const existing = await handle<{ id: string }[]>(
      db.from('card_emi_plans').select('id').eq('transaction_id', txn.id),
    );
    if (existing?.length) {
      throw new BadRequestException('That purchase is already on EMI.');
    }

    const principal = round2(Number(txn.amount));
    const rate = Number(dto.annual_rate ?? 0);
    const emi = round2(
      dto.emi_amount ?? emiFor(principal, rate, dto.tenure_months),
    );

    // Installments are billed on statement dates, so they land on the bill
    // rather than floating on their own monthly anniversary.
    const lastStmt = await handle<StatementRow | null>(
      db
        .from('card_statements')
        .select('statement_date')
        .eq('card_account_id', card.account_id)
        .order('statement_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const anchor =
      lastStmt?.statement_date ??
      lastStatementDateOnOrBefore(todayIso(), card.statement_day);
    const dueDates = statementDateSeries(
      anchor,
      card.statement_day,
      dto.tenure_months,
    );

    const schedule = buildSchedule({
      principal,
      annualRate: rate,
      emi,
      startDate: dueDates[0],
      maxPeriods: dto.tenure_months,
    });
    if (!schedule.length) {
      throw new BadRequestException(
        'That EMI is too small to ever clear the purchase — raise the amount or shorten the tenure.',
      );
    }

    const plan = await handle<EmiPlanRow>(
      db
        .from('card_emi_plans')
        .insert({
          user_id: userId,
          card_account_id: card.account_id,
          transaction_id: txn.id,
          category_id: txn.category_id,
          description: dto.description ?? txn.description,
          principal,
          annual_rate: rate,
          tenure_months: schedule.length,
          emi_amount: emi,
          processing_fee: dto.processing_fee ?? 0,
          start_date: dueDates[0],
        })
        .select()
        .single(),
    );

    await handle(
      db.from('card_emi_installments').insert(
        schedule.map((row, i) => ({
          plan_id: plan.id,
          period: row.period,
          due_date: dueDates[i] ?? row.due_date,
          emi: row.emi,
          interest: row.interest,
          principal_paid: row.principal_paid,
          balance: row.balance,
        })),
      ),
    );

    // A processing fee is charged straight away, so it belongs on the very
    // next bill like any other card spend.
    if (dto.processing_fee && dto.processing_fee > 0) {
      await handle(
        db.from('transactions').insert({
          user_id: userId,
          txn_date: txn.txn_date,
          description: `EMI processing fee — ${plan.description}`,
          amount: round2(dto.processing_fee),
          direction: 'expense',
          account_id: card.account_id,
          category_id: txn.category_id,
        }),
      );
    }

    return handle(
      db
        .from('card_emi_plans')
        .select('*, installments:card_emi_installments(*)')
        .eq('id', plan.id)
        .single(),
    );
  }

  /** Cancels a plan — only while none of it has been billed. */
  async removeEmi(db: SupabaseClient, id: string) {
    const { count } = await db
      .from('card_emi_installments')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)
      .eq('billed', true);
    if ((count ?? 0) > 0) {
      throw new BadRequestException(
        'Installments have already been billed, so this plan cannot be cancelled.',
      );
    }
    return handle(db.from('card_emi_plans').delete().eq('id', id));
  }

  // ------------------------------------------------------------- catch-up

  /**
   * Generates any statements whose date has passed and raises the matching
   * alerts. Safe to run repeatedly.
   *
   * Guarded by a short lease: the client fires this on every app load, so two
   * open tabs would otherwise race and the loser would die on the duplicate
   * statement insert. A caller that doesn't get the lease returns `skipped`
   * rather than an error — whoever holds it is already doing the work.
   */
  async run(db: SupabaseClient, userId: string) {
    const acquired = await handle<boolean>(
      db.rpc('try_acquire_job_lock', {
        p_job: CATCH_UP_JOB,
        p_ttl_seconds: CATCH_UP_TTL_SECONDS,
      }),
    );
    if (!acquired) {
      return { statements: 0, notifications: 0, skipped: true };
    }

    try {
      const result = await runCardCatchUp(db, userId);
      return { ...result, skipped: false };
    } finally {
      // Let the next load run immediately instead of waiting out the TTL.
      // If this never lands the lease still expires on its own.
      await db.rpc('release_job_lock', { p_job: CATCH_UP_JOB });
    }
  }

  /**
   * The nightly pass: runs the same catch-up for every user who owns a card,
   * so bills and reminders appear whether or not anyone opened the app.
   *
   * Each user's work runs under a client acting as that user, so RLS scopes
   * it exactly as an in-app run. One user's failure is recorded and the rest
   * still run.
   */
  async runForAllUsers(supabase: SupabaseService) {
    const admin = supabase.adminClient();
    const owners =
      (await handle<{ user_id: string }[]>(
        admin.from('credit_cards').select('user_id'),
      )) ?? [];
    const userIds = [...new Set(owners.map((o) => o.user_id))];

    let statements = 0;
    let notifications = 0;
    const failed: { user_id: string; reason: string }[] = [];

    for (const userId of userIds) {
      try {
        const result = await this.run(supabase.clientForUser(userId), userId);
        statements += result.statements;
        notifications += result.notifications;
      } catch (err) {
        // Reported rather than thrown: one user's bad data must not stop the
        // rest of the run. The reason is carried out so a failure is
        // diagnosable from the scheduler's log — in particular a rejected
        // minted token, which means the project no longer accepts the legacy
        // HS256 secret.
        failed.push({ user_id: userId, reason: reasonOf(err) });
      }
    }

    return { users: userIds.length, statements, notifications, failed };
  }
}

/** Best-effort message for whatever a per-user run threw. */
function reasonOf(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return err instanceof Error ? err.message : String(err);
}
