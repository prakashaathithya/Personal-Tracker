/**
 * Report aggregation. Every function here is pure — it takes the transaction
 * rows the controller fetched and returns the shape the API responds with —
 * so the rollup rules can be unit-tested without a database.
 *
 * Two rules run through all of them: transfers never count as income or
 * expense (money moving between the user's own accounts is not spend), and
 * months are read off the `YYYY-MM-DD` string rather than parsed as a Date,
 * so a report never drifts with the server's timezone.
 */

export type Direction = 'income' | 'expense' | 'transfer';

export interface TxnRow {
  amount: number;
  planned: boolean;
  direction: Direction;
  txn_date: string;
  category: { name: string; need_class: string } | null;
  payment_type: { name: string } | null;
}

/** Dimension a pivot matrix can be broken down by. */
export type MatrixDim = 'category' | 'payment_type' | 'need_class';

export interface Summary {
  income: number;
  expense: number;
  net: number;
  total: number;
  planned: number;
  unplanned: number;
  count: number;
}

export interface CategoryTotal {
  category: string;
  need_class: string;
  total: number;
  count: number;
  planned: number;
  unplanned: number;
}

export interface PaymentTypeTotal {
  payment_type: string;
  total: number;
  count: number;
}

export interface MatrixReport {
  year: number;
  dim: MatrixDim;
  columns: string[];
  rows: { month: number; values: number[]; total: number }[];
  columnTotals: number[];
  grandTotal: number;
}

export interface MonthlyRow {
  year: number;
  month: number;
  salary: number;
  usage: number;
  balance: number;
}

/**
 * Income / expense / net, plus the planned-vs-unplanned split of expenses.
 * `total` and `count` describe spend so existing "total spent" surfaces keep
 * working.
 */
export function summarize(rows: TxnRow[]): Summary {
  let income = 0;
  let expense = 0;
  let planned = 0;
  let unplanned = 0;
  let expenseCount = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.direction === 'income') {
      income += amt;
    } else if (r.direction === 'expense') {
      expense += amt;
      expenseCount += 1;
      if (r.planned) planned += amt;
      else unplanned += amt;
    }
    // transfers are excluded from income/expense totals
  }
  return {
    income,
    expense,
    net: income - expense,
    total: expense,
    planned,
    unplanned,
    count: expenseCount,
  };
}

/** Expense grouped by category, biggest first. */
export function groupByCategory(rows: TxnRow[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const r of rows) {
    if (r.direction !== 'expense') continue;
    const name = r.category?.name ?? 'Uncategorized';
    const entry = map.get(name) ?? {
      category: name,
      need_class: r.category?.need_class ?? 'Others',
      total: 0,
      count: 0,
      planned: 0,
      unplanned: 0,
    };
    const amt = Number(r.amount);
    entry.total += amt;
    entry.count += 1;
    if (r.planned) entry.planned += amt;
    else entry.unplanned += amt;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Expense grouped by payment type (Cash / UPI / Credit Card / EMI / …). */
export function groupByPaymentType(rows: TxnRow[]): PaymentTypeTotal[] {
  const map = new Map<string, PaymentTypeTotal>();
  for (const r of rows) {
    if (r.direction !== 'expense') continue;
    const name = r.payment_type?.name ?? 'Unspecified';
    const entry = map.get(name) ?? { payment_type: name, total: 0, count: 0 };
    entry.total += Number(r.amount);
    entry.count += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Needs / Wants / Saving / Others split of expenses. */
export function groupByNeedClass(
  rows: TxnRow[],
): { need_class: string; total: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.direction !== 'expense') continue;
    const key = r.category?.need_class ?? 'Others';
    map.set(key, (map.get(key) ?? 0) + Number(r.amount));
  }
  return [...map.entries()].map(([need_class, total]) => ({
    need_class,
    total,
  }));
}

/**
 * Month-by-dimension pivot for a year, mirroring the spreadsheet's
 * "Month x Type" and "Month x Payment Type" pivot tables. Columns are
 * ordered by descending yearly total so the biggest spend leads.
 */
export function buildMatrix(
  rows: TxnRow[],
  year: number,
  dim: MatrixDim,
): MatrixReport {
  const keyOf = (r: TxnRow) => {
    if (dim === 'payment_type') return r.payment_type?.name ?? 'Unspecified';
    if (dim === 'need_class') return r.category?.need_class ?? 'Others';
    return r.category?.name ?? 'Uncategorized';
  };

  // key -> 12 monthly totals
  const cells = new Map<string, number[]>();
  for (const r of rows) {
    if (r.direction !== 'expense') continue;
    const m = monthIndex(r.txn_date);
    if (m === null) continue;
    const key = keyOf(r);
    const months = cells.get(key) ?? new Array<number>(12).fill(0);
    months[m] += Number(r.amount);
    cells.set(key, months);
  }

  const columns = [...cells.keys()].sort(
    (a, b) => sum(cells.get(b)!) - sum(cells.get(a)!),
  );
  const matrix = Array.from({ length: 12 }, (_, m) => {
    const values = columns.map((c) => cells.get(c)![m]);
    return { month: m + 1, values, total: sum(values) };
  });

  return {
    year,
    dim,
    columns,
    rows: matrix,
    columnTotals: columns.map((c) => sum(cells.get(c)!)),
    grandTotal: sum(matrix.map((r) => r.total)),
  };
}

/**
 * Per-month income and expense for a year. `salary` carries income and
 * `usage` carries expense so existing dashboard charts keep working.
 */
export function monthlySeries(rows: TxnRow[], year: number): MonthlyRow[] {
  const incomeByMonth = new Array<number>(12).fill(0);
  const expenseByMonth = new Array<number>(12).fill(0);
  for (const r of rows) {
    const m = monthIndex(r.txn_date);
    if (m === null) continue;
    if (r.direction === 'income') incomeByMonth[m] += Number(r.amount);
    else if (r.direction === 'expense') expenseByMonth[m] += Number(r.amount);
  }

  return Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i + 1,
    salary: incomeByMonth[i],
    usage: expenseByMonth[i],
    balance: incomeByMonth[i] - expenseByMonth[i],
  }));
}

/** 0-based month of a 'YYYY-MM-DD' date, or null when it isn't 1-12. */
function monthIndex(iso: string): number | null {
  const m = Number(iso.slice(5, 7)) - 1;
  return m >= 0 && m <= 11 ? m : null;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
