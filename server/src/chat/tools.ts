import type Anthropic from '@anthropic-ai/sdk';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  groupByCategory,
  groupByNeedClass,
  groupByPaymentType,
  monthlySeries,
  summarize,
  type TxnRow,
} from '../reports/aggregate';
import { AccountsController } from '../accounts/accounts.controller';

/**
 * The assistant's tools. Every one of them is read-only and runs through the
 * caller's RLS-scoped Supabase client, so the model can only ever see the rows
 * the signed-in user could already see in the app. Nothing here writes.
 *
 * This is retrieval for structured data: instead of embedding transactions
 * into a vector index, the model asks for exactly the rollup it needs and the
 * numbers come from the same aggregation code the dashboard uses. That keeps
 * totals exact, which similarity search over rows cannot do.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const range = {
  from: isoDate.optional(),
  to: isoDate.optional(),
};

const dateProps = {
  from: {
    type: 'string',
    description: 'Inclusive start date, YYYY-MM-DD. Omit for no lower bound.',
  },
  to: {
    type: 'string',
    description: 'Inclusive end date, YYYY-MM-DD. Omit for no upper bound.',
  },
} as const;

/** Most transactions a single search returns, so one call can't flood the context. */
const SEARCH_LIMIT_MAX = 50;

const schemas = {
  get_financial_summary: z.object(range).strict(),
  get_spending_breakdown: z
    .object({
      ...range,
      by: z.enum(['category', 'payment_type', 'need_class']),
    })
    .strict(),
  get_monthly_trend: z
    .object({ year: z.number().int().min(2000).max(2100) })
    .strict(),
  search_transactions: z
    .object({
      ...range,
      text: z.string().max(100).optional(),
      category: z.string().max(60).optional(),
      direction: z.enum(['income', 'expense', 'transfer']).optional(),
      min_amount: z.number().nonnegative().optional(),
      max_amount: z.number().nonnegative().optional(),
      limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional(),
    })
    .strict(),
  get_account_balances: z.object({}).strict(),
  get_credit_card_bills: z.object({}).strict(),
  get_loans: z.object({}).strict(),
  get_savings_goals: z.object({}).strict(),
  get_budget_items: z.object({}).strict(),
};

export type ToolName = keyof typeof schemas;

const empty = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

/** Tool definitions sent to Claude. Order is fixed so the prompt cache stays warm. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_financial_summary',
    description:
      'Total income, total expense, net (income minus expense), and the planned vs unplanned split of expenses for a date range. Transfers between the user\'s own accounts are excluded. Use this for questions like "how much did I spend/earn/save in March".',
    input_schema: {
      type: 'object',
      properties: { ...dateProps },
      additionalProperties: false,
    },
  },
  {
    name: 'get_spending_breakdown',
    description:
      'Expenses for a date range grouped by category, payment type (Cash, UPI, Credit Card, ...), or need class (Needs / Wants / Saving / Others), sorted largest first. Use this for "where did my money go" or "how much on food".',
    input_schema: {
      type: 'object',
      properties: {
        ...dateProps,
        by: {
          type: 'string',
          enum: ['category', 'payment_type', 'need_class'],
        },
      },
      required: ['by'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_monthly_trend',
    description:
      'Income ("salary"), expense ("usage") and the balance left for each month of a year. Use this to compare months or spot trends.',
    input_schema: {
      type: 'object',
      properties: { year: { type: 'integer', description: 'e.g. 2026' } },
      required: ['year'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_transactions',
    description: `Find individual transactions, newest first. All filters are optional and combine with AND. "text" matches the description (case-insensitive substring), "category" matches the category name. Returns at most ${SEARCH_LIMIT_MAX} rows plus the total matching count; for totals over many rows prefer get_financial_summary or get_spending_breakdown.`,
    input_schema: {
      type: 'object',
      properties: {
        ...dateProps,
        text: { type: 'string', description: 'Substring of the description' },
        category: { type: 'string', description: 'Category name' },
        direction: {
          type: 'string',
          enum: ['income', 'expense', 'transfer'],
        },
        min_amount: { type: 'number' },
        max_amount: { type: 'number' },
        limit: {
          type: 'integer',
          description: `Rows to return, 1-${SEARCH_LIMIT_MAX}. Default 20.`,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_account_balances',
    description:
      'Every account (bank, cash, wallet, credit card, investment) with its current balance, plus overall net worth. Credit card balances are negative when money is owed.',
    input_schema: empty,
  },
  {
    name: 'get_credit_card_bills',
    description:
      'Credit cards with their limit and statement settings, plus every statement that is not fully paid (amount, minimum due, paid so far, due date).',
    input_schema: empty,
  },
  {
    name: 'get_loans',
    description:
      'Loans with principal, rate and EMI, how many installments are paid, the outstanding balance, and the next unpaid installment.',
    input_schema: empty,
  },
  {
    name: 'get_savings_goals',
    description:
      'Savings goals with target amount, amount saved so far and target date.',
    input_schema: empty,
  },
  {
    name: 'get_budget_items',
    description:
      "The user's planned monthly budget lines (name, amount, note).",
    input_schema: empty,
  },
];

/** Error the model can read and recover from (bad dates, unknown category). */
export class ToolInputError extends Error {}

