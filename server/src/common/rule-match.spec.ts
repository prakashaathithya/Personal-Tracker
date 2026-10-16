import { CategorizationRule, matchCategory, ruleMatches } from './rule-match';

const rule = (
  match: CategorizationRule['match'],
  pattern: string,
  category_id = 'cat',
): CategorizationRule => ({ match, pattern, category_id });

describe('ruleMatches', () => {
  it('matches a substring case-insensitively', () => {
    expect(ruleMatches(rule('contains', 'swiggy'), 'UPI-SWIGGY-123')).toBe(
      true,
    );
    expect(ruleMatches(rule('contains', 'SWIGGY'), 'upi swiggy order')).toBe(
      true,
    );
    expect(ruleMatches(rule('contains', 'zomato'), 'UPI-SWIGGY-123')).toBe(
      false,
    );
  });

  it('ignores surrounding whitespace on both sides', () => {
    expect(ruleMatches(rule('contains', '  swiggy  '), '  swiggy  ')).toBe(
      true,
    );
    expect(ruleMatches(rule('equals', ' Swiggy '), 'swiggy')).toBe(true);
  });

  it('requires the whole description for an equals rule', () => {
    expect(ruleMatches(rule('equals', 'salary'), 'Salary')).toBe(true);
    expect(ruleMatches(rule('equals', 'salary'), 'Salary credit')).toBe(false);
  });

  it('applies a regex rule case-insensitively', () => {
    expect(
      ruleMatches(rule('regex', '^amzn.*retail$'), 'AMZN India Retail'),
    ).toBe(true);
    expect(ruleMatches(rule('regex', '\\d{4}$'), 'CARD ending 1234')).toBe(
      true,
    );
    expect(ruleMatches(rule('regex', '^upi'), 'NEFT transfer')).toBe(false);
  });

  it('never throws on an invalid regex', () => {
    expect(() => ruleMatches(rule('regex', '['), 'anything')).not.toThrow();
    expect(ruleMatches(rule('regex', '['), 'anything')).toBe(false);
  });

  it('treats a blank pattern as no match', () => {
    expect(ruleMatches(rule('contains', ''), 'anything')).toBe(false);
    expect(ruleMatches(rule('contains', '   '), 'anything')).toBe(false);
    expect(ruleMatches(rule('regex', ''), 'anything')).toBe(false);
  });
});

describe('matchCategory', () => {
  it('returns the first matching rule in the order given', () => {
    const rules = [
      rule('contains', 'swiggy', 'food'),
      rule('contains', 'upi', 'misc'),
    ];

    // Both match; priority order decides, so the caller's order wins.
    expect(matchCategory(rules, 'UPI-SWIGGY-123')).toBe('food');
    expect(matchCategory([...rules].reverse(), 'UPI-SWIGGY-123')).toBe('misc');
  });

  it('returns null when nothing matches', () => {
    expect(matchCategory([rule('contains', 'swiggy')], 'NEFT rent')).toBeNull();
    expect(matchCategory([], 'anything')).toBeNull();
  });

  it('skips a broken regex rule and keeps evaluating the rest', () => {
    const rules = [
      rule('regex', '(', 'broken'),
      rule('contains', 'rent', 'home'),
    ];

    expect(matchCategory(rules, 'NEFT rent')).toBe('home');
  });
});
