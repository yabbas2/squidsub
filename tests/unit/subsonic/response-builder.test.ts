import { describe, it, expect } from 'vitest';
import {
  createSongResponse,
  createAlbumResponse,
  createArtistResponse,
  createResponse,
  createError,
  createLyricsResponse,
  convertSongToJson,
  convertAlbumToJson,
} from '../../../src/services/subsonic/response-builder.js';
import type { Song, Album, Artist, SongLyrics, LyricLine } from '../../../src/models/song.js';

describe('SubsonicResponseBuilder', () => {
  it('createSongResponse json contains correct fields', () => {
    const song: Song = {
      id: 'ext-qobuz-song-123',
      externalProvider: 'qobuz',
      externalId: '123',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      track: 3,
      trackNumber: 3,
      discNumber: 1,
      duration: 240,
      year: 2024,
      coverArtUrl: 'https://example.com/cover.jpg',
      isLocal: false,
    };

    const result = createSongResponse('json', song) as Record<string, unknown>;
    const response = (result as any)['subsonic-response'];
    expect(response.status).toBe('ok');
    expect(response.song.id).toBe(song.id);
    expect(response.song.title).toBe(song.title);
    expect(response.song.artist).toBe(song.artist);
    expect(response.song.track).toBe(3);
    expect(response.song.duration).toBe(240);
    expect(response.song.year).toBe(2024);
  });

  it('createSongResponse xml contains correct fields', () => {
    const song: Song = {
      id: 'ext-tidal-song-456',
      externalProvider: 'tidal',
      externalId: '456',
      title: 'XML Song',
      artist: 'XML Artist',
      album: 'XML Album',
      track: 1,
      trackNumber: 1,
      discNumber: 1,
      duration: 200,
      isLocal: false,
    };

    const result = createSongResponse('xml', song) as string;
    expect(result).toContain('<subsonic-response');
    expect(result).toContain(song.id);
    expect(result).toContain(song.title);
  });

  it('createAlbumResponse json contains songs', () => {
    const album: Album = {
      id: 'ext-qobuz-album-789',
      title: 'Test Album',
      artist: 'Test Artist',
      year: 2024,
      songCount: 2,
      isLocal: false,
      songs: [
        { id: 'song1', title: 'Track 1', track: 1, trackNumber: 1, discNumber: 1, duration: 100, isLocal: false } as Song,
        { id: 'song2', title: 'Track 2', track: 2, trackNumber: 2, discNumber: 1, duration: 200, isLocal: false } as Song,
      ],
    };

    const result = createAlbumResponse('json', album) as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    expect(resp.album.name).toBe(album.title);
    expect(resp.album.songCount).toBe(2);
    expect(resp.album.song).toHaveLength(2);
  });

  it('createArtistResponse json contains albums', () => {
    const artist: Artist = {
      id: 'ext-tidal-artist-111',
      name: 'Test Artist',
      albumCount: 2,
      isLocal: false,
    };

    const albums: Album[] = [
      { id: 'a1', title: 'Album 1', artist: 'Test Artist', isLocal: false } as Album,
      { id: 'a2', title: 'Album 2', artist: 'Test Artist', isLocal: false } as Album,
    ];

    const result = createArtistResponse('json', artist, albums) as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    expect(resp.artist.name).toBe(artist.name);
    expect(resp.artist.albumCount).toBe(2);
    expect(resp.artist.album).toHaveLength(2);
  });

  it('createError json contains error code', () => {
    const result = createError('json', 40, 'Wrong password') as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    expect(resp.error.code).toBe(40);
    expect(resp.error.message).toBe('Wrong password');
  });

  it('createResponse json returns ok status', () => {
    const result = createResponse('json', 'starred', {}) as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    expect(resp.status).toBe('ok');
  });

  it('createLyricsResponse json returns structured lyrics', () => {
    const lyrics: SongLyrics = {
      displayArtist: 'Artist',
      displayTitle: 'Title',
      synced: false,
      lines: [
        { startMs: 0, text: 'Line1' },
        { startMs: 5000, text: 'Line2' },
      ],
    };

    const result = createLyricsResponse('json', lyrics) as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    const structured = resp.lyricsList.structuredLyrics[0];
    expect(structured.synced).toBe(false);
    expect(structured.line).toHaveLength(2);
  });

  it('createLyricsResponse json returns empty when null', () => {
    const result = createLyricsResponse('json', null) as Record<string, unknown>;
    const resp = (result as any)['subsonic-response'];
    expect(resp.lyricsList).toBeDefined();
  });

  it('convertSongToJson contains all fields', () => {
    const song: Song = {
      id: 'ext-qobuz-song-s1',
      externalProvider: 'qobuz',
      externalId: 's1',
      title: 'T',
      artist: 'A',
      album: 'Al',
      track: 1,
      trackNumber: 1,
      discNumber: 1,
      duration: 100,
      year: 2024,
      genre: 'Rock',
      coverArtUrl: 'https://example.com/c.jpg',
      isExplicit: true,
      isrc: 'ISRC123',
      isLocal: false,
    };

    const result = convertSongToJson(song);
    expect(result.id).toBe('ext-qobuz-song-s1');
    expect(result.title).toBe('T');
    expect(result.artist).toBe('A');
    expect(result.track).toBe(1);
  });

  it('convertAlbumToJson contains all fields', () => {
    const album: Album = {
      id: 'a1',
      title: 'Album',
      artist: 'Artist',
      year: 2024,
      coverArtUrl: 'https://example.com/c.jpg',
      duration: 2000,
      songCount: 10,
      genre: 'Jazz',
      isLocal: false,
    };

    const result = convertAlbumToJson(album);
    expect(result.id).toBe('a1');
    expect(result.name).toBe('Album');
    expect(result.artist).toBe('Artist');
    expect(result.year).toBe(2024);
  });
});
