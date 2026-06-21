import { ISquidWTFProvider, DownloadResult } from './interface.js';
import { Song, Album, Artist } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { getConfig } from '../../config/settings.js';
import { CaptchaSolver } from '../captcha/captcha-solver.js';
import { AmazonDrmDecryptor } from '../squidwtf/amazon-drm-decryptor.js';
import { CmafDemuxer } from '../squidwtf/cmaf-demuxer.js';
import {
  AmazonSearchResponse, AmazonSearchTrack, AmazonTrackMetadataResponse,
  AmazonDownloadPrepareResponse, AmazonDownloadStartResponse, AmazonDownloadStatusResponse,
} from '../../models/amazon-types.js';
import crypto from 'node:crypto';

function deriveAlbumId(track: AmazonSearchTrack): string | undefined {
  return track.album?.id
    || (track.album?.image
      ? crypto.createHash('sha256').update(track.album.image).digest('hex').slice(0, 12)
      : undefined);
}

interface AlbumCacheEntry {
  title: string;
  artist: string;
  coverArtUrl?: string;
  artistId?: string;
  songs: Song[];
}

export class AmazonMusicProvider implements ISquidWTFProvider {
  readonly name = 'amazon';
  readonly externalIdPrefix = 'ext-amz';
  readonly supportsPlaylists = true;

  private captchaSolver = new CaptchaSolver();
  private drmDecryptor = new AmazonDrmDecryptor();
  private cmafDemuxer = new CmafDemuxer();
  private albumCache = new Map<string, AlbumCacheEntry>();

  get baseUrl(): string {
    return getConfig().SQUIDWTF__AMAZON_BASE_URL;
  }

  async searchAllAsync(query: string, songLimit = 20, _albumLimit = 20, _artistLimit = 20): Promise<SearchResult> {
    const result = await this.proxyApiPostAsync<AmazonSearchResponse>('/api/search', { query });
    if (!result?.trackList) return new SearchResult();

    const allTracks = result.trackList;
    const searchResult = new SearchResult();

    // Artists: derive from all tracks
    const seenArtists = new Set<string>();
    for (const track of allTracks) {
      const name = track.primaryArtistName || track.albumArtistName;
      if (!name || seenArtists.has(name.toLowerCase())) continue;
      seenArtists.add(name.toLowerCase());
      searchResult.artists.push({
        id: this.makeExternalId('artist', this.normalizeArtistId(name)),
        name,
        albumCount: 0,
        isLocal: false,
        provider: 'amazon',
        externalProvider: 'amazon',
        externalId: this.normalizeArtistId(name),
      });
    }

    // Albums: derive from all tracks, dedup by album id (or image hash fallback)
    const seenAlbumIds = new Set<string>();
    for (const track of allTracks) {
      const albumKey = deriveAlbumId(track);
      if (!albumKey || seenAlbumIds.has(albumKey)) continue;
      seenAlbumIds.add(albumKey);

      const albumTitle = track.album?.title || 'Amazon Music';
      const albumArtist = track.albumArtistName || track.primaryArtistName || 'Unknown';
      const albumSongs = allTracks
        .filter(t => deriveAlbumId(t) === albumKey)
        .map(t => this.mapSearchTrack(t));

      this.albumCache.set(albumKey, {
        title: albumTitle,
        artist: albumArtist,
        coverArtUrl: track.album?.image,
        artistId: this.makeExternalId('artist', this.normalizeArtistId(albumArtist)),
        songs: albumSongs,
      });

      searchResult.albums.push({
        id: this.makeExternalId('album', albumKey),
        title: albumTitle,
        artist: albumArtist,
        coverArtUrl: track.album?.image,
        isLocal: false,
        provider: 'amazon',
        externalProvider: 'amazon',
        externalId: albumKey,
      });
    }

    // Songs (all tracks, not just the first per album)
    searchResult.songs = allTracks.slice(0, songLimit).map(t => this.mapSearchTrack(t));

    return searchResult;
  }

