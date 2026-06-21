import { describe, it, expect, vi, afterEach } from 'vitest';
import { sanitizeFileName, getCachePath } from '../../../src/utils/path-helper.js';

describe('PathHelper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizeFileName replaces invalid chars', () => {
    const result = sanitizeFileName('song: <name> | cool');
    expect(result).not.toContain(':');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('|');
    expect(result).toBe('song name  cool');
  });

  it('sanitizeFileName truncates over 100 chars', () => {
    const input = 'a'.repeat(150);
    const result = sanitizeFileName(input);
    expect(result.length).toBe(100);
  });

  it('sanitizeFileName returns Unknown for null or empty', () => {
    expect(sanitizeFileName('')).toBe('Unknown');
  });

  it('getCachePath returns temp subdirectory', () => {
    const path = getCachePath();
    expect(path).toContain('squidsub-cache');
  });
});
