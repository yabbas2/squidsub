import { describe, it, expect } from 'vitest';
import { isExternalPlaylist, parsePlaylistId, makePlaylistId } from '../../../src/utils/id-helper.js';

describe('PlaylistIdHelper', () => {
  it('isExternalPlaylist returns expected', () => {
    expect(isExternalPlaylist('pl-qobuz-abc123')).toBe(true);
    expect(isExternalPlaylist('pl-tidal-playlist-xyz')).toBe(true);
    expect(isExternalPlaylist('pl-amz-myx')).toBe(true);
    expect(isExternalPlaylist('pl-squidwtf-test')).toBe(true);
    expect(isExternalPlaylist('pl-unknown-xyz')).toBe(true);
    expect(isExternalPlaylist('qobuz-abc123')).toBe(false);
    expect(isExternalPlaylist('')).toBe(false);
    expect(isExternalPlaylist('abc')).toBe(false);
  });

  it('parsePlaylistId returns correct parts', () => {
    const r1 = parsePlaylistId('pl-qobuz-abc123');
    expect(r1.provider).toBe('qobuz');
    expect(r1.externalId).toBe('abc123');

    const r2 = parsePlaylistId('pl-tidal-xyz-789');
    expect(r2.provider).toBe('tidal');
    expect(r2.externalId).toBe('xyz-789');

    const r3 = parsePlaylistId('pl-amz-playlist-1');
    expect(r3.provider).toBe('amz');
    expect(r3.externalId).toBe('playlist-1');
  });

  it('parsePlaylistId returns null for invalid format', () => {
    expect(parsePlaylistId('invalid').provider).toBeNull();
    expect(parsePlaylistId('pl-').provider).toBeNull();
    expect(parsePlaylistId('').provider).toBeNull();
  });

  it('makePlaylistId returns correct format', () => {
    expect(makePlaylistId('qobuz', 'abc')).toBe('pl-qobuz-abc');
    expect(makePlaylistId('TIDAL', 'XyZ')).toBe('pl-TIDAL-XyZ');
  });
});
