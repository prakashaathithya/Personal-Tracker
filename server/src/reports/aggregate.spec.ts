import {
  buildMatrix,
  groupByCategory,
  groupByNeedClass,
  groupByPaymentType,
  monthlySeries,
  summarize,
  type TxnRow,
} from './aggregate';

function txn(over: Partial<TxnRow> = {}): TxnRow {
  return {
    amount: 100,
    planned: false,
    direction: 'expense',
    txn_date: '2026-03-15',
    category: { name: 'Food', need_class: 'Wants' },
    payment_type: { name: 'UPI' },
    ...over,
  };
}

describe('summarize', () => {
  it('totals income and expense and nets them off', () => {
    const s = summarize([
      txn({ direction: 'income', amount: 50000 }),
      txn({ amount: 1200 }),
      txn({ amount: 800 }),
    ]);

    expect(s.income).toBe(50000);
    expect(s.expense).toBe(2000);
    expect(s.net).toBe(48000);
    expect(s.total).toBe(2000);
    expect(s.count).toBe(2);
  });

  it('excludes transfers from every total', () => {
    const s = summarize([
      txn({ amount: 500 }),
      txn({ direction: 'transfer', amount: 20000 }),
    ]);

    expect(s.expense).toBe(500);
    expect(s.income).toBe(0);
    expect(s.count).toBe(1);
  });

  it('splits expenses into planned and unplanned', () => {
    const s = summarize([
      txn({ amount: 3000, planned: true }),
      txn({ amount: 250 }),
      // An income row is never counted in the planned split.
      txn({ direction: 'income', amount: 9000, planned: true }),
    ]);

    expect(s.planned).toBe(3000);
    expect(s.unplanned).toBe(250);
    expect(s.planned + s.unplanned).toBe(s.expense);
  });

  it('returns zeroes for an empty range', () => {
    expect(summarize([])).toEqual({
      income: 0,
      expense: 0,
      net: 0,
      total: 0,
      planned: 0,
      unplanned: 0,
      count: 0,
    });
  });

  it('coerces amounts that arrive as numeric strings', () => {
    // Postgres numeric comes back as a string over the wire.
    const s = summarize([txn({ amount: '1200.50' as unknown as number })]);

    expect(s.expense).toBe(1200.5);
  });
});

describe('groupByCategory', () => {
  it('rolls up per category, biggest total first', () => {
    const out = groupByCategory([
      txn({ amount: 100, category: { name: 'Food', need_class: 'Wants' } }),
      txn({ amount: 900, category: { name: 'Rent', need_class: 'Needs' } }),
      txn({ amount: 200, category: { name: 'Food', need_class: 'Wants' } }),
    ]);

    expect(out.map((c) => c.category)).toEqual(['Rent', 'Food']);
    expect(out[1]).toEqual({
      category: 'Food',
      need_class: 'Wants',
      total: 300,
      count: 2,
      planned: 0,
      unplanned: 300,
    });
  });

  it('buckets rows with no category under Uncategorized/Others', () => {
    const out = groupByCategory([txn({ category: null })]);

    expect(out[0].category).toBe('Uncategorized');
    expect(out[0].need_class).toBe('Others');
  });

  it('ignores income and transfers', () => {
    const out = groupByCategory([
      txn({ direction: 'income', amount: 50000 }),
      txn({ direction: 'transfer', amount: 5000 }),
    ]);

    expect(out).toEqual([]);
  });
});

describe('groupByPaymentType', () => {
  it('rolls up per payment type, biggest total first', () => {
    const out = groupByPaymentType([
      txn({ amount: 100, payment_type: { name: 'UPI' } }),
      txn({ amount: 700, payment_type: { name: 'Credit Card' } }),
      txn({ amount: 100, payment_type: { name: 'UPI' } }),
    ]);

    expect(out).toEqual([
      { payment_type: 'Credit Card', total: 700, count: 1 },
      { payment_type: 'UPI', total: 200, count: 2 },
    ]);
  });

  it('buckets rows with no payment type under Unspecified', () => {
    const out = groupByPaymentType([txn({ payment_type: null })]);

    expect(out[0].payment_type).toBe('Unspecified');
  });
});

describe('groupByNeedClass', () => {
  it('sums expenses per need class', () => {
    const out = groupByNeedClass([
      txn({ amount: 900, category: { name: 'Rent', need_class: 'Needs' } }),
      txn({ amount: 100, category: { name: 'Food', need_class: 'Wants' } }),
      txn({ amount: 50, category: { name: 'Snacks', need_class: 'Wants' } }),
    ]);

    expect(out).toEqual([
      { need_class: 'Needs', total: 900 },
      { need_class: 'Wants', total: 150 },
    ]);
  });

  it('falls back to Others when the category is gone', () => {
    expect(groupByNeedClass([txn({ category: null, amount: 40 })])).toEqual([
      { need_class: 'Others', total: 40 },
    ]);
  });
});

