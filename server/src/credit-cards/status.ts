import { StatementRow } from './types';

/**
 * Keeps a bill's status in step with what's been paid against it.
 *
 * `carried` is terminal: once an unpaid remainder has been rolled into the
 * next statement, that money is open on the newer bill and this one must
 * never flip back to unpaid, however its totals are later edited.
 */
export function statusFor(
  total: number,
  paid: number,
  fallback: StatementRow['status'],
): StatementRow['status'] {
  if (fallback === 'carried') return 'carried';
  if (total <= 0 || paid >= total) return 'paid';
  return paid > 0 ? 'partially_paid' : 'unpaid';
}
