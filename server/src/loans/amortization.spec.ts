import { buildSchedule } from './amortization';

describe('buildSchedule', () => {
  const loan = {
    principal: 100000,
    annualRate: 12, // 1% a month
    emi: 8884.88, // 12-month EMI for the above
    startDate: '2026-01-10',
  };

  it('pays the loan off and lands exactly on zero', () => {
    const rows = buildSchedule(loan);

    expect(rows.length).toBe(12);
    expect(rows[rows.length - 1].balance).toBe(0);
  });

  it('splits every instalment into interest on the opening balance and principal', () => {
    const rows = buildSchedule(loan);

    // First month: 1% of the full principal.
    expect(rows[0].interest).toBe(1000);
    expect(rows[0].principal_paid).toBe(7884.88);
    expect(rows[0].balance).toBe(92115.12);

    // Second month charges interest on what is left, so more of the same
    // EMI goes to principal.
    expect(rows[1].interest).toBe(921.15);
    expect(rows[1].principal_paid).toBe(7963.73);

    for (const r of rows) {
      expect(r.emi).toBeCloseTo(r.interest + r.principal_paid, 2);
    }
  });

  it('trims the final instalment instead of overpaying', () => {
    const rows = buildSchedule(loan);
    const last = rows[rows.length - 1];

    expect(last.emi).toBeLessThan(loan.emi);
    expect(last.principal_paid).toBe(
      Number(rows[rows.length - 2].balance.toFixed(2)),
    );
  });

  it('handles a zero-interest loan as a straight split', () => {
    const rows = buildSchedule({
      principal: 12000,
      annualRate: 0,
      emi: 1000,
      startDate: '2026-01-01',
    });

    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.interest === 0)).toBe(true);
    expect(rows.every((r) => r.principal_paid === 1000)).toBe(true);
    expect(rows[11].balance).toBe(0);
  });

  it('advances the due date one month per period', () => {
    const rows = buildSchedule(loan);

    expect(rows[0].due_date).toBe('2026-01-10');
    expect(rows[1].due_date).toBe('2026-02-10');
    expect(rows[11].due_date).toBe('2026-12-10');
  });

  it('clamps a month-end start date to the length of each month', () => {
    const rows = buildSchedule({
      principal: 30000,
      annualRate: 0,
      emi: 10000,
      startDate: '2026-01-31',
    });

    // February has no 31st: the due date must not spill into March.
    expect(rows.map((r) => r.due_date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('rolls the due date into the next year', () => {
    const rows = buildSchedule({
      principal: 3000,
      annualRate: 0,
      emi: 1000,
      startDate: '2026-11-15',
    });

    expect(rows.map((r) => r.due_date)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('stops at the period cap when the EMI never clears the interest', () => {
    // EMI below the monthly interest would otherwise loop forever.
    const rows = buildSchedule({
      principal: 100000,
      annualRate: 12,
      emi: 500,
      startDate: '2026-01-10',
      maxPeriods: 24,
    });

    expect(rows.length).toBe(24);
    expect(rows[rows.length - 1].balance).toBeGreaterThan(100000);
  });

  it('returns a single instalment when the EMI covers the whole loan', () => {
    const rows = buildSchedule({
      principal: 5000,
      annualRate: 0,
      emi: 9999,
      startDate: '2026-03-01',
    });

    expect(rows.length).toBe(1);
    expect(rows[0].emi).toBe(5000);
    expect(rows[0].balance).toBe(0);
  });
});
