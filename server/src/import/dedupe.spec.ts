import { distinct, keyOf } from './dedupe';

describe('keyOf', () => {
  const row = {
    txn_date: '2026-03-04',
    amount: 250,
    description: 'Swiggy order',
  };

  it('builds the same key for two identical rows', () => {
    expect(keyOf(row)).toBe(keyOf({ ...row }));
  });

  it('normalizes description case and internal whitespace', () => {
    expect(keyOf({ ...row, description: '  SWIGGY   order ' })).toBe(
      keyOf(row),
    );
    expect(keyOf({ ...row, description: 'Swiggy\torder' })).toBe(keyOf(row));
  });

  it('compares amounts at 2 decimals, so 250 and "250.00" collide', () => {
    expect(keyOf({ ...row, amount: 250.0 })).toBe(keyOf(row));
    expect(keyOf({ ...row, amount: 250.004 })).toBe(keyOf(row));
    expect(keyOf({ ...row, amount: 250.01 })).not.toBe(keyOf(row));
  });

  it('treats a row with no direction as an expense', () => {
    expect(keyOf({ ...row, direction: 'expense' })).toBe(keyOf(row));
    expect(keyOf({ ...row, direction: 'income' })).not.toBe(keyOf(row));
  });

  it('separates rows that differ only by date', () => {
    expect(keyOf({ ...row, txn_date: '2026-03-05' })).not.toBe(keyOf(row));
  });

  it('does not let a delimiter in the description forge another row key', () => {
    // Description and amount are different fields; a pipe in the text must
    // not make two different rows produce the same key.
    const a = keyOf({ ...row, description: 'a|b' });
    const b = keyOf({ ...row, description: 'a', amount: 250 });
    expect(a).not.toBe(b);
  });
});

describe('distinct', () => {
  it('keeps first-seen order and drops repeats', () => {
    expect(distinct(['Food', 'Fuel', 'Food'])).toEqual(['Food', 'Fuel']);
  });

  it('drops undefined and blank values', () => {
    expect(distinct(['Food', undefined, '', '   ', 'Fuel'])).toEqual([
      'Food',
      'Fuel',
    ]);
  });

  it('is case-sensitive, so differently-cased names stay separate', () => {
    expect(distinct(['Food', 'food'])).toEqual(['Food', 'food']);
  });

  it('returns an empty array for no usable values', () => {
    expect(distinct([])).toEqual([]);
    expect(distinct([undefined, '  '])).toEqual([]);
  });
});
