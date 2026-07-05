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
  const start = new Date(startDate);

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
    const due = new Date(start);
    due.setMonth(due.getMonth() + (period - 1));

    rows.push({
      period,
      due_date: due.toISOString().slice(0, 10),
      emi: payment,
      interest,
      principal_paid: principalPaid,
      balance,
    });
  }

  return rows;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