  async getSongAsync(externalId: string): Promise<Song | null> {
    const id = this.parseExternalId(externalId);
    const result = await this.proxyApiPostAsync<AmazonTrackMetadataResponse>('/api/track', { asin: id });
    if (!result?.metadata) return null;

    const m = result.metadata;
    return {
      id: this.makeExternalId('song', m.asin || id),
      title: m.title || 'Unknown',
      artist: m.artist || 'Unknown',
      album: m.album || 'Unknown',
      albumId: m.album_asin ? this.makeExternalId('album', m.album_asin) : undefined,
      artistId: this.makeExternalId('artist', m.album_artist || m.artist || id),
      track: parseInt(m.track_number || '0', 10) || 0,
      trackNumber: parseInt(m.track_number || '0', 10) || 0,
      discNumber: parseInt(m.disc_number || '0', 10) || 0,
      duration: m.duration || 0,
      coverArtUrl: m.cover,
      isrc: m.isrc,
      isExplicit: m.is_explicit,
      year: this.parseYear(m.year),
      isLocal: false,
      provider: 'amazon',
      externalProvider: 'amazon',
      externalId: m.asin || id,
    };
  }

  async getAlbumAsync(externalId: string): Promise<Album | null> {
    const id = this.parseExternalId(externalId);

    let cached = this.albumCache.get(id);
    if (!cached) {
      // Cache miss — try searching by the album id/asin as query
      await this.searchAllAsync(id, 50, 1, 0);
      cached = this.albumCache.get(id);
      if (!cached) return null;
    }

    return {
      id: this.makeExternalId('album', id),
      title: cached.title,
      artist: cached.artist,
      artistId: cached.artistId,
      coverArtUrl: cached.coverArtUrl,
      songCount: cached.songs.length,
      trackCount: cached.songs.length,
      duration: cached.songs.reduce((sum, s) => sum + (s.duration || 0), 0),
      isLocal: false,
      provider: 'amazon',
      externalProvider: 'amazon',
      externalId: id,
      songs: cached.songs,
    };
  }

  async getArtistAsync(externalId: string): Promise<Artist | null> {
    const artistKey = this.parseExternalId(externalId);
    const matching = [...this.albumCache.values()].filter(
      e => this.normalizeArtistId(e.artist) === artistKey,
    );
    if (matching.length === 0) return null;

    const artistName = matching[0].artist;
    return {
      id: this.makeExternalId('artist', artistKey),
      name: artistName,
      albumCount: matching.length,
      imageUrl: matching.find(e => e.coverArtUrl)?.coverArtUrl,
      isLocal: false,
      provider: 'amazon',
      externalProvider: 'amazon',
      externalId: artistKey,
    };
  }

  async getArtistAlbumsAsync(externalId: string): Promise<Album[]> {
    const artistKey = this.parseExternalId(externalId);
    const matching = [...this.albumCache.entries()].filter(
      ([_, e]) => this.normalizeArtistId(e.artist) === artistKey,
    );

    return matching.map(([id, e]) => ({
      id: this.makeExternalId('album', id),
      title: e.title,
      artist: e.artist,
      artistId: e.artistId,
      coverArtUrl: e.coverArtUrl,
      songCount: e.songs.length,
      trackCount: e.songs.length,
      duration: e.songs.reduce((sum, s) => sum + (s.duration || 0), 0),
      isLocal: false,
      provider: 'amazon',
      externalProvider: 'amazon',
      externalId: id,
    }));
  }

