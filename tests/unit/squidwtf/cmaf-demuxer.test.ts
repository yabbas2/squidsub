import { describe, it, expect } from 'vitest';
import { CmafDemuxer } from '../../../src/services/squidwtf/cmaf-demuxer.js';

function buildMinimalMp4(): Buffer {
  const parts: Buffer[] = [];

  // ftyp box
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x14])); // size
  parts.push(Buffer.from('ftyp'));
  parts.push(Buffer.alloc(12)); // filler

  // moov box
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x08]));
  parts.push(Buffer.from('moov'));

  // mdat box
  parts.push(Buffer.from([0x00, 0x00, 0x00, 0x08]));
  parts.push(Buffer.from('mdat'));

  return Buffer.concat(parts);
}

describe('CmafDemuxer', () => {
  const demuxer = new CmafDemuxer();

  it('isCmafWithFlac detects ftyp moov mdat', () => {
    const data = buildMinimalMp4();
    expect(demuxer.isCmafWithFlac(data)).toBe(true);
  });

  it('isCmafWithFlac returns false for empty data', () => {
    expect(demuxer.isCmafWithFlac(Buffer.from([]))).toBe(false);
  });

  it('isCmafWithFlac returns false for random data', () => {
    const data = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(demuxer.isCmafWithFlac(data)).toBe(false);
  });

  it('extractFlacFromMp4 with embedded FLAC returns FLAC data', () => {
    const flacMarker = Buffer.from('fLaC');
    const mp4 = Buffer.concat([
      buildMinimalMp4(),
      Buffer.from([0x00, 0x00, 0x00, 0x0A]), // box size
      Buffer.from('mdat'),
      flacMarker,
      Buffer.from([0x01, 0x02, 0x03]),
    ]);

    const result = demuxer.extractFlacFromMp4(mp4);
    expect(result.subarray(0, 4).toString()).toBe('fLaC');
  });

  it('extractFlacFromMp4 throws for no FLAC data', () => {
    const mp4 = buildMinimalMp4();
    expect(() => demuxer.extractFlacFromMp4(mp4)).toThrow();
  });
});
