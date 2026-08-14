/**
 * Billing-cycle date math for credit cards.
 *
 * Every date here is an ISO `YYYY-MM-DD` string and all arithmetic runs in
 * UTC, so a statement never lands a day early or late depending on where
 * the server happens to be running. This matches how the rest of the API
 * treats `txn_date`.
 */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function partsOf(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Number of days in month `m` (1-12) of year `y`. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * The statement date within one month, clamped to the month's length — a
 * card that bills on the 31st bills on the 28th in February rather than
 * spilling over into March.
 */
export function statementDateIn(y: number, m: number, day: number): string {
  return toIso(y, m, Math.min(day, daysInMonth(y, m)));
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = partsOf(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = partsOf(from);
  const [ty, tm, td] = partsOf(to);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86_400_000);
}

/** First statement date strictly after `after`. */
export function nextStatementDate(after: string, day: number): string {
  let [y, m] = partsOf(after);
  const sameMonth = statementDateIn(y, m, day);
  if (sameMonth > after) return sameMonth;
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return statementDateIn(y, m, day);
}

/**
 * The most recent statement date on or before `on` — used to seed a card's
 * very first bill, which sweeps up everything spent so far.
 */
export function lastStatementDateOnOrBefore(on: string, day: number): string {
  let [y, m] = partsOf(on);
  const sameMonth = statementDateIn(y, m, day);
  if (sameMonth <= on) return sameMonth;
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return statementDateIn(y, m, day);
}

/** The next `count` statement dates strictly after `after`. */
export function statementDateSeries(
  after: string,
  day: number,
  count: number,
): string[] {
  const out: string[] = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    cursor = nextStatementDate(cursor, day);
    out.push(cursor);
  }
  return out;
}

/**
 * Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1), falling back
 * to a straight split when the card offers a no-cost (0%) plan.
 */
export function emiFor(
  principal: number,
  annualRate: number,
  tenureMonths: number,
): number {
  if (tenureMonths <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r <= 0) return round2(principal / tenureMonths);
  const growth = Math.pow(1 + r, tenureMonths);
  return round2((principal * r * growth) / (growth - 1));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
