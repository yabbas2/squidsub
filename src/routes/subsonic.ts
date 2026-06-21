import { FastifyInstance } from 'fastify';
import { extractAllParameters } from '../services/subsonic/request-parser.js';
import { SubsonicProxyService, SubsonicModelMapper } from '../services/subsonic/model-mapper.js';
import {
  createResponse,
  createError,
  createSongResponse,
  createLyricsResponse,
  createTranscodeDecisionResponse,
  createAlbumResponse,
  createArtistResponse,
  convertSongToJson,
  convertAlbumToJson,
} from '../services/subsonic/response-builder.js';
import { getConfig } from '../config/settings.js';
import { SearchResult } from '../models/search-result.js';
import { Song, Album } from '../models/song.js';
import { ExternalPlaylist } from '../models/subsonic-types.js';
import { parseExternalId } from '../utils/id-helper.js';
import { normalizeForComparison } from '../utils/string-normalizer.js';
import { XMLParser } from 'fast-xml-parser';

interface ServiceContainer {
  proxyService: SubsonicProxyService;
  modelMapper: SubsonicModelMapper;
  metadataService: {
    searchAllAsync(query: string, songLimit?: number, albumLimit?: number, artistLimit?: number): Promise<SearchResult>;
    searchAlbumsAsync(query: string, limit?: number): Promise<Album[]>;
    getSongAsync(provider: string, externalId: string): Promise<Song | null>;
    getAlbumAsync(provider: string, externalId: string): Promise<Album | null>;
    getArtistAsync(provider: string, externalId: string): Promise<import('../models/song.js').Artist | null>;
    getArtistAlbumsAsync(provider: string, externalId: string): Promise<Album[]>;
    searchPlaylistsAsync(query: string, limit?: number): Promise<ExternalPlaylist[]>;
  };
  downloadService: {
    downloadAndStreamAsync(provider: string, externalId: string, signal?: AbortSignal): Promise<{ stream: Buffer; filePath: string }>;
  };
  localLibraryService: {
    parseSongId(id: string): { isExternal: boolean; provider: string | null; externalId: string | null };
    getLocalPathForExternalSongAsync(provider: string, externalId: string): Promise<string | null>;
    waitForLocalIdAfterScanAsync(provider: string, externalId: string, signal?: AbortSignal): Promise<string | null>;
    triggerLibraryScanAsync(): Promise<boolean>;
  };
}