  async downloadTrackAsync(externalId: string, quality: string, signal?: AbortSignal): Promise<DownloadResult> {
    const id = this.parseExternalId(externalId);
    const config = getConfig();
    const country = config.SQUIDWTF__COUNTRY || 'US';

    const q = quality.toLowerCase();
    let amzCodec = 'flac';
    let amzQuality = 1;

    if (q === 'atmos' || q === '360') { amzCodec = 'atmos'; amzQuality = 1; }
    else if (q === 'mhm1') { amzCodec = 'mhm1'; amzQuality = 1; }
    else if (q === 'ultrahd' || q === '24bit' || q === 'hi_res_lossless') { amzCodec = 'flac'; amzQuality = 1; }
    else if (q === 'hd' || q === '16bit' || q === 'lossless' || q === 'flac' || q === 'flac_16') { amzCodec = 'flac'; amzQuality = 2; }
    else if (q === 'high' || q === 'opus' || q === 'aac' || q === 'aac_320' || q === 'mp3_320') { amzCodec = 'm4a'; amzQuality = 1; }

    const payload = {
      asin: id,
      country,
      codec: amzCodec,
      quality: amzQuality,
      download_cover: false,
      download_lyrics: false,
      output_template: '{artist} - {title}',
    };

    const token = await this.ensureCaptchaCookieAsync();
    const streamData = await this.downloadViaPrepareOrAsyncJob(payload, token, signal);

    const ext = amzCodec === 'm4a' ? '.mp3' : amzCodec === 'atmos' ? '.mp4' : '.flac';
    return { stream: Buffer.from(streamData), fileExtension: ext, downloadedQuality: quality };
  }

