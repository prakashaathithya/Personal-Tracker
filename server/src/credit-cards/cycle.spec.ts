import {
  addDays,
  daysBetween,
  daysInMonth,
  emiFor,
  lastStatementDateOnOrBefore,
  nextStatementDate,
  statementDateIn,
  statementDateSeries,
} from './cycle';
import { inr, minimumDue } from './generate';

describe('statement dates', () => {
  it('clamps a late statement day to the length of the month', () => {
    expect(statementDateIn(2026, 2, 31)).toBe('2026-02-28');
    expect(statementDateIn(2024, 2, 31)).toBe('2024-02-29'); // leap year
    expect(statementDateIn(2026, 4, 31)).toBe('2026-04-30');
    expect(statementDateIn(2026, 5, 5)).toBe('2026-05-05');
  });

  it('knows how long each month is', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('finds the next statement date strictly after a given day', () => {
    expect(nextStatementDate('2026-01-04', 5)).toBe('2026-01-05');
    // On the statement day itself the next one is a month out.
    expect(nextStatementDate('2026-01-05', 5)).toBe('2026-02-05');
    expect(nextStatementDate('2026-12-20', 5)).toBe('2027-01-05');
    expect(nextStatementDate('2026-01-31', 31)).toBe('2026-02-28');
  });

  it('finds the most recent cutoff already passed', () => {
    expect(lastStatementDateOnOrBefore('2026-03-10', 5)).toBe('2026-03-05');
    expect(lastStatementDateOnOrBefore('2026-03-05', 5)).toBe('2026-03-05');
    expect(lastStatementDateOnOrBefore('2026-03-01', 5)).toBe('2026-02-05');
    expect(lastStatementDateOnOrBefore('2026-01-01', 5)).toBe('2025-12-05');
  });

  it('walks a run of future statement dates', () => {
    expect(statementDateSeries('2026-01-05', 5, 3)).toEqual([
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
    // A 31st cycle still advances one month at a time through February.
    expect(statementDateSeries('2026-01-31', 31, 3)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-12-25', 20)).toBe('2027-01-14');
    expect(addDays('2026-03-05', 20)).toBe('2026-03-25');
  });

  it('counts days between dates, negative once past', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-03-25', '2026-03-25')).toBe(0);
    expect(daysBetween('2026-03-26', '2026-03-25')).toBe(-1);
  });
});

describe('EMI', () => {
  it('splits a no-cost plan evenly', () => {
    expect(emiFor(120000, 0, 12)).toBe(10000);
  });

  it('uses the reducing-balance formula when interest applies', () => {
    expect(emiFor(100000, 12, 12)).toBeCloseTo(8884.88, 2);
    expect(emiFor(50000, 15, 6)).toBeCloseTo(8701.69, 2);
  });

  it('returns nothing for a zero tenure', () => {
    expect(emiFor(1000, 10, 0)).toBe(0);
  });
});

describe('minimum due', () => {
  it('takes the percentage once it clears the floor', () => {
    expect(minimumDue(10000, 5)).toBe(500);
  });

  it('falls back to a small floor on a modest bill', () => {
    expect(minimumDue(1000, 5)).toBe(200);
  });

  it('never asks for more than the bill itself', () => {
    expect(minimumDue(150, 5)).toBe(150);
    expect(minimumDue(0, 5)).toBe(0);
  });
});

describe('rupee formatting', () => {
  it('groups the Indian way', () => {
    expect(inr(999)).toBe('₹999');
    expect(inr(12345)).toBe('₹12,345');
    expect(inr(123456)).toBe('₹1,23,456');
    expect(inr(12345678)).toBe('₹1,23,45,678');
    expect(inr(-4500)).toBe('-₹4,500');
  });
});
