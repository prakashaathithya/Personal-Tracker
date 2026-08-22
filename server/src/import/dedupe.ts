/**
 * Pure helpers behind the Excel import's duplicate detection, kept out of the
 * controller so the matching rules can be unit-tested without a database.
 */

/**
 * Natural key used to recognise the "same" transaction on re-import:
 * date + amount + normalized description + direction. Imported rows are
 * always expenses.
 */
export function keyOf(r: {
  txn_date: string;
  amount: number;
  description: string;
  direction?: string;
}): string {
  return [
    r.txn_date,
    Number(r.amount).toFixed(2),
    r.description.trim().toLowerCase().replace(/\s+/g, ' '),
    r.direction ?? 'expense',
  ].join('|');
}

/** Unique, non-blank values in first-seen order. */
export function distinct(values: (string | undefined)[]): string[] {
  return [
    ...new Set(values.filter((v): v is string => !!v && v.trim().length > 0)),
  ];
}
