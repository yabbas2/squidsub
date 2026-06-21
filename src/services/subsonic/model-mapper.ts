import { getConfig } from '../../config/settings.js';
import { Song } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { Readable } from 'node:stream';
import { convertSongToJson, convertAlbumToJson, convertArtistToJson } from '../../services/subsonic/response-builder.js';
import { XMLParser } from 'fast-xml-parser';

export class SubsonicProxyService {
  async relayAsync(endpoint: string, params: Record<string, string>): Promise<{ body: Buffer; contentType: string | null }> {
    const config = getConfig();
    const query = new URLSearchParams(params).toString();
    const url = `${config.NAVIDROME_URL}/${endpoint}?${query}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Navidrome proxy error: ${res.status}`);
    }

    const body = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type');
    return { body, contentType };
  }

  async relaySafeAsync(endpoint: string, params: Record<string, string>): Promise<{ body: Buffer | null; contentType: string | null; success: boolean }> {
    try {
      const result = await this.relayAsync(endpoint, params);
      return { ...result, success: true };
    } catch {
      return { body: null, contentType: null, success: false };
    }
  }

  async relayStreamAsync(params: Record<string, string>, signal?: AbortSignal): Promise<{ body: Readable | null; contentType: string | null }> {
    const config = getConfig();
    const query = new URLSearchParams(params).toString();
    const url = `${config.NAVIDROME_URL}/rest/stream.view?${query}`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Navidrome stream error: ${res.status}`);
    }

    const body = res.body ? Readable.fromWeb(res.body as any) : null;
    return { body, contentType: res.headers.get('content-type') };
  }
}

export class SubsonicModelMapper {
  parseSearchResponse(
    body: Buffer,
    contentType: string | null,
  ): { songs: Record<string, unknown>[]; albums: Record<string, unknown>[]; artists: Record<string, unknown>[] } {
    const isJson = contentType?.includes('json') ?? false;

    if (isJson) {
      return this.parseSearchJson(body);
    }

    return this.parseSearchXml(body);
  }

  private parseSearchJson(body: Buffer): { songs: Record<string, unknown>[]; albums: Record<string, unknown>[]; artists: Record<string, unknown>[] } {
    try {
      const parsed = JSON.parse(body.toString());
      const sr = parsed?.['subsonic-response']?.searchResult3 || parsed?.searchResult3 || {};
      return {
        songs: Array.isArray(sr.song) ? sr.song : sr.song ? [sr.song] : [],
        albums: Array.isArray(sr.album) ? sr.album : sr.album ? [sr.album] : [],
        artists: Array.isArray(sr.artist) ? sr.artist : sr.artist ? [sr.artist] : [],
      };
    } catch {
      return { songs: [], albums: [], artists: [] };
    }
  }

  private parseSearchXml(body: Buffer): { songs: Record<string, unknown>[]; albums: Record<string, unknown>[]; artists: Record<string, unknown>[] } {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const parsed = parser.parse(body.toString());
      const sr = parsed?.['subsonic-response']?.searchResult3 || {};
      const songs = sr.song ? (Array.isArray(sr.song) ? sr.song : [sr.song]) : [];
      const albums = sr.album ? (Array.isArray(sr.album) ? sr.album : [sr.album]) : [];
      const artists = sr.artist ? (Array.isArray(sr.artist) ? sr.artist : [sr.artist]) : [];

      // Convert XML format to common format
      return {
        songs: songs.map((s: any) => this.xmlAttrsToRecord(s)),
        albums: albums.map((a: any) => this.xmlAttrsToRecord(a)),
        artists: artists.map((a: any) => this.xmlAttrsToRecord(a)),
      };
    } catch {
      return { songs: [], albums: [], artists: [] };
    }
  }

  private xmlAttrsToRecord(obj: any): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') return {};
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('@_')) {
        record[key.slice(2)] = value;
      }
    }
    return record;
  }

  mergeSearchResults(
    localSongs: Record<string, unknown>[],
    localAlbums: Record<string, unknown>[],
    localArtists: Record<string, unknown>[],
    externalResult: SearchResult,
    externalPlaylists: ExternalPlaylist[],
    isJson: boolean,
  ): { mergedSongs: unknown[]; mergedAlbums: unknown[]; mergedArtists: unknown[] } {

    const mergedSongs = [
      ...localSongs,
      ...externalResult.songs.map(s => convertSongToJson(s)),
    ];

    const mergedAlbums = [
      ...localAlbums,
      ...externalResult.albums.map(a => convertAlbumToJson(a)),
      ...externalPlaylists.map(p => this.playlistToAlbumJson(p)),
    ];

    // Dedup artists by name (local wins)
    const localArtistNames = new Set(
      localArtists.map(a => ((a as any).name || '') as string).filter(Boolean).map(n => n.toLowerCase())
    );

    const mergedArtists = [
      ...localArtists,
      ...externalResult.artists
        .filter(a => !localArtistNames.has(a.name.toLowerCase()))
        .map(a => convertArtistToJson(a)),
    ];

    return { mergedSongs, mergedAlbums, mergedArtists };
  }

  private playlistToAlbumJson(playlist: ExternalPlaylist): Record<string, unknown> {
    return {
      id: playlist.id,
      name: playlist.name,
      artist: playlist.curatorName || playlist.owner || 'Various Artists',
      coverArt: playlist.coverArt || playlist.coverUrl,
      songCount: playlist.trackCount,
      duration: playlist.duration || 0,
      isDir: true,
    };
  }
}
