const QUALITY_LEVELS: Record<string, number> = {
  OPUS: 0,
  AAC_64: 1,
  AAC_96: 2,
  MP3_128: 3,
  MP3_192: 4,
  AAC_192: 4,
  AAC_256: 5,
  STANDARD: 5,
  AAC_320: 6,
  MP3_320: 6,
  HIGH: 6,
  FLAC_16: 7,
  HD: 7,
  LOSSLESS: 7,
  FLAC: 7,
  FLAC_24: 8,
  ULTRAHD: 8,
  HI_RES_LOSSLESS: 8,
  LOW: 2,
};

export function getQualityLevel(quality?: string): number {
  if (!quality) return 0;
  return QUALITY_LEVELS[quality.toUpperCase()] ?? 0;
}

export function shouldUpgrade(existingQuality?: string, targetQuality?: string): boolean {
  if (!targetQuality) return false;
  if (!existingQuality) return true;
  return getQualityLevel(targetQuality) > getQualityLevel(existingQuality);
}