async function txnRows(
  db: SupabaseClient,
  from?: string,
  to?: string,
): Promise<TxnRow[]> {
  let q = db
    .from('transactions')
    .select(
      'amount, planned, direction, txn_date, category:categories(name,need_class), payment_type:payment_types(name)',
    );
  if (from) q = q.gte('txn_date', from);
  if (to) q = q.lte('txn_date', to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as TxnRow[];
}

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Escapes LIKE wildcards so user text is matched literally. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const runners: {
  [K in ToolName]: (
    db: SupabaseClient,
    input: z.infer<(typeof schemas)[K]>,
  ) => Promise<unknown>;
} = {
  async get_financial_summary(db, { from, to }) {
    const s = summarize(await txnRows(db, from, to));
    return { from: from ?? null, to: to ?? null, ...s };
  },

  async get_spending_breakdown(db, { from, to, by }) {
    const data = await txnRows(db, from, to);
    if (by === 'category') return groupByCategory(data);
    if (by === 'payment_type') return groupByPaymentType(data);
    return groupByNeedClass(data);
  },

  async get_monthly_trend(db, { year }) {
    const data = await txnRows(db, `${year}-01-01`, `${year}-12-31`);
    return monthlySeries(data, year);
  },

  async search_transactions(db, input) {
    let categoryIds: string[] | null = null;
    if (input.category) {
      const cats = await rows<{ id: string; name: string }>(
        db
          .from('categories')
          .select('id, name')
          .ilike('name', `%${likeLiteral(input.category)}%`),
      );
      if (cats.length === 0) {
        const all = await rows<{ name: string }>(
          db.from('categories').select('name').eq('is_active', true),
        );
        throw new ToolInputError(
          `No category matches "${input.category}". Categories: ${all.map((c) => c.name).join(', ')}`,
        );
      }
      categoryIds = cats.map((c) => c.id);
    }

    let q = db
      .from('transactions')
      .select(
        'txn_date, description, amount, direction, planned, category:categories(name), payment_type:payment_types(name), account:accounts!transactions_account_id_fkey(name)',
        { count: 'exact' },
      )
      .order('txn_date', { ascending: false })
      .limit(input.limit ?? 20);
    if (input.from) q = q.gte('txn_date', input.from);
    if (input.to) q = q.lte('txn_date', input.to);
    if (input.text) q = q.ilike('description', `%${likeLiteral(input.text)}%`);
    if (input.direction) q = q.eq('direction', input.direction);
    if (input.min_amount !== undefined) q = q.gte('amount', input.min_amount);
    if (input.max_amount !== undefined) q = q.lte('amount', input.max_amount);
    if (categoryIds) q = q.in('category_id', categoryIds);

    const { data, error, count } = await q;
    if (error) throw error;
    return { total_matching: count ?? 0, transactions: data ?? [] };
  },

  async get_account_balances(db) {
    // The balance rules (transfers move money, they are not spend) live in
    // the accounts controller; reuse them rather than keep a second copy.
    return new AccountsController().balances(db);
  },

  async get_credit_card_bills(db) {
    const cards = await rows(
      db
        .from('credit_cards')
        .select(
          'credit_limit, statement_day, due_days_after, min_due_pct, account:accounts!credit_cards_account_id_fkey(name)',
        ),
    );
    const open = await rows(
      db
        .from('card_statements')
        .select(
          'statement_date, due_date, total_amount, minimum_due, paid_amount, carried_over, status, card:accounts!card_statements_card_account_id_fkey(name)',
        )
        .in('status', ['unpaid', 'partially_paid'])
        .order('due_date'),
    );
    return { cards, open_statements: open };
  },

  async get_loans(db) {
    const loans = await rows<{
      id: string;
      name: string;
      principal: number;
      annual_rate: number | null;
      emi_amount: number | null;
      start_date: string | null;
    }>(
      db
        .from('loans')
        .select('id, name, principal, annual_rate, emi_amount, start_date'),
    );
    const schedule = await rows<{
      loan_id: string;
      due_date: string | null;
      emi: number;
      balance: number;
      paid: boolean;
    }>(
      db
        .from('loan_schedule')
        .select('loan_id, due_date, emi, balance, paid')
        .order('due_date'),
    );
    return loans.map(({ id, ...loan }) => {
      const mine = schedule.filter((r) => r.loan_id === id);
      const paid = mine.filter((r) => r.paid);
      const next = mine.find((r) => !r.paid) ?? null;
      return {
        ...loan,
        installments_total: mine.length,
        installments_paid: paid.length,
        outstanding_balance: paid.length
          ? Number(paid[paid.length - 1].balance)
          : Number(loan.principal),
        next_installment: next
          ? { due_date: next.due_date, emi: next.emi }
          : null,
      };
    });
  },

  async get_savings_goals(db) {
    return rows(
      db
        .from('savings_goals')
        .select('name, target_amount, current_amount, target_date'),
    );
  },

  async get_budget_items(db) {
    return rows(db.from('budget_items').select('name, amount, note'));
  },
};

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(schemas, name);
}

/**
 * Validates the model's input against the tool's schema, then runs it.
 * Throws ToolInputError for anything the model should fix and retry.
 */
export async function runTool(
  db: SupabaseClient,
  name: string,
  input: unknown,
): Promise<unknown> {
  if (!isToolName(name)) throw new ToolInputError(`Unknown tool "${name}"`);
  const parsed = schemas[name].safeParse(input ?? {});
  if (!parsed.success) {
    throw new ToolInputError(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`,
    );
  }
  const run = runners[name] as (
    db: SupabaseClient,
    input: unknown,
  ) => Promise<unknown>;
  return run(db, parsed.data);
}
