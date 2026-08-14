import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';
import { buildSchedule } from '../loans/amortization';
import {
  emiFor,
  lastStatementDateOnOrBefore,
  round2,
  statementDateSeries,
  todayIso,
} from './cycle';
import { cardOutstanding, runCardCatchUp } from './generate';
import { CARD_EMBED, CreditCardRow, EmiPlanRow, StatementRow } from './types';

const TXN_EMBED =
  '*, category:categories(id,name,need_class), account:accounts!transactions_account_id_fkey(id,name,type)';

export class CreateCreditCardDto {
  @IsUUID() account_id!: string;
  @IsInt() @Min(1) @Max(31) statement_day!: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) due_days_after?: number;
  @IsOptional() @IsNumber() @Min(0) credit_limit?: number;
  @IsOptional() @IsUUID() default_payment_account_id?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) min_due_pct?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) utilisation_alert_pct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) reminder_days_before?: number;
}

export class UpdateCreditCardDto {
  @IsOptional() @IsInt() @Min(1) @Max(31) statement_day?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) due_days_after?: number;
  @IsOptional() @IsNumber() @Min(0) credit_limit?: number;
  @IsOptional() @IsUUID() default_payment_account_id?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) min_due_pct?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) utilisation_alert_pct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) reminder_days_before?: number;
}

export class UpdateStatementDto {
  @IsOptional() @IsNumber() @Min(0) total_amount?: number;
  @IsOptional() @IsNumber() @Min(0) minimum_due?: number;
}

export class PayStatementDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsUUID() from_account_id?: string;
  @IsOptional() @IsDateString() txn_date?: string;
}

export class CreateEmiPlanDto {
  @IsUUID() transaction_id!: string;
  @IsInt() @Min(1) @Max(120) tenure_months!: number;
  @IsOptional() @IsNumber() @Min(0) annual_rate?: number;
  /** Overrides the computed EMI when the bank quotes an exact figure. */
  @IsOptional() @IsNumber() @Min(0) emi_amount?: number;
  @IsOptional() @IsNumber() @Min(0) processing_fee?: number;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
}

@UseGuards(AuthGuard)
@Controller('credit-cards')
export class CreditCardsController {
  // ---------------------------------------------------------------- cards

  /**
   * Every configured card with what's owed on it right now, its utilisation
   * and the next bill waiting to be paid.
   */
  @Get()
  async list(@Db() db: SupabaseClient) {
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
  @Post()
  async create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateCreditCardDto,
  ) {
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
        .insert({ ...dto, user_id: user.id })
        .select(CARD_EMBED)
        .single(),
    );
  }

  // Fixed segments must be declared before ':accountId' or Nest routes
  // '/statements' into the parameterised handler.

  // ----------------------------------------------------------- statements

  @Get('statements')
  statements(
    @Db() db: SupabaseClient,
    @Query('card_account_id') cardId?: string,
    @Query('limit') limit?: string,
  ) {
    let q = db
      .from('card_statements')
      .select('*')
      .order('statement_date', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200));
    if (cardId) q = q.eq('card_account_id', cardId);
    return handle(q);
  }

  /** One bill, with the transactions and installments that make it up. */
  @Get('statements/:id')
  async statement(@Db() db: SupabaseClient, @Param('id') id: string) {
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
  @Patch('statements/:id')
  async updateStatement(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateStatementDto,
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
  @Post('statements/:id/pay')
  async pay(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: PayStatementDto,
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
          user_id: user.id,
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

  @Get('emi')
  emiPlans(
    @Db() db: SupabaseClient,
    @Query('card_account_id') cardId?: string,
  ) {
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
  @Post('emi')
  async createEmi(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateEmiPlanDto,
  ) {
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
          user_id: user.id,
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
          user_id: user.id,
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
  @Delete('emi/:id')
  async removeEmi(@Db() db: SupabaseClient, @Param('id') id: string) {
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
   * alerts. Called on app load; safe to run repeatedly.
   */
  @Post('run')
  run(@Db() db: SupabaseClient, @CurrentUser() user: User) {
    return runCardCatchUp(db, user.id);
  }

  // -------------------------------------------------- card config by id

  /**
   * Card purchases not yet on a bill and not already on a plan — exactly
   * the ones that can still be converted to EMI.
   */
  @Get(':accountId/unbilled')
  async unbilled(
    @Db() db: SupabaseClient,
    @Param('accountId') accountId: string,
  ) {
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

  @Patch(':accountId')
  update(
    @Db() db: SupabaseClient,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateCreditCardDto,
  ) {
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
  @Delete(':accountId')
  remove(@Db() db: SupabaseClient, @Param('accountId') accountId: string) {
    return handle(db.from('credit_cards').delete().eq('account_id', accountId));
  }
}

/** Keeps a bill's status in step with what's been paid against it. */
function statusFor(
  total: number,
  paid: number,
  fallback: StatementRow['status'],
): StatementRow['status'] {
  if (fallback === 'carried') return 'carried';
  if (total <= 0 || paid >= total) return 'paid';
  return paid > 0 ? 'partially_paid' : 'unpaid';
}
