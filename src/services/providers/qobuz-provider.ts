import { ISquidWTFProvider, DownloadResult } from './interface.js';
import { Song, Album, Artist } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { getConfig } from '../../config/settings.js';
import {
  SquidWTFResponse, SquidWTFQobuzSearchData, SquidWTFQobuzArtistData, SquidWTFQobuzDownloadData,
  QobuzAlbum, QobuzArtist, QobuzTrack, QobuzImage
} from '../../models/qobuz-types.js';

export class QobuzProvider implements ISquidWTFProvider {
  readonly name = 'qobuz';
  readonly externalIdPrefix = 'ext-qobuz';
  readonly supportsPlaylists = false;

  get baseUrl(): string {
    return getConfig().SQUIDWTF__QOBUZ_BASE_URL;
  }

  async searchAllAsync(query: string, _songLimit = 20, _albumLimit = 20, _artistLimit = 20): Promise<SearchResult> {
    const url = `${this.baseUrl}/api/get-music?q=${encodeURIComponent(query)}&offset=0`;
    const data = await this.fetchJson<SquidWTFQobuzSearchData>(url);
    const result = new SearchResult();

    if (data?.albums?.items) {
      result.albums = data.albums.items.map(a => this.mapAlbum(a));
    }
    if (data?.artists?.items) {
      result.artists = data.artists.items.map(a => this.mapArtist(a));
    }
    if (data?.tracks?.items) {
      result.songs = data.tracks.items.map(t => this.mapSong(t, null));
    }

    return result;
  }

  async getSongAsync(externalId: string): Promise<Song | null> {
    const id = this.parseExternalId(externalId);
    const result = await this.searchAllAsync(id, 1, 0, 0);
    return result.songs.find(s => s.externalId === id) || null;
  }

  async getAlbumAsync(externalId: string): Promise<Album | null> {
    const id = this.parseExternalId(externalId);
    const url = `${this.baseUrl}/api/get-album?album_id=${encodeURIComponent(id)}`;
    const data = await this.fetchJson<QobuzAlbum>(url);
    if (!data) return null;
    return this.mapAlbum(data);
  }

  async getArtistAsync(externalId: string): Promise<Artist | null> {
    const id = this.parseExternalId(externalId);
    const url = `${this.baseUrl}/api/get-artist?artist_id=${encodeURIComponent(id)}`;
    const data = await this.fetchJson<SquidWTFQobuzArtistData>(url);
    const artist = data?.artist;
    if (!artist) return null;

    return {
      id: this.makeExternalId('artist', artist.id),
      name: artist.name || 'Unknown',
      imageUrl: artist.picture || artist.image?.large,
      albumCount: artist.albums_count || 0,
      isLocal: false,
      externalProvider: 'qobuz',
      externalId: artist.id,
      provider: 'qobuz',
    };
  }

  async getArtistAlbumsAsync(externalId: string): Promise<Album[]> {
    const id = this.parseExternalId(externalId);
    const url = `${this.baseUrl}/api/get-artist?artist_id=${encodeURIComponent(id)}&limit=50`;
    const data = await this.fetchJson<SquidWTFQobuzArtistData>(url);
    return data?.artist?.albums?.items?.map(a => this.mapAlbum(a)) || [];
  }

