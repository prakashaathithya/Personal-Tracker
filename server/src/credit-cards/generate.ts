import type { SupabaseClient } from '@supabase/supabase-js';
import { handle } from '../common/handle';
import {
  addDays,
  daysBetween,
  lastStatementDateOnOrBefore,
  nextStatementDate,
  round2,
  todayIso,
} from './cycle';
import {
  CARD_EMBED,
  CreditCardRow,
  EmiInstallmentRow,
  EmiPlanRow,
  NotificationType,
  StatementRow,
} from './types';

interface SweepRow {
  id: string;
  amount: number;
  direction: 'income' | 'expense' | 'transfer';
  txn_date: string;
}

interface PendingNotification {
  type: NotificationType;
  title: string;
  body: string;
  entity_id: string;
  link: string;
  dedupe_key: string;
}

/** Safety net so a mis-set statement day can never spin forever. */
const MAX_CATCHUP_STATEMENTS = 60;

/**
 * Catch-up run: generates every statement whose date has passed but that
 * hasn't been created yet, then raises any due/overdue/limit alerts. Safe
 * to call on every app load — statements are unique per (card, date) and
 * notifications are deduped, so repeat runs are no-ops.
 */
export async function runCardCatchUp(
  db: SupabaseClient,
  userId: string,
): Promise<{ statements: number; notifications: number }> {
  const cards = await handle<CreditCardRow[]>(
    db.from('credit_cards').select(CARD_EMBED),
  );

  const pending: PendingNotification[] = [];
  let statements = 0;
  for (const card of cards ?? []) {
    statements += await generateForCard(db, card, pending);
  }

  await collectDueAlerts(db, cards ?? [], pending);
  await collectLimitAlerts(db, cards ?? [], pending);

  const notifications = await raise(db, userId, pending);
  return { statements, notifications };
}

