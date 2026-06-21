import { describe, it, expect } from 'vitest';
import { createComparisonKey, normalizeForComparison } from '../../../src/utils/string-normalizer.js';

describe('StringNormalizer', () => {
  it('createComparisonKey normalizes and lowercases', () => {
    expect(createComparisonKey('hello')).toBe('hello');
    expect(createComparisonKey('')).toBe('');
    expect(createComparisonKey('ABC')).toBe('abc');
    expect(createComparisonKey('MixEdCaSe')).toBe('mixedcase');
  });

  it('normalizeForComparison replaces smart quotes', () => {
    expect(normalizeForComparison('\u2018')).toBe("'");
    expect(normalizeForComparison('\u2019')).toBe("'");
    expect(normalizeForComparison('\u201c')).toBe('"');
    expect(normalizeForComparison('\u201d')).toBe('"');
    expect(normalizeForComparison('\u2032')).toBe('\u2032');
    expect(normalizeForComparison('\u2033')).toBe('\u2033');
    expect(normalizeForComparison('`')).toBe('`');
  });
});
