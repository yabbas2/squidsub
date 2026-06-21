export function createComparisonKey(name: string): string {
  return normalizeForComparison(name).toLowerCase();
}

export function normalizeForComparison(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}