  private async downloadViaPrepareOrAsyncJob(
    payload: any,
    token: string | null,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const baseUrl = this.baseUrl;

    const createPost = (path: string, body: any): RequestInit => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'X-Captcha-Token': token } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    const createGet = (path: string): RequestInit => ({
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'X-Captcha-Token': token } : {}),
      },
      signal,
    });

    // Try direct prepare first (fall through to async job on any failure — matches C#)
    try {
      const prepRes = await fetch(`${baseUrl}/api/download/track/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'X-Captcha-Token': token } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });
      if (prepRes.ok) {
        const prepData = await prepRes.json() as AmazonDownloadPrepareResponse;
        const prepUrl = this.resolveDownloadUrl(prepData.directUrl);
        if (prepUrl) {
          const dlRes = await fetch(prepUrl, { signal });
          if (dlRes.ok) return new Uint8Array(await dlRes.arrayBuffer());
        }
      }
    } catch {
      // Fall through to async job
    }

    // Start async job
    const startRes = await fetch(`${baseUrl}/api/download/track/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'X-Captcha-Token': token } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!startRes.ok) {
      const body = await startRes.text();
      throw new Error(`Amazon download start failed: ${startRes.status} ${body.slice(0, 200)}`);
    }

    const startData = await startRes.json() as AmazonDownloadStartResponse;
    const jobId = startData.job_id;
    if (!jobId) throw new Error('No job_id returned from Amazon download start');

    // Poll status until ready (12 min timeout)
    const timeout = 12 * 60 * 1000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < timeout) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      let statusRes: Response | null = null;
      for (let retries = 0; retries < 3; retries++) {
        statusRes = await fetch(`${baseUrl}/api/download/track/status?job=${encodeURIComponent(jobId)}`, {
          headers: {
            'Accept': 'application/json',
            ...(token ? { 'X-Captcha-Token': token } : {}),
          },
          signal,
        });
        if (statusRes.ok) break;
        if (statusRes.status !== 502 && statusRes.status !== 503) break;
        await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
      }

      if (!statusRes || !statusRes.ok) {
        const body = statusRes ? await statusRes.text() : 'null';
        throw new Error(`Amazon download status failed: ${body.slice(0, 200)}`);
      }

      const statusData = await statusRes.json() as AmazonDownloadStatusResponse;
      const s = statusData.status;

      if (s === 'ready') {
        const downloadUrl = this.resolveDownloadUrl(statusData.directUrl)
          || (statusData.token ? `${baseUrl}/api/download/album/part?token=${encodeURIComponent(statusData.token)}` : null);
        if (!downloadUrl) throw new Error('Track ready but missing download URL');

        const dlRes = await fetch(downloadUrl, { signal });
        if (!dlRes.ok) throw new Error(`Amazon download failed: ${dlRes.status}`);
        return new Uint8Array(await dlRes.arrayBuffer());
      }

      if (s === 'failed') {
        throw new Error(statusData.error || 'Track download failed on server');
      }

      await new Promise(r => setTimeout(r, s === 'building' || s === 'queued' ? 800 : 1000));
    }

    throw new Error('Amazon download timed out after 12 minutes');
  }

  async searchPlaylistsAsync(_query: string, _limit = 20): Promise<ExternalPlaylist[]> {
    return [];
  }

  async getPlaylistAsync(_externalId: string): Promise<ExternalPlaylist | null> {
    return null;
  }

  async getPlaylistTracksAsync(_externalId: string): Promise<Song[]> {
    return [];
  }

  async isAvailableAsync(): Promise<boolean> {
    try {
      const token = await this.ensureCaptchaCookieAsync();
      return token !== null;
    } catch {
      return false;
    }
  }

  private async ensureCaptchaCookieAsync(): Promise<string | null> {
    return this.captchaSolver.solveAltchaChallenge(
      this.baseUrl,
      '/api/captcha/challenge',
      '/api/captcha/verify',
    );
  }

  private async proxyApiPostAsync<T>(path: string, body: object): Promise<T | null> {
    return this.sendWithCaptchaRetry<T>(path, body, 0);
  }

  private async sendWithCaptchaRetry<T>(path: string, body: object, attempt: number): Promise<T | null> {
    const config = getConfig();
    const token = attempt > 0
      ? await this.captchaSolver.solveAltchaChallenge(this.baseUrl, '/api/captcha/challenge', '/api/captcha/verify', undefined, true)
      : await this.ensureCaptchaCookieAsync();

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'X-Captcha-Token': token } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();

      if (attempt === 0) {
        if (res.status === 502 || res.status === 503) {
          await new Promise(r => setTimeout(r, 1000));
          return this.sendWithCaptchaRetry<T>(path, body, 1);
        }
        if (errorBody.toLowerCase().includes('captcha')) {
          return this.sendWithCaptchaRetry<T>(path, body, 1);
        }
      }
      return null;
    }

    return res.json() as T;
  }

  private resolveDownloadUrl(url?: string): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private makeExternalId(type: string, id?: string): string {
    return `ext-amz-${type}-${id || 'unknown'}`;
  }

  private parseExternalId(externalId: string): string {
    const parts = externalId.split('-', 4);
    return parts.length >= 4 ? parts[3] : externalId;
  }

  private normalizeArtistId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
  }

  private mapSearchTrack(track: AmazonSearchTrack): Song {
    const albumKey = deriveAlbumId(track);
    const albumId = albumKey ? this.makeExternalId('album', albumKey) : undefined;

    return {
      id: this.makeExternalId('song', track.asin || ''),
      title: track.title || 'Unknown',
      artist: track.primaryArtistName || 'Unknown',
      album: track.album?.title || 'Amazon Music',
      albumId,
      artistId: this.makeExternalId('artist', this.normalizeArtistId(track.primaryArtistName || track.albumArtistName || 'unknown')),
      coverArtUrl: track.album?.image,
      track: 0,
      trackNumber: 0,
      discNumber: 0,
      duration: 0,
      isLocal: false,
      provider: 'amazon',
      externalProvider: 'amazon',
      externalId: track.asin,
    };
  }

  private parseYear(date?: string): number | undefined {
    if (!date) return undefined;
    const y = parseInt(date, 10);
    if (!isNaN(y)) return y;
    const d = new Date(date);
    return isNaN(d.getTime()) ? undefined : d.getFullYear();
  }
}