describe('buildMatrix', () => {
  const rows = [
    txn({
      txn_date: '2026-01-05',
      amount: 100,
      category: { name: 'Food', need_class: 'Wants' },
    }),
    txn({
      txn_date: '2026-03-15',
      amount: 200,
      category: { name: 'Food', need_class: 'Wants' },
    }),
    txn({
      txn_date: '2026-03-20',
      amount: 900,
      category: { name: 'Rent', need_class: 'Needs' },
    }),
  ];

  it('always returns 12 month rows, ordered January to December', () => {
    const m = buildMatrix(rows, 2026, 'category');

    expect(m.rows.length).toBe(12);
    expect(m.rows.map((r) => r.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('orders columns by descending yearly total', () => {
    const m = buildMatrix(rows, 2026, 'category');

    expect(m.columns).toEqual(['Rent', 'Food']);
    expect(m.columnTotals).toEqual([900, 300]);
  });

  it('puts each amount in its own month cell', () => {
    const m = buildMatrix(rows, 2026, 'category');
    const [rent, food] = [0, 1];

    expect(m.rows[0].values[food]).toBe(100); // January
    expect(m.rows[0].values[rent]).toBe(0);
    expect(m.rows[2].values[food]).toBe(200); // March
    expect(m.rows[2].values[rent]).toBe(900);
    expect(m.rows[2].total).toBe(1100);
  });

  it('grand total equals the sum of the column totals', () => {
    const m = buildMatrix(rows, 2026, 'category');

    expect(m.grandTotal).toBe(1200);
    expect(m.grandTotal).toBe(m.columnTotals.reduce((a, b) => a + b, 0));
  });

  it('pivots by need class', () => {
    const m = buildMatrix(rows, 2026, 'need_class');

    expect(m.dim).toBe('need_class');
    expect(m.columns).toEqual(['Needs', 'Wants']);
    expect(m.columnTotals).toEqual([900, 300]);
  });

  it('pivots by payment type', () => {
    const m = buildMatrix(
      [
        txn({ txn_date: '2026-02-01', amount: 300, payment_type: null }),
        txn({
          txn_date: '2026-02-02',
          amount: 700,
          payment_type: { name: 'Credit Card' },
        }),
      ],
      2026,
      'payment_type',
    );

    expect(m.columns).toEqual(['Credit Card', 'Unspecified']);
    expect(m.rows[1].values).toEqual([700, 300]);
  });

  it('returns an empty pivot with no expense rows', () => {
    const m = buildMatrix([txn({ direction: 'income' })], 2026, 'category');

    expect(m.columns).toEqual([]);
    expect(m.grandTotal).toBe(0);
    expect(m.rows.every((r) => r.total === 0)).toBe(true);
  });
});

describe('monthlySeries', () => {
  it('reports income, expense and balance for every month', () => {
    const out = monthlySeries(
      [
        txn({ txn_date: '2026-01-31', direction: 'income', amount: 50000 }),
        txn({ txn_date: '2026-01-05', amount: 12000 }),
        txn({ txn_date: '2026-02-10', amount: 8000 }),
      ],
      2026,
    );

    expect(out.length).toBe(12);
    expect(out[0]).toEqual({
      year: 2026,
      month: 1,
      salary: 50000,
      usage: 12000,
      balance: 38000,
    });
    expect(out[1].balance).toBe(-8000);
    expect(out[11]).toEqual({
      year: 2026,
      month: 12,
      salary: 0,
      usage: 0,
      balance: 0,
    });
  });

  it('excludes transfers', () => {
    const out = monthlySeries(
      [txn({ txn_date: '2026-05-05', direction: 'transfer', amount: 25000 })],
      2026,
    );

    expect(out[4]).toEqual({
      year: 2026,
      month: 5,
      salary: 0,
      usage: 0,
      balance: 0,
    });
  });

  it('reads the month off the date string, not a parsed Date', () => {
    // A UTC-midnight date would shift a day back west of Greenwich; taking
    // the month from the string keeps December in December everywhere.
    const out = monthlySeries(
      [txn({ txn_date: '2026-12-01', amount: 500 })],
      2026,
    );

    expect(out[11].usage).toBe(500);
  });
});
