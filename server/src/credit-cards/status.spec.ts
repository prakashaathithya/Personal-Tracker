import { statusFor } from './status';

describe('statusFor', () => {
  it('is unpaid while nothing has been paid', () => {
    expect(statusFor(5000, 0, 'unpaid')).toBe('unpaid');
  });

  it('is partially_paid for anything short of the total', () => {
    expect(statusFor(5000, 0.01, 'unpaid')).toBe('partially_paid');
    expect(statusFor(5000, 4999.99, 'partially_paid')).toBe('partially_paid');
  });

  it('is paid once the total is covered', () => {
    expect(statusFor(5000, 5000, 'partially_paid')).toBe('paid');
    // An overpayment still settles the bill rather than going negative.
    expect(statusFor(5000, 6000, 'unpaid')).toBe('paid');
  });

  it('treats a zero-value bill as already settled', () => {
    expect(statusFor(0, 0, 'unpaid')).toBe('paid');
  });

  it('never revives a carried bill', () => {
    // The remainder is open on the next statement; this one must not claim
    // the same rupees again, whatever its totals are edited to.
    expect(statusFor(5000, 0, 'carried')).toBe('carried');
    expect(statusFor(5000, 5000, 'carried')).toBe('carried');
    expect(statusFor(0, 0, 'carried')).toBe('carried');
  });
});