/** Generates all of one card's outstanding statements, oldest first. */
async function generateForCard(
  db: SupabaseClient,
  card: CreditCardRow,
  pending: PendingNotification[],
): Promise<number> {
  const today = todayIso();

  let prev = await handle<StatementRow | null>(
    db
      .from('card_statements')
      .select('*')
      .eq('card_account_id', card.account_id)
      .order('statement_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  // With no history, start at the most recent cutoff that has already
  // passed — that first bill sweeps up everything spent to date.
  let cursor = prev
    ? nextStatementDate(prev.statement_date, card.statement_day)
    : lastStatementDateOnOrBefore(today, card.statement_day);

  let made = 0;
  for (let i = 0; cursor <= today && i < MAX_CATCHUP_STATEMENTS; i++) {
    const stmt = await generateStatement(db, card, cursor, prev);
    if (stmt) {
      made++;
      prev = stmt;
      if (Number(stmt.total_amount) > 0) {
        pending.push(billGenerated(card, stmt));
      }
    }
    cursor = nextStatementDate(cursor, card.statement_day);
  }
  return made;
}

/**
 * Builds one statement. Everything is totalled up front so a cycle with
 * nothing in it is skipped rather than leaving an empty bill behind.
 */
async function generateStatement(
  db: SupabaseClient,
  card: CreditCardRow,
  statementDate: string,
  prev: StatementRow | null,
): Promise<StatementRow | null> {
  // Purchases converted to EMI stay on the card (you still owe the whole
  // amount) but are billed as installments instead of in one hit.
  const plans = await handle<EmiPlanRow[]>(
    db
      .from('card_emi_plans')
      .select('*')
      .eq('card_account_id', card.account_id),
  );
  const convertedTxnIds = (plans ?? [])
    .map((p) => p.transaction_id)
    .filter((id): id is string => !!id);

  // Anything on the card not yet attached to a bill. Filtering on
  // `statement_id is null` rather than a date window means a back-dated
  // entry still gets picked up on the next cycle instead of vanishing.
  let sweepQuery = db
    .from('transactions')
    .select('id, amount, direction, txn_date')
    .eq('account_id', card.account_id)
    .is('statement_id', null)
    .in('direction', ['expense', 'income'])
    .lte('txn_date', statementDate);
  if (convertedTxnIds.length) {
    sweepQuery = sweepQuery.not('id', 'in', `(${convertedTxnIds.join(',')})`);
  }
  const swept = (await handle<SweepRow[]>(sweepQuery)) ?? [];

  // Expenses add to the bill; refunds credited back to the card reduce it.
  const spend = round2(
    swept.reduce(
      (sum, t) =>
        sum +
        (t.direction === 'expense' ? Number(t.amount) : -Number(t.amount)),
      0,
    ),
  );

  const planIds = (plans ?? []).map((p) => p.id);
  const dueInstallments = planIds.length
    ? ((await handle<EmiInstallmentRow[]>(
        db
          .from('card_emi_installments')
          .select('*')
          .in('plan_id', planIds)
          .eq('billed', false)
          .lte('due_date', statementDate)
          .order('due_date'),
      )) ?? [])
    : [];
  const emiTotal = round2(
    dueInstallments.reduce((sum, r) => sum + Number(r.emi), 0),
  );

  const carriedOver = prev
    ? Math.max(0, round2(Number(prev.total_amount) - Number(prev.paid_amount)))
    : 0;

  const total = round2(spend + emiTotal + carriedOver);

  // Nothing spent, nothing due, nothing owed — don't file an empty bill.
  if (!swept.length && !dueInstallments.length && carriedOver <= 0) {
    return null;
  }

  const periodStart = prev
    ? addDays(prev.statement_date, 1)
    : (swept.map((t) => t.txn_date).sort()[0] ?? statementDate);

  const stmt = await handle<StatementRow>(
    db
      .from('card_statements')
      .insert({
        user_id: card.user_id,
        card_account_id: card.account_id,
        period_start: periodStart,
        period_end: statementDate,
        statement_date: statementDate,
        due_date: addDays(statementDate, card.due_days_after),
        computed_amount: total,
        total_amount: total,
        minimum_due: minimumDue(total, card.min_due_pct),
        carried_over: carriedOver,
        status: total > 0 ? 'unpaid' : 'paid',
      })
      .select()
      .single(),
  );

  if (swept.length) {
    await handle(
      db
        .from('transactions')
        .update({ statement_id: stmt.id })
        .in(
          'id',
          swept.map((t) => t.id),
        ),
    );
  }

  if (dueInstallments.length) {
    await billInstallments(db, card, stmt, plans ?? [], dueInstallments);
  }

  // The rolled-over remainder now lives on the new bill; mark the old one
  // carried so open-bill totals don't count the same rupees twice.
  if (prev && carriedOver > 0) {
    await handle(
      db
        .from('card_statements')
        .update({ status: 'carried' })
        .eq('id', prev.id),
    );
  }

  return stmt;
}

/**
 * Attaches this cycle's installments to the bill and posts their interest
 * as a real card expense, so interest shows up in category reports rather
 * than hiding inside the statement total.
 */
async function billInstallments(
  db: SupabaseClient,
  card: CreditCardRow,
  stmt: StatementRow,
  plans: EmiPlanRow[],
  installments: EmiInstallmentRow[],
): Promise<void> {
  const planById = new Map(plans.map((p) => [p.id, p]));

  const interestTxns = installments
    .filter((r) => Number(r.interest) > 0)
    .map((r) => {
      const plan = planById.get(r.plan_id);
      return {
        user_id: card.user_id,
        txn_date: stmt.statement_date,
        description: `EMI interest ${r.period}/${plan?.tenure_months ?? '?'} — ${plan?.description ?? 'Card EMI'}`,
        amount: Number(r.interest),
        direction: 'expense' as const,
        account_id: card.account_id,
        category_id: plan?.category_id ?? null,
        statement_id: stmt.id,
      };
    });

  if (interestTxns.length) {
    await handle(db.from('transactions').insert(interestTxns));
  }

  await handle(
    db
      .from('card_emi_installments')
      .update({ billed: true, statement_id: stmt.id })
      .in(
        'id',
        installments.map((r) => r.id),
      ),
  );

  // A plan whose last installment has now been billed is finished.
  const touched = new Set(installments.map((r) => r.plan_id));
  for (const plan of plans) {
    if (!plan.is_active || !touched.has(plan.id)) continue;
    const { count } = await db
      .from('card_emi_installments')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id)
      .eq('billed', false);
    if ((count ?? 0) === 0) {
      await handle(
        db
          .from('card_emi_plans')
          .update({ is_active: false })
          .eq('id', plan.id),
      );
    }
  }
}

/** Reminder before the due date, and a nag once it has passed. */
async function collectDueAlerts(
  db: SupabaseClient,
  cards: CreditCardRow[],
  pending: PendingNotification[],
): Promise<void> {
  if (!cards.length) return;
  const today = todayIso();
  const byId = new Map(cards.map((c) => [c.account_id, c]));

  const open = await handle<StatementRow[]>(
    db
      .from('card_statements')
      .select('*')
      .in('status', ['unpaid', 'partially_paid'])
      .order('due_date'),
  );

  for (const s of open ?? []) {
    const card = byId.get(s.card_account_id);
    if (!card) continue;
    const outstanding = round2(Number(s.total_amount) - Number(s.paid_amount));
    if (outstanding <= 0) continue;
    const name = card.account?.name ?? 'Credit card';
    const daysLeft = daysBetween(today, s.due_date);

    if (daysLeft < 0) {
      pending.push({
        type: 'card_bill_overdue',
        title: `${name} bill overdue`,
        body: `${inr(outstanding)} was due on ${pretty(s.due_date)}.`,
        entity_id: s.id,
        link: '/credit-cards',
        dedupe_key: `stmt:${s.id}:overdue`,
      });
    } else if (daysLeft <= card.reminder_days_before) {
      pending.push({
        type: 'card_bill_due_soon',
        title: `${name} bill due ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}`,
        body: `${inr(outstanding)} due on ${pretty(s.due_date)}.`,
        entity_id: s.id,
        link: '/credit-cards',
        dedupe_key: `stmt:${s.id}:due_soon`,
      });
    }
  }
}

/** Warns once a month while utilisation sits above the card's threshold. */
async function collectLimitAlerts(
  db: SupabaseClient,
  cards: CreditCardRow[],
  pending: PendingNotification[],
): Promise<void> {
  const withLimit = cards.filter((c) => Number(c.credit_limit) > 0);
  if (!withLimit.length) return;

  const outstanding = await cardOutstanding(
    db,
    withLimit.map((c) => c.account_id),
  );
  const month = todayIso().slice(0, 7);

  for (const card of withLimit) {
    const used = outstanding.get(card.account_id) ?? 0;
    if (used <= 0) continue;
    const pct = Math.round((used / Number(card.credit_limit)) * 100);
    if (pct < card.utilisation_alert_pct) continue;
    pending.push({
      type: 'card_limit_warning',
      title: `${card.account?.name ?? 'Credit card'} at ${pct}% of its limit`,
      body: `${inr(used)} used of ${inr(Number(card.credit_limit))}.`,
      entity_id: card.account_id,
      link: '/credit-cards',
      dedupe_key: `card:${card.account_id}:limit:${month}`,
    });
  }
}

/**
 * How much is currently owed on each card — the mirror image of the card
 * account's balance, which goes negative as you spend.
 */
export async function cardOutstanding(
  db: SupabaseClient,
  cardIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!cardIds.length) return out;

  const accounts = await handle<{ id: string; opening_balance: number }[]>(
    db.from('accounts').select('id, opening_balance').in('id', cardIds),
  );
  const balance = new Map<string, number>();
  for (const a of accounts ?? []) balance.set(a.id, Number(a.opening_balance));

  const list = `(${cardIds.join(',')})`;
  const txns = await handle<
    {
      amount: number;
      direction: string;
      account_id: string | null;
      transfer_account_id: string | null;
    }[]
  >(
    db
      .from('transactions')
      .select('amount, direction, account_id, transfer_account_id')
      .or(`account_id.in.${list},transfer_account_id.in.${list}`),
  );

  const add = (id: string | null, delta: number) => {
    if (id && balance.has(id)) balance.set(id, balance.get(id)! + delta);
  };
  for (const t of txns ?? []) {
    const amt = Number(t.amount);
    if (t.direction === 'income') add(t.account_id, amt);
    else if (t.direction === 'expense') add(t.account_id, -amt);
    else {
      add(t.account_id, -amt);
      add(t.transfer_account_id, amt);
    }
  }

  for (const [id, bal] of balance) out.set(id, round2(Math.max(0, -bal)));
  return out;
}

