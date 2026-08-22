export interface ScheduleRow {
  period: number;
  due_date: string;
  emi: number;
  interest: number;
  principal_paid: number;
  balance: number;
}

/**
 * Builds a reducing-balance amortization schedule (mirrors the Excel EMI sheet).
 * Interest each month = balance * annualRate/12. EMI stays fixed; the final
 * payment is trimmed so the balance lands exactly on zero.
 */
export function buildSchedule(params: {
  principal: number;
  annualRate: number; // percent, e.g. 8.5
  emi: number;
  startDate: string; // ISO date
  maxPeriods?: number;
}): ScheduleRow[] {
  const { principal, annualRate, emi, startDate } = params;
  const monthlyRate = annualRate / 12 / 100;
  const cap = params.maxPeriods ?? 600; // 50-year safety cap

  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let period = 1; period <= cap && balance > 0.005; period++) {
    const interest = round2(balance * monthlyRate);
    let principalPaid = round2(emi - interest);
    let payment = emi;

    // Final installment: don't overpay.
    if (principalPaid >= balance) {
      principalPaid = round2(balance);
      payment = round2(principalPaid + interest);
    }

    balance = round2(balance - principalPaid);

    rows.push({
      period,
      due_date: addMonths(startDate, period - 1),
      emi: payment,
      interest,
      principal_paid: principalPaid,
      balance,
    });
  }

  return rows;
}

/**
 * `iso` shifted forward by `n` whole months, clamped to the length of the
 * target month — a loan that starts on the 31st is due on the 28th/30th in
 * shorter months rather than spilling into the next one. All arithmetic is
 * UTC so the schedule doesn't drift with the server's timezone.
 */
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = m - 1 + n;
  const year = y + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12; // 0-based
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
