import { describe, it, expect } from 'vitest';
import type { Song, Album, Artist, SongLyrics } from '../../../src/models/song.js';

describe('Domain Models', () => {
  it('Song has default-like values when created with partial', () => {
    const song: Song = {
      id: '',
      title: '',
      artist: '',
      album: '',
      track: 0,
      trackNumber: 0,
      discNumber: 0,
      duration: 0,
      isLocal: false,
    };
    expect(song.title).toBe('');
    expect(song.artist).toBe('');
    expect(song.album).toBe('');
    expect(song.id).toBe('');
    expect(song.isLocal).toBe(false);
  });

  it('Song serializes and deserializes', () => {
    const song: Song = {
      id: 'ext-qobuz-song-123',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      track: 1,
      trackNumber: 1,
      discNumber: 1,
      duration: 240,
      year: 2024,
      isrc: 'USABC1234567',
      isExplicit: false,
      coverArtUrl: 'https://example.com/cover.jpg',
      isLocal: false,
    };

    const json = JSON.stringify(song);
    const deserialized = JSON.parse(json) as Song;

    expect(deserialized.id).toBe(song.id);
    expect(deserialized.title).toBe(song.title);
    expect(deserialized.artist).toBe(song.artist);
    expect(deserialized.track).toBe(1);
  });

  it('Album has expected default values', () => {
    const album: Album = {
      id: '',
      title: '',
      artist: '',
      isLocal: false,
    };
    expect(album.id).toBe('');
    expect(album.title).toBe('');
    expect(album.artist).toBe('');
    expect(album.songs).toBeUndefined();
    expect(album.isLocal).toBe(false);
  });

  it('Album serializes and deserializes', () => {
    const album: Album = {
      id: 'ext-tidal-album-456',
      title: 'Test Album',
      artist: 'Test Artist',
      year: 2024,
      trackCount: 10,
      duration: 3600,
      isLocal: false,
    };

    const json = JSON.stringify(album);
    const deserialized = JSON.parse(json) as Album;

    expect(deserialized.id).toBe(album.id);
    expect(deserialized.title).toBe(album.title);
    expect(deserialized.trackCount).toBe(10);
  });

  it('Artist has expected default values', () => {
    const artist: Artist = {
      id: '',
      name: '',
      albumCount: 0,
      isLocal: false,
    };
    expect(artist.id).toBe('');
    expect(artist.name).toBe('');
    expect(artist.isLocal).toBe(false);
  });

  it('SongLyrics has expected default values', () => {
    const lyrics: SongLyrics = { synced: false, lines: [] };
    expect(lyrics.lines).toHaveLength(0);
    expect(lyrics.synced).toBe(false);
  });
});