function billGenerated(
  card: CreditCardRow,
  stmt: StatementRow,
): PendingNotification {
  const name = card.account?.name ?? 'Credit card';
  return {
    type: 'card_bill_generated',
    title: `${name} bill generated`,
    body: `${inr(Number(stmt.total_amount))} due on ${pretty(stmt.due_date)}.`,
    entity_id: stmt.id,
    link: '/credit-cards',
    dedupe_key: `stmt:${stmt.id}:generated`,
  };
}

/** Inserts alerts, letting the dedupe key drop ones already raised. */
async function raise(
  db: SupabaseClient,
  userId: string,
  pending: PendingNotification[],
): Promise<number> {
  if (!pending.length) return 0;
  const rows = pending.map((n) => ({ ...n, user_id: userId }));
  const inserted = await handle<{ id: string }[]>(
    db
      .from('notifications')
      .upsert(rows, {
        onConflict: 'user_id,dedupe_key',
        ignoreDuplicates: true,
      })
      .select('id'),
  );
  return inserted?.length ?? 0;
}

/** Card issuers bill a percentage of the total, with a small floor. */
export function minimumDue(total: number, pct: number): number {
  if (total <= 0) return 0;
  return round2(Math.max(Math.min(total, 200), (total * Number(pct)) / 100));
}

/** ₹ with Indian digit grouping (1,23,456) — no ICU dependency. */
export function inr(n: number): string {
  const value = Math.round(Math.abs(n));
  const s = String(value);
  const grouped =
    s.length <= 3
      ? s
      : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') +
        ',' +
        s.slice(-3);
  return `${n < 0 ? '-' : ''}₹${grouped}`;
}

function pretty(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