export async function subsonicRoutes(app: FastifyInstance, services: ServiceContainer) {
  const { proxyService, modelMapper, metadataService, downloadService, localLibraryService } = services;

  // --- Helper: get format ---
  function getFormat(params: Record<string, string>): string {
    return params['f'] || 'xml';
  }

  // --- Helper: send response in correct format ---
  function sendReply(reply: any, body: unknown, format: string) {
    const contentType = format === 'json' ? 'application/json' : 'text/xml';
    return reply.header('Content-Type', contentType).send(body);
  }

  // --- search3 ---
  app.all('/rest/search3', async (request, reply) => {
    return handleSearch3(request, reply);
  });

  app.all('/rest/search3.view', async (request, reply) => {
    return handleSearch3(request, reply);
  });

  async function handleSearch3(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const query = (params['query'] || '').trim().replace(/^"+|"+$/g, '');

    if (!query) {
      // Relay empty query to Navidrome
      try {
        const result = await proxyService.relayAsync('rest/search3', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createResponse(request.url, 'searchResult3', {}), format);
      }
    }

    // Query both Navidrome and external
    const sc = parseInt(params['songCount'] || '20', 10);
    const ac = parseInt(params['albumCount'] || '20', 10);
    const arc = parseInt(params['artistCount'] || '20', 10);

    const [subsonicResult, externalResult] = await Promise.all([
      proxyService.relaySafeAsync('rest/search3', params),
      metadataService.searchAllAsync(query, sc, ac, arc),
    ]);

    const localSongs = subsonicResult.success && subsonicResult.body
      ? modelMapper.parseSearchResponse(subsonicResult.body, subsonicResult.contentType)
      : { songs: [], albums: [], artists: [] };

    const isJson = format === 'json' || subsonicResult.contentType?.includes('json') === true;

    const merged = modelMapper.mergeSearchResults(
      localSongs.songs,
      localSongs.albums,
      localSongs.artists,
      externalResult,
      [],
      isJson,
    );

    const searchData: Record<string, unknown> = {};
    if (merged.mergedSongs.length > 0) searchData.song = merged.mergedSongs;
    if (merged.mergedAlbums.length > 0) searchData.album = merged.mergedAlbums;
    if (merged.mergedArtists.length > 0) searchData.artist = merged.mergedArtists;

    return sendReply(reply, createResponse(request.url, 'searchResult3', searchData), format);
  }

  // --- stream ---
  app.all('/rest/stream', async (request, reply) => {
    return handleStream(request, reply);
  });

  app.all('/rest/stream.view', async (request, reply) => {
    return handleStream(request, reply);
  });

  // --- download ---
  app.all('/rest/download', async (request, reply) => {
    return handleStream(request, reply, true);
  });

  app.all('/rest/download.view', async (request, reply) => {
    return handleStream(request, reply, true);
  });

  async function handleStream(request: any, reply: any, asDownload = false) {
    const params = await extractAllParameters(request);
    const id = params['id'] || '';
    const format = getFormat(params);

    const parsed = parseExternalId(id);

    if (!parsed.isExternal || !parsed.provider || !parsed.externalId) {
      // Relay to Navidrome
      try {
        const result = await proxyService.relayStreamAsync(params, request.raw?.aborted ? undefined : undefined);
        if (!result.body) {
          return reply.status(502).send('No stream');
        }
        const contentType = result.contentType || 'audio/mpeg';
        if (asDownload) {
          return reply.header('Content-Type', contentType)
            .header('Content-Disposition', `attachment; filename="${id}.mp3"`)
            .send(result.body);
        }
        return reply.header('Content-Type', contentType).send(result.body);
      } catch (err: any) {
        if (err.message?.includes('404')) {
          return sendReply(reply, createError(request.url, 70, 'Song not found'), format);
        }
        throw err;
      }
    }

    // External track — download and stream
    try {
      console.log(`[stream] external track id=${id} provider=${parsed.provider} externalId=${parsed.externalId}`);
      const { stream, filePath } = await downloadService.downloadAndStreamAsync(parsed.provider, parsed.externalId, undefined);
      const ext = filePath.endsWith('.flac') ? 'audio/flac' : filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mpeg';
      const fileSize = stream.length;
      console.log(`[stream] returning ${fileSize} bytes ext=${ext} path=${filePath}`);

      // Handle Range requests for seeking
      const rangeHeader = request.headers['range'];
      if (rangeHeader && !asDownload) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;

          if (start >= fileSize) {
            return reply.status(416)
              .header('Content-Range', `bytes */${fileSize}`)
              .send();
          }

          const chunkSize = end - start + 1;
          console.log(`[stream] range ${start}-${end}/${fileSize} chunk=${chunkSize}`);
          return reply.status(206)
            .header('Content-Type', ext)
            .header('Accept-Ranges', 'bytes')
            .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
            .header('Content-Length', chunkSize)
            .send(stream.slice(start, end + 1));
        }
      }

      if (asDownload) {
        const fileName = filePath.split('/').pop() || 'track.mp3';
        return reply.header('Content-Type', ext)
          .header('Content-Disposition', `attachment; filename="${fileName}"`)
          .header('Accept-Ranges', 'bytes')
          .header('Content-Length', fileSize)
          .send(stream);
      }

      return reply.header('Content-Type', ext)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', fileSize)
        .send(stream);
    } catch (err: any) {
      console.log(`[stream] error:`, err.message);
      return sendReply(reply, createError(request.url, 70, `Failed to stream: ${err.message}`), format);
    }
  }

  // --- getSong ---
  app.all('/rest/getSong', async (request, reply) => {
    return handleGetSong(request, reply);
  });

  app.all('/rest/getSong.view', async (request, reply) => {
    return handleGetSong(request, reply);
  });

  async function handleGetSong(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || '';

    const parsed = parseExternalId(id);

    if (!parsed.isExternal || !parsed.provider || !parsed.externalId) {
      // Relay to Navidrome
      try {
        const result = await proxyService.relayAsync('rest/getSong', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createError(request.url, 70, 'Song not found'), format);
      }
    }

    const song = await metadataService.getSongAsync(parsed.provider, parsed.externalId);
    if (!song) {
      return sendReply(reply, createError(request.url, 70, 'Song not found'), format);
    }

    return sendReply(reply, createSongResponse(request.url, song), format);
  }

  // --- getLyricsBySongId ---
  app.all('/rest/getLyricsBySongId', async (request, reply) => {
    return handleGetLyrics(request, reply);
  });

  app.all('/rest/getLyricsBySongId.view', async (request, reply) => {
    return handleGetLyrics(request, reply);
  });

  async function handleGetLyrics(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || '';

    const parsed = parseExternalId(id);

    let song: Song | null = null;

    if (parsed.isExternal && parsed.provider && parsed.externalId) {
      song = await metadataService.getSongAsync(parsed.provider, parsed.externalId);
    } else {
      // For local tracks, relay to Navidrome
      try {
        const result = await proxyService.relayAsync('rest/getLyricsBySongId', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createLyricsResponse(request.url, null), format);
      }
    }

    if (!song) {
      return sendReply(reply, createLyricsResponse(request.url, null), format);
    }

    // Fetch lyrics from Lrclib
    try {
      const { LrclibLyricsService } = await import('../services/lyrics/lyrics-service.js');
      const lyricsService = new LrclibLyricsService();
      if (lyricsService.enabled) {
        const lyrics = await lyricsService.getLyricsAsync(song);
        if (lyrics) {
          const filePath = await downloadService.downloadAndStreamAsync(parsed.provider!, parsed.externalId!, undefined)
            .then(r => r.filePath)
            .catch(() => undefined);
          if (filePath) {
            await lyricsService.tryWriteSidecarAsync(filePath, song).catch(() => {});
          }
        }
        return sendReply(reply, createLyricsResponse(request.url, lyrics), format);
      }
    } catch {}

    return sendReply(reply, createLyricsResponse(request.url, null), format);
  }

  // --- getArtist ---
  app.all('/rest/getArtist', async (request, reply) => {
    return handleGetArtist(request, reply);
  });

  app.all('/rest/getArtist.view', async (request, reply) => {
    return handleGetArtist(request, reply);
  });

  async function handleGetArtist(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || '';

    const { isExternal, provider, type, externalId } = parseExternalId(id);

    if (!isExternal || !provider || !externalId) {
      // Relay to Navidrome
      try {
        const result = await proxyService.relayAsync('rest/getArtist', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createError(request.url, 70, 'Artist not found'), format);
      }
    }

    const artist = await metadataService.getArtistAsync(provider, externalId);
    if (!artist) {
      return sendReply(reply, createError(request.url, 70, 'Artist not found'), format);
    }

    const albums = await metadataService.getArtistAlbumsAsync(provider, externalId);
    return sendReply(reply, createArtistResponse(request.url, artist, albums), format);
  }

  // --- getAlbum ---
  app.all('/rest/getAlbum', async (request, reply) => {
    return handleGetAlbum(request, reply);
  });

  app.all('/rest/getAlbum.view', async (request, reply) => {
    return handleGetAlbum(request, reply);
  });

  async function handleGetAlbum(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || '';

    const { isExternal, provider, type, externalId } = parseExternalId(id);

    if (!isExternal || !provider || !externalId) {
      // Local Navidrome album — fetch local data, then merge with external songs
      const navResult = await proxyService.relaySafeAsync('rest/getAlbum', params);
      if (!navResult.success || !navResult.body) {
        return sendReply(reply, createError(request.url, 70, 'Album not found'), format);
      }

      const isJson = navResult.contentType?.includes('json') === true;
      if (!isJson) {
        // XML — pass through raw Navidrome response (no XML merge for now)
        return reply.header('Content-Type', navResult.contentType || 'text/xml').send(navResult.body);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(navResult.body.toString());
      } catch {
        return reply.header('Content-Type', navResult.contentType || 'text/xml').send(navResult.body);
      }

      const albumEl = parsed?.['subsonic-response']?.album || {};
      const albumName: string = albumEl.name || albumEl.title || '';
      const artistName: string = albumEl.artist || '';
      const localSongs: Record<string, unknown>[] = Array.isArray(albumEl.song)
        ? albumEl.song
        : albumEl.song ? [albumEl.song] : [];

      if (!albumName || !artistName) {
        return reply.header('Content-Type', navResult.contentType || 'text/xml').send(navResult.body);
      }

      // Phase 1-3: Search external provider for matching songs
      const searchQuery = `${artistName} ${albumName}`;
      const config = getConfig();
      let externalSongs: Song[] = [];

      // Phase 1: Exact album match
      const externalAlbums = await metadataService.searchAlbumsAsync(searchQuery, 5);
      for (const candidate of externalAlbums) {
        if (candidate.artist?.toLowerCase() === artistName.toLowerCase() &&
            candidate.title.toLowerCase() === albumName.toLowerCase()) {
          const matched = await metadataService.getAlbumAsync(
            candidate.externalProvider || config.SQUIDWTF__SOURCE,
            candidate.externalId || '',
          );
          if (matched?.songs?.length) {
            externalSongs = matched.songs;
            break;
          }
        }
      }

      // Phase 2: Fuzzy album match (substring)
      if (externalSongs.length === 0) {
        for (const candidate of externalAlbums) {
          if (candidate.artist?.toLowerCase().includes(artistName.toLowerCase()) &&
              (candidate.title.toLowerCase().includes(albumName.toLowerCase()) ||
               albumName.toLowerCase().includes(candidate.title.toLowerCase()))) {
            const matched = await metadataService.getAlbumAsync(
              candidate.externalProvider || config.SQUIDWTF__SOURCE,
              candidate.externalId || '',
            );
            if (matched?.songs?.length) {
              externalSongs = matched.songs;
              break;
            }
          }
        }
      }

      // Phase 3: Individual song search as last resort
      if (externalSongs.length === 0) {
        const songSearch = await metadataService.searchAllAsync(searchQuery, 50, 0, 0);
        externalSongs = songSearch.songs.filter(
          s => s.artist?.toLowerCase().includes(artistName.toLowerCase()),
        );
      }

      // Merge local + external songs (dedup by title)
      if (externalSongs.length > 0) {
        const localTitles = new Set(
          localSongs.map(s => normalizeForComparison((s.title as string || '')).toLowerCase()),
        );

        const mergedSongs: Record<string, unknown>[] = [...localSongs];
        for (const extSong of externalSongs) {
          const normalizedTitle = normalizeForComparison(extSong.title).toLowerCase();
          if (!localTitles.has(normalizedTitle)) {
            const songJson = convertSongToJson(extSong);
            songJson.parent = id;
            songJson.albumId = id;
            mergedSongs.push(songJson);
          }
        }

        mergedSongs.sort((a, b) => {
          const discA = parseInt(String(a.discNumber || 0), 10);
          const discB = parseInt(String(b.discNumber || 0), 10);
          if (discA !== discB) return discA - discB;
          const trackA = parseInt(String(a.track || 0), 10);
          const trackB = parseInt(String(b.track || 0), 10);
          return trackA - trackB;
        });

        albumEl.song = mergedSongs;
        albumEl.songCount = mergedSongs.length;
        albumEl.duration = mergedSongs.reduce(
          (sum: number, s: any) => sum + (parseInt(String(s.duration || 0), 10)), 0,
        );
      }

      return reply.header('Content-Type', 'application/json').send({
        'subsonic-response': {
          status: 'ok',
          version: '1.16.1',
          album: albumEl,
        },
      });
    }

    // External album — fetch from provider directly
    const album = await metadataService.getAlbumAsync(provider, externalId);
    if (!album) {
      return sendReply(reply, createError(request.url, 70, 'Album not found'), format);
    }

    return sendReply(reply, createAlbumResponse(request.url, album), format);
  }

  // --- getCoverArt ---
  app.all('/rest/getCoverArt', async (request, reply) => {
    return handleGetCoverArt(request, reply);
  });

  app.all('/rest/getCoverArt.view', async (request, reply) => {
    return handleGetCoverArt(request, reply);
  });

  async function handleGetCoverArt(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const id = params['id'] || '';

    const { isExternal, provider, type, externalId } = parseExternalId(id);
    const size = parseInt(params['size'] || '0', 10) || undefined;

    if (!isExternal || !externalId) {
      // Proxy to Navidrome
      try {
        const query = new URLSearchParams(params).toString();
        const config = getConfig();
        const res = await fetch(`${config.NAVIDROME_URL}/rest/getCoverArt.view?${query}`);
        if (!res.ok) throw new Error('Not found');
        const buffer = Buffer.from(await res.arrayBuffer());
        return reply.header('Content-Type', res.headers.get('content-type') || 'image/jpeg').send(buffer);
      } catch {
        return reply.status(404).send('Cover not found');
      }
    }

    // External cover art — fetch from URL
    // Try to get the song metadata to find cover URL
    if (provider && type === 'song') {
      const song = await metadataService.getSongAsync(provider, externalId);
      if (song?.coverArtUrl) {
        const res = await fetch(song.coverArtUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          return reply.header('Content-Type', res.headers.get('content-type') || 'image/jpeg').send(buffer);
        }
      }
    }

    return reply.status(404).send('Cover not found');
  }

  // --- getTranscodeDecision ---
  app.all('/rest/getTranscodeDecision', async (request, reply) => {
    return handleTranscodeDecision(request, reply);
  });

  app.all('/rest/getTranscodeDecision.view', async (request, reply) => {
    return handleTranscodeDecision(request, reply);
  });

  async function handleTranscodeDecision(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || '';

    const parsed = parseExternalId(id);
    let song: Song | null = null;

    if (parsed.isExternal && parsed.provider && parsed.externalId) {
      song = await metadataService.getSongAsync(parsed.provider, parsed.externalId);
    }

    if (!song) {
      song = {
        id,
        title: 'Unknown',
        artist: 'Unknown',
        album: 'Unknown',
        duration: 0,
        track: 0,
        trackNumber: 0,
        discNumber: 0,
        isLocal: !parsed.isExternal,
      };
    }

    return sendReply(reply, createTranscodeDecisionResponse(request.url, song), format);
  }

  // --- star ---
  app.all('/rest/star', async (request, reply) => {
    return handleStar(request, reply);
  });

  app.all('/rest/star.view', async (request, reply) => {
    return handleStar(request, reply);
  });

  async function handleStar(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || params['songId'] || params['albumId'] || params['artistId'] || '';

    const parsed = parseExternalId(id);

    if (!parsed.isExternal || !parsed.provider || !parsed.externalId) {
      // Pass through to Navidrome
      try {
        const result = await proxyService.relayAsync('rest/star', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createResponse(request.url, 'starred', {}), format);
      }
    }

    // For external songs in Cache mode, trigger permanent download
    const config = getConfig();
    if (config.SQUIDSUB__STORAGE_MODE === 'cache') {
      try {
        const { BaseDownloadService } = await import('../services/download/download-service.js');
        const dlSvc = new BaseDownloadService();
        await dlSvc.permanentizeCachedSongAsync(parsed.provider, parsed.externalId);
      } catch (err) {
        // Non-critical — continue
      }
    }

    // Resolve external ID to local Navidrome ID if possible after scan
    const newParams = { ...params };
    try {
      const localId = await localLibraryService.waitForLocalIdAfterScanAsync(parsed.provider, parsed.externalId);
      if (localId) {
        newParams['id'] = localId;
      }
    } catch {}

    try {
      const result = await proxyService.relayAsync('rest/star', newParams);
      return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
    } catch {
      return sendReply(reply, createResponse(request.url, 'starred', {}), format);
    }
  }

  // --- unstar ---
  app.all('/rest/unstar', async (request, reply) => {
    return handleUnstar(request, reply);
  });

  app.all('/rest/unstar.view', async (request, reply) => {
    return handleUnstar(request, reply);
  });

  async function handleUnstar(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || params['songId'] || params['albumId'] || params['artistId'] || '';

    const parsed = parseExternalId(id);

    if (!parsed.isExternal || !parsed.provider || !parsed.externalId) {
      try {
        const result = await proxyService.relayAsync('rest/unstar', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createResponse(request.url, 'unstarred', {}), format);
      }
    }

    const newParams = { ...params };
    try {
      const localId = await localLibraryService.getLocalPathForExternalSongAsync(parsed.provider, parsed.externalId);
      if (localId) {
        newParams['id'] = localId;
      }
    } catch {}

    try {
      const result = await proxyService.relayAsync('rest/unstar', newParams);
      return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
    } catch {
      return sendReply(reply, createResponse(request.url, 'unstarred', {}), format);
    }
  }

  // --- scrobble ---
  app.all('/rest/scrobble', async (request, reply) => {
    return handleScrobble(request, reply);
  });

  app.all('/rest/scrobble.view', async (request, reply) => {
    return handleScrobble(request, reply);
  });

  async function handleScrobble(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);
    const id = params['id'] || params['songId'] || '';

    const parsed = parseExternalId(id);

    if (!parsed.isExternal || !parsed.provider || !parsed.externalId) {
      try {
        const result = await proxyService.relayAsync('rest/scrobble', params);
        return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
      } catch {
        return sendReply(reply, createResponse(request.url, 'scrobbled', {}), format);
      }
    }

    const newParams = { ...params };
    try {
      const localId = await localLibraryService.getLocalPathForExternalSongAsync(parsed.provider, parsed.externalId);
      if (localId) {
        newParams['id'] = localId;
      }
    } catch {}

    try {
      const result = await proxyService.relayAsync('rest/scrobble', newParams);
      return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
    } catch {
      return sendReply(reply, createResponse(request.url, 'scrobbled', {}), format);
    }
  }

  // --- updatePlaylist ---
  app.all('/rest/updatePlaylist', async (request, reply) => {
    return handleUpdatePlaylist(request, reply);
  });

  app.all('/rest/updatePlaylist.view', async (request, reply) => {
    return handleUpdatePlaylist(request, reply);
  });

  async function handleUpdatePlaylist(request: any, reply: any) {
    const params = await extractAllParameters(request);
    const format = getFormat(params);

    // Resolve any external song IDs in the playlist entry params
    const newParams = { ...params };

    const songIdAdd = params['songIdToAdd'];
    if (songIdAdd) {
      const parsed = parseExternalId(songIdAdd);
      if (parsed.isExternal && parsed.provider && parsed.externalId) {
        try {
          const { BaseDownloadService } = await import('../services/download/download-service.js');
          const dlService = new BaseDownloadService();
          await dlService.downloadTrackAsync(songIdAdd);
        } catch {}
      }
    }

    try {
      const result = await proxyService.relayAsync('rest/updatePlaylist', newParams);
      return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
    } catch {
      return sendReply(reply, createResponse(request.url, 'playlist', {}), format.toString());
    }
  }

  // --- Fallthrough: all other endpoints proxied to Navidrome ---
  app.all('/*', async (request, reply) => {
    // Only catch paths that aren't explicitly handled
    const path = request.url.split('?')[0];
    const explicitPaths = [
      '/rest/search3', '/rest/search3.view',
      '/rest/stream', '/rest/stream.view',
      '/rest/download', '/rest/download.view',
      '/rest/getSong', '/rest/getSong.view',
      '/rest/getLyricsBySongId', '/rest/getLyricsBySongId.view',
      '/rest/getArtist', '/rest/getArtist.view',
      '/rest/getAlbum', '/rest/getAlbum.view',
      '/rest/getCoverArt', '/rest/getCoverArt.view',
      '/rest/getTranscodeDecision', '/rest/getTranscodeDecision.view',
      '/rest/star', '/rest/star.view',
      '/rest/unstar', '/rest/unstar.view',
      '/rest/scrobble', '/rest/scrobble.view',
      '/rest/updatePlaylist', '/rest/updatePlaylist.view',
    ];

    if (explicitPaths.includes(path)) {
      return reply.status(404).send('Not found');
    }

    // Relay to Navidrome
    const params = await extractAllParameters(request);
    const endpoint = path.startsWith('/') ? path.slice(1) : path;

    try {
      const result = await proxyService.relayAsync(endpoint, params);
      return reply.header('Content-Type', result.contentType || 'text/xml').send(result.body);
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('Not found')) {
        return sendReply(reply, createError(request.url, 70, 'Not found'), getFormat(params));
      }
      throw err;
    }
  });
}
