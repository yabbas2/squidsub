import { describe, it, expect } from 'vitest';
import { getQualityLevel, shouldUpgrade } from '../../../src/utils/quality-helper.js';

describe('QualityHelper', () => {
  it('getQualityLevel returns expected values', () => {
    expect(getQualityLevel('FLAC')).toBe(7);
    expect(getQualityLevel('FLAC_24')).toBe(8);
    expect(getQualityLevel('ULTRAHD')).toBe(8);
    expect(getQualityLevel('MP3_128')).toBe(3);
    expect(getQualityLevel('AAC_320')).toBe(6);
    expect(getQualityLevel('LOSSLESS')).toBe(7);
    expect(getQualityLevel('')).toBe(0);
    expect(getQualityLevel(undefined)).toBe(0);
    expect(getQualityLevel('UNKNOWN')).toBe(0);
  });

  it('shouldUpgrade returns true when target is higher', () => {
    expect(shouldUpgrade('MP3_128', 'FLAC')).toBe(true);
  });

  it('shouldUpgrade returns false when target is lower', () => {
    expect(shouldUpgrade('FLAC', 'MP3_128')).toBe(false);
  });

  it('shouldUpgrade returns false when equal', () => {
    expect(shouldUpgrade('FLAC', 'LOSSLESS')).toBe(false);
  });

  it('shouldUpgrade returns true when existing is null', () => {
    expect(shouldUpgrade(undefined, 'FLAC')).toBe(true);
  });

  it('shouldUpgrade returns false when target is null', () => {
    expect(shouldUpgrade('FLAC', undefined)).toBe(false);
  });
});
