import type { SupabaseClient } from '@supabase/supabase-js';
import { TOOL_DEFINITIONS, ToolInputError, isToolName, runTool } from './tools';

/**
 * A stand-in for the Supabase query builder: every filter method returns the
 * builder, and awaiting it resolves to the rows registered for that table.
 */
function fakeDb(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const result = { data: tables[table] ?? [], error: null, count: null };
      const builder: Record<string, unknown> = {
        then: (resolve: (v: typeof result) => unknown) => resolve(result),
      };
      for (const m of [
        'select',
        'order',
        'eq',
        'in',
        'gte',
        'lte',
        'ilike',
        'limit',
      ]) {
        builder[m] = () => builder;
      }
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('chat tools', () => {
  it('defines every tool it can run, and nothing else', () => {
    for (const t of TOOL_DEFINITIONS) expect(isToolName(t.name)).toBe(true);
  });

  it('rejects an unknown tool as a recoverable input error', async () => {
    await expect(runTool(fakeDb({}), 'drop_tables', {})).rejects.toBeInstanceOf(
      ToolInputError,
    );
  });

  it('rejects malformed dates and unexpected fields', async () => {
    await expect(
      runTool(fakeDb({}), 'get_financial_summary', { from: 'March' }),
    ).rejects.toThrow(/from: Use YYYY-MM-DD/);
    await expect(
      runTool(fakeDb({}), 'get_savings_goals', { user_id: 'someone-else' }),
    ).rejects.toBeInstanceOf(ToolInputError);
  });

  it('caps transaction search at 50 rows', async () => {
    await expect(
      runTool(fakeDb({}), 'search_transactions', { limit: 500 }),
    ).rejects.toThrow(/limit/);
  });

  it('lists the real categories when a category name does not match', async () => {
    const db = fakeDb({ categories: [] });
    await expect(
      runTool(db, 'search_transactions', { category: 'Fod' }),
    ).rejects.toThrow(/No category matches "Fod"/);
  });

  it('summarizes a loan from its schedule', async () => {
    const db = fakeDb({
      loans: [
        {
          id: 'L1',
          name: 'Bike',
          principal: 100000,
          annual_rate: 10,
          emi_amount: 35000,
          start_date: '2026-01-05',
        },
      ],
      loan_schedule: [
        {
          loan_id: 'L1',
          due_date: '2026-02-05',
          emi: 35000,
          balance: 66000,
          paid: true,
        },
        {
          loan_id: 'L1',
          due_date: '2026-03-05',
          emi: 35000,
          balance: 33000,
          paid: false,
        },
        {
          loan_id: 'L1',
          due_date: '2026-04-05',
          emi: 35000,
          balance: 0,
          paid: false,
        },
      ],
    });
    const [loan] = (await runTool(db, 'get_loans', {})) as Record<
      string,
      unknown
    >[];
    expect(loan).toMatchObject({
      name: 'Bike',
      installments_total: 3,
      installments_paid: 1,
      outstanding_balance: 66000,
      next_installment: { due_date: '2026-03-05', emi: 35000 },
    });
    expect(loan).not.toHaveProperty('id');
  });
});
