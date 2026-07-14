export interface CategorizationRule {
  match: 'contains' | 'equals' | 'regex';
  pattern: string;
  category_id: string;
}

/** Whether a description matches a single rule. Invalid regex never throws. */
export function ruleMatches(rule: CategorizationRule, text: string): boolean {
  const desc = text.trim().toLowerCase();
  const pat = rule.pattern.trim().toLowerCase();
  if (!pat) return false;
  switch (rule.match) {
    case 'contains':
      return desc.includes(pat);
    case 'equals':
      return desc === pat;
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(text);
      } catch {
        return false;
      }
  }
}

/**
 * Returns the category id of the first matching rule (rules should be passed
 * already ordered by priority), or null when nothing matches.
 */
export function matchCategory(
  rules: CategorizationRule[],
  text: string,
): string | null {
  const rule = rules.find((r) => ruleMatches(r, text));
  return rule?.category_id ?? null;
}