  async downloadTrackAsync(externalId: string, quality: string, signal?: AbortSignal): Promise<DownloadResult> {
    const id = this.parseExternalId(externalId);
    const config = getConfig();

    const formatId = quality === '27' || quality === 'lossless' || quality === 'flac_24' ? '27'
      : quality === '6' || quality === '320' || quality === 'flac' ? '6'
      : quality === '5' || quality === 'high' || quality === 'mp3' ? '5'
      : '27';

    const url = `${this.baseUrl}/api/download-music?track_id=${encodeURIComponent(id)}&quality=${formatId}`;
    const headers: Record<string, string> = {
      'Token-Country': config.SQUIDWTF__COUNTRY,
      'Accept': 'application/json',
    };

    let res = await fetch(url, { headers, signal });

    // Retry with fresh captcha on 403
    if (res.status === 403) {
      const body = await res.text();
      if (body.toLowerCase().includes('captcha')) {
        headers['Cookie'] = await this.solveCaptcha();
        res = await fetch(url, { headers, signal });
      }
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Qobuz download failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json() as SquidWTFResponse<SquidWTFQobuzDownloadData>;
    const downloadUrl = json?.data?.url;
    if (!downloadUrl) throw new Error('No stream URL returned from Qobuz');

    const streamRes = await fetch(downloadUrl, { signal });
    if (!streamRes.ok) throw new Error(`Qobuz stream download failed: ${streamRes.status}`);

    const buffer = Buffer.from(await streamRes.arrayBuffer());
    return { stream: buffer, fileExtension: '.flac', downloadedQuality: formatId };
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
      const res = await fetch(`${this.baseUrl}/api/get-music?q=test&offset=0`, {
        headers: {
          'Token-Country': getConfig().SQUIDWTF__COUNTRY,
          'Accept': 'application/json',
        },
      });
      return res.ok && (res.headers.get('content-type') || '').includes('json');
    } catch {
      return false;
    }
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    const config = getConfig();
    const res = await fetch(url, {
      headers: {
        'Token-Country': config.SQUIDWTF__COUNTRY,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;

    const json = await res.json() as SquidWTFResponse<T>;
    return json?.data ?? null;
  }

  private async solveCaptcha(): Promise<string> {
    // Basic captcha solver — will be enhanced when porting captcha solver
    return '';
  }

  private makeExternalId(type: string, id?: string): string {
    return `ext-qobuz-${type}-${id || 'unknown'}`;
  }

  private parseExternalId(externalId: string): string {
    const parts = externalId.split('-', 4);
    return parts.length >= 4 ? parts[3] : externalId;
  }

  private parseYear(date?: string): number | undefined {
    if (!date) return undefined;
    const d = new Date(date);
    return isNaN(d.getTime()) ? undefined : d.getFullYear();
  }

  private mapSong(track: QobuzTrack, _albumContext: QobuzAlbum | null): Song {
    const album = _albumContext || track.album;
    return {
      id: this.makeExternalId('song', track.id),
      title: track.title || 'Unknown',
      artist: track.artist?.name || 'Unknown',
      album: album?.title || 'Unknown',
      albumId: album?.id ? this.makeExternalId('album', album.id) : undefined,
      artistId: track.artist?.id ? this.makeExternalId('artist', track.artist.id) : undefined,
      track: track.track_number || 0,
      trackNumber: track.track_number || 0,
      discNumber: track.disc_number || 0,
      duration: track.duration || 0,
      coverArtUrl: track.image?.large || album?.image?.large,
      genre: track.genre?.name,
      year: this.parseYear(track.release_date_original),
      isrc: track.isrc,
      copyright: track.copyright,
      isExplicit: track.parental_warning,
      sampleRate: track.maximum_sampling_rate && track.maximum_sampling_rate > 0 ? Math.round(track.maximum_sampling_rate) : undefined,
      bitDepth: track.maximum_bit_depth && track.maximum_bit_depth > 0 ? track.maximum_bit_depth : undefined,
      isLocal: false,
      provider: 'qobuz',
      externalProvider: 'qobuz',
      externalId: track.id,
    };
  }

  private mapAlbum(album: QobuzAlbum): Album {
    return {
      id: this.makeExternalId('album', album.id),
      title: album.title || 'Unknown',
      artist: album.artist?.name || 'Unknown',
      artistId: album.artist?.id ? this.makeExternalId('artist', album.artist.id) : undefined,
      coverArtUrl: album.image?.large,
      year: this.parseYear(album.release_date_original),
      duration: album.duration || 0,
      trackCount: album.tracks_count || 0,
      songCount: album.tracks_count || 0,
      genre: album.genres_list?.[0]?.name,
      description: album.catchline,
      isExplicit: album.parental_warning,
      isLocal: false,
      provider: 'qobuz',
      externalProvider: 'qobuz',
      externalId: album.id,
    };
  }

  private mapArtist(artist: QobuzArtist): Artist {
    return {
      id: this.makeExternalId('artist', artist.id),
      name: artist.name || 'Unknown',
      imageUrl: artist.picture || artist.image?.large,
      albumCount: artist.albums_count || 0,
      isLocal: false,
      provider: 'qobuz',
      externalProvider: 'qobuz',
      externalId: artist.id,
    };
  }
}
