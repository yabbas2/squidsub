import { describe, it, expect } from 'vitest';
import { SubsonicModelMapper } from '../../../src/services/subsonic/model-mapper.js';
import { SearchResult } from '../../../src/models/search-result.js';
import type { Song, Album, Artist } from '../../../src/models/song.js';
import type { ExternalPlaylist } from '../../../src/models/subsonic-types.js';

describe('SubsonicModelMapper', () => {
  const mapper = new SubsonicModelMapper();

  it('mergeSearchResults combines local and external', () => {
    const localSongs = [{ id: 'local1', title: 'Local Song' }];
    const localAlbums: Record<string, unknown>[] = [];
    const localArtists: Record<string, unknown>[] = [];

    const externalResult = new SearchResult();
    externalResult.songs = [
      { id: 'ext-qobuz-song-1', title: 'External Song', artist: 'Ext Artist', isLocal: false } as Song,
    ];
    externalResult.albums = [];
    externalResult.artists = [];

    const playlists: ExternalPlaylist[] = [
      { id: 'pl-tidal-p1', name: 'External Playlist', provider: 'tidal', externalId: 'p1', trackCount: 5 },
    ];

    const { mergedSongs, mergedAlbums, mergedArtists } = mapper.mergeSearchResults(
      localSongs, localAlbums, localArtists, externalResult, playlists, true,
    );

    expect(mergedSongs).toHaveLength(2);
    expect(mergedAlbums).toHaveLength(1);
    expect(mergedArtists).toHaveLength(0);
  });

  it('mergeSearchResults includes all external songs (no dedup)', () => {
    const externalResult = new SearchResult();
    externalResult.songs = [
      { id: 'ext1', title: 'Same Song', artist: 'Artist', isLocal: false } as Song,
      { id: 'ext2', title: 'Same Song', artist: 'Artist', isLocal: false } as Song,
    ];

    const { mergedSongs } = mapper.mergeSearchResults(
      [], [], [], externalResult, [], true,
    );

    expect(mergedSongs).toHaveLength(2);
  });

  it('mergeSearchResults keeps playlists as albums', () => {
    const externalResult = new SearchResult();
    const playlists: ExternalPlaylist[] = [
      { id: 'pl-tidal-p1', name: 'Best Of', provider: 'tidal', externalId: 'p1', trackCount: 20, duration: 3600 },
      { id: 'pl-qobuz-p2', name: 'Chill Vibes', provider: 'qobuz', externalId: 'p2', trackCount: 15 },
    ];

    const { mergedAlbums } = mapper.mergeSearchResults(
      [], [], [], externalResult, playlists, true,
    );

    expect(mergedAlbums).toHaveLength(2);

    const firstAlbum = mergedAlbums[0] as Record<string, unknown>;
    expect(firstAlbum.name).toBe('Best Of');
    expect(firstAlbum.id).toBe('pl-tidal-p1');
  });

  it('parseSearchResponse with valid json returns parts', () => {
    const json = JSON.stringify({
      'subsonic-response': {
        status: 'ok',
        searchResult3: {
          song: [{ id: 's1', title: 'S1', artist: 'A1' }],
          album: [{ id: 'a1', name: 'A1', artist: 'Ar1' }],
          artist: [{ id: 'ar1', name: 'Artist1' }],
        },
      },
    });

    const body = Buffer.from(json, 'utf-8');
    const { songs, albums, artists } = mapper.parseSearchResponse(body, 'application/json');

    expect(songs).toHaveLength(1);
    expect(albums).toHaveLength(1);
    expect(artists).toHaveLength(1);
  });

  it('parseSearchResponse with empty body returns empty', () => {
    const { songs, albums, artists } = mapper.parseSearchResponse(Buffer.from([]), 'application/json');
    expect(songs).toHaveLength(0);
    expect(albums).toHaveLength(0);
    expect(artists).toHaveLength(0);
  });
});
