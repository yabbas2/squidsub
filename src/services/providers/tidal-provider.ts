import { ISquidWTFProvider, DownloadResult } from './interface.js';
import { Song, Album, Artist } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { SquidWTFInstanceManager } from '../squidwtf/instance-manager.js';
import { TidalDashManifestParser } from '../squidwtf/tidal-dash-parser.js';
import { getConfig } from '../../config/settings.js';
import {
  TidalApiVersionResponse, TidalTrackSearchData, TidalNestedSearchData,
  TidalTrack, TidalAlbum, TidalArtist, TidalPlaylist,
  TidalDownloadResponseData, TidalBtsManifest,
  TidalAlbumDetailData, TidalArtistResponse, TidalPlaylistResponse,
} from '../../models/tidal-types.js';

export class TidalProvider implements ISquidWTFProvider {
  readonly name = 'tidal';
  readonly externalIdPrefix = 'ext-tidal';
  readonly supportsPlaylists = true;
  readonly baseUrl = 'https://tidal.com';

  private instanceManager = new SquidWTFInstanceManager();
  private dashParser = new TidalDashManifestParser();

  async searchAllAsync(query: string, songLimit = 20, albumLimit = 20, artistLimit = 20): Promise<SearchResult> {
    const [songs, albums, artists] = await Promise.all([
      this.searchTracksAsync(query, songLimit),
      this.searchAlbumsAsync(query, albumLimit),
      this.searchArtistsAsync(query, artistLimit),
    ]);

    return { songs, albums, artists };
  }

  async getSongAsync(externalId: string): Promise<Song | null> {
    const id = this.parseExternalId(externalId);
    const data = await this.tidalGetAsync<TidalTrackSearchData>(`/info/?id=${encodeURIComponent(id)}`);
    const track = data?.items?.[0];
    return track ? this.mapSong(track, null) : null;
  }

  async getAlbumAsync(externalId: string): Promise<Album | null> {
    const id = this.parseExternalId(externalId);
    const data = await this.tidalGetAsync<TidalAlbumDetailData>(`/album/?id=${encodeURIComponent(id)}`);
    if (!data) return null;

    return {
      id: this.makeExternalId('album', data.id),
      title: data.title || 'Unknown',
      artist: data.artist?.name || 'Unknown',
      artistId: data.artist ? this.makeExternalId('artist', data.artist.id) : undefined,
      coverArtUrl: data.cover ? `https://resources.tidal.com/images/${data.cover}/1280x1280.jpg` : undefined,
      year: this.parseYear(data.releaseDate),
      duration: data.duration || 0,
      trackCount: data.numberOfTracks || data.trackCount || 0,
      isLocal: false,
      provider: 'tidal',
      externalProvider: 'tidal',
      externalId: String(data.id),
    };
  }

  async getArtistAsync(externalId: string): Promise<Artist | null> {
    const id = this.parseExternalId(externalId);
    const response = await this.tidalGetRawAsync<TidalArtistResponse>(`/artist/?id=${encodeURIComponent(id)}`);
    if (!response?.artist) return null;

    return {
      id: this.makeExternalId('artist', response.artist.id),
      name: response.artist.name || 'Unknown',
      imageUrl: response.cover?.image750 || (response.artist.picture
        ? `https://resources.tidal.com/images/${response.artist.picture}/750x750.jpg` : undefined),
      albumCount: 0,
      isLocal: false,
      provider: 'tidal',
      externalProvider: 'tidal',
      externalId: String(response.artist.id),
    };
  }

  async getArtistAlbumsAsync(externalId: string): Promise<Album[]> {
    const id = this.parseExternalId(externalId);
    const data = await this.tidalGetAsync<TidalNestedSearchData>(`/artist/?f=${encodeURIComponent(id)}&skip_tracks=true`);
    return data?.albums?.items?.map(a => this.mapAlbum(a)) || [];
  }

  async downloadTrackAsync(externalId: string, quality: string, signal?: AbortSignal): Promise<DownloadResult> {
    const id = this.parseExternalId(externalId);

    const qualityParam = quality.toLowerCase().includes('hi_res') || quality === '24bit' || quality === 'flac_24'
      ? 'HI_RES_LOSSLESS'
      : quality.toLowerCase().includes('lossless') || quality === 'hifi' || quality === '16bit' || quality === 'flac'
        ? 'LOSSLESS'
        : quality === 'high' || quality === '320'
          ? 'HIGH'
          : quality === 'low' || quality === '128'
            ? 'LOW'
            : 'HI_RES_LOSSLESS';

    const data = await this.tidalGetAsync<TidalDownloadResponseData>(
      `/track/?id=${encodeURIComponent(id)}&quality=${qualityParam}`,
      signal,
    );
    if (!data?.manifest) throw new Error('No manifest returned from Tidal');

    const manifestBytes = Buffer.from(data.manifest, 'base64');
    const manifestStr = manifestBytes.toString('utf-8');
    const mimeType = data.manifestMimeType || '';

    let streamData: Buffer;

    if (mimeType.toLowerCase().includes('dash')) {
      const url = this.dashParser.getBestQualityUrl(manifestStr);
      if (!url) throw new Error('No suitable DASH stream found');
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Tidal DASH stream download failed: ${res.status}`);
      streamData = Buffer.from(await res.arrayBuffer());
    } else {
      const btsManifest = JSON.parse(manifestStr) as TidalBtsManifest;
      const streamUrls = btsManifest.urls;
      if (!streamUrls || streamUrls.length === 0) throw new Error('No stream URLs in Tidal manifest');
      const res = await fetch(streamUrls[0], { signal });
      if (!res.ok) throw new Error(`Tidal BTS stream download failed: ${res.status}`);
      streamData = Buffer.from(await res.arrayBuffer());
    }

    const ext = qualityParam === 'HI_RES_LOSSLESS' || qualityParam === 'LOSSLESS' ? '.flac' : '.mp4';
    return { stream: streamData, fileExtension: ext, downloadedQuality: qualityParam };
  }

  async searchPlaylistsAsync(query: string, limit = 20): Promise<ExternalPlaylist[]> {
    const data = await this.tidalGetAsync<TidalNestedSearchData>(`/search/?p=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.playlists?.items?.map(p => this.mapPlaylist(p)) || [];
  }

  async getPlaylistAsync(externalId: string): Promise<ExternalPlaylist | null> {
    const id = this.parseExternalId(externalId);
    const response = await this.tidalGetRawAsync<TidalPlaylistResponse>(`/playlist/?id=${encodeURIComponent(id)}`);
    if (!response?.playlist) return null;

    const p = response.playlist;
    return {
      id: this.makeExternalId('playlist', p.uuid),
      name: p.title || 'Unknown',
      trackCount: p.numberOfTracks || p.trackCount || 0,
      duration: p.duration || 0,
      coverUrl: p.image,
      owner: p.creator?.displayName || 'Unknown',
      provider: 'tidal',
      externalId: p.uuid || '',
    };
  }

  async getPlaylistTracksAsync(externalId: string): Promise<Song[]> {
    const id = this.parseExternalId(externalId);
    const response = await this.tidalGetRawAsync<TidalPlaylistResponse>(`/playlist/?id=${encodeURIComponent(id)}`);
    return response?.items
      ?.filter(i => i.type === 'track')
      .map(i => this.mapSong(i.item, null)) || [];
  }

  async isAvailableAsync(): Promise<boolean> {
    try {
      const res = await this.instanceManager.sendWithFailoverAsync(
        instance => fetch(`${instance}/search/?s=test`, {
          headers: { 'x-client': 'BiniLossless/v3.4', 'Accept': 'application/json' },
        }),
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async tidalGetAsync<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const response = await this.instanceManager.sendWithFailoverAsync(
      instance => fetch(`${instance}${path}`, {
        headers: { 'x-client': 'BiniLossless/v3.4', 'Accept': 'application/json' },
        signal,
      }),
      signal,
    );
    if (!response.ok) return null;
    const json = await response.json() as TidalApiVersionResponse<T>;
    return json.data ?? null;
  }

  private async tidalGetRawAsync<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const response = await this.instanceManager.sendWithFailoverAsync(
      instance => fetch(`${instance}${path}`, {
        headers: { 'x-client': 'BiniLossless/v3.4', 'Accept': 'application/json' },
        signal,
      }),
      signal,
    );
    if (!response.ok) return null;
    return response.json() as T;
  }

  private async searchTracksAsync(query: string, limit: number): Promise<Song[]> {
    const data = await this.tidalGetAsync<TidalTrackSearchData>(`/search/?s=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.items?.map(t => this.mapSong(t, null)) || [];
  }

  private async searchAlbumsAsync(query: string, limit: number): Promise<Album[]> {
    const data = await this.tidalGetAsync<TidalNestedSearchData>(`/search/?al=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.albums?.items?.map(a => this.mapAlbum(a)) || [];
  }

  private async searchArtistsAsync(query: string, limit: number): Promise<Artist[]> {
    const data = await this.tidalGetAsync<TidalNestedSearchData>(`/search/?a=${encodeURIComponent(query)}&limit=${limit}`);
    return data?.artists?.items?.map(a => this.mapArtist(a)) || [];
  }

  private makeExternalId(type: string, id: any): string {
    return `ext-tidal-${type}-${id}`;
  }

  private parseExternalId(externalId: string): string {
    const parts = externalId.split('-', 4);
    return parts.length >= 4 ? parts[3] : externalId;
  }

  private mapSong(track: TidalTrack | null | undefined, _albumContext: TidalAlbum | null): Song {
    if (!track) return { id: '', title: 'Unknown', artist: 'Unknown', album: 'Unknown', track: 0, trackNumber: 0, discNumber: 0, duration: 0, isLocal: false, provider: 'tidal' };
    const album = _albumContext || track.album;
    return {
      id: this.makeExternalId('song', track.id),
      title: track.title || 'Unknown',
      artist: track.artist?.name || 'Unknown',
      album: album?.title || 'Unknown',
      albumId: album ? this.makeExternalId('album', album.id) : undefined,
      artistId: track.artist ? this.makeExternalId('artist', track.artist.id) : undefined,
      track: track.trackNumber || 0,
      trackNumber: track.trackNumber || 0,
      discNumber: track.volumeNumber || track.discNumber || 0,
      duration: track.duration || 0,
      coverArtUrl: album?.cover ? `https://resources.tidal.com/images/${album.cover}/1280x1280.jpg` : undefined,
      isrc: track.isrc,
      copyright: track.copyright,
      isExplicit: track.explicit,
      sampleRate: track.sampleRate && track.sampleRate > 0 ? track.sampleRate : undefined,
      bitDepth: track.bitDepth && track.bitDepth > 0 ? track.bitDepth : undefined,
      isLocal: false,
      provider: 'tidal',
      externalProvider: 'tidal',
      externalId: String(track.id),
    };
  }

  private mapAlbum(album: TidalAlbum | null | undefined): Album {
    if (!album) return { id: '', title: 'Unknown', artist: 'Unknown', duration: 0, isLocal: false, provider: 'tidal' };
    return {
      id: this.makeExternalId('album', album.id),
      title: album.title || 'Unknown',
      artist: album.artist?.name || 'Unknown',
      artistId: album.artist ? this.makeExternalId('artist', album.artist.id) : undefined,
      coverArtUrl: album.cover ? `https://resources.tidal.com/images/${album.cover}/1280x1280.jpg` : undefined,
      year: this.parseYear(album.releaseDate),
      duration: album.duration || 0,
      trackCount: album.numberOfTracks || album.trackCount || 0,
      isExplicit: album.explicit,
      description: album.description,
      isLocal: false,
      provider: 'tidal',
      externalProvider: 'tidal',
      externalId: String(album.id),
    };
  }

  private mapArtist(artist: TidalArtist | null | undefined): Artist {
    if (!artist) return { id: '', name: 'Unknown', albumCount: 0, isLocal: false, provider: 'tidal' };
    return {
      id: this.makeExternalId('artist', artist.id),
      name: artist.name || 'Unknown',
      imageUrl: artist.picture ? `https://resources.tidal.com/images/${artist.picture}/750x750.jpg` : undefined,
      albumCount: artist.albumCount || 0,
      isLocal: false,
      provider: 'tidal',
      externalProvider: 'tidal',
      externalId: String(artist.id),
    };
  }

  private mapPlaylist(playlist: TidalPlaylist | null | undefined): ExternalPlaylist {
    if (!playlist) return { id: '', name: 'Unknown', provider: 'tidal', externalId: '', trackCount: 0 };
    return {
      id: this.makeExternalId('playlist', playlist.uuid),
      name: playlist.title || 'Unknown',
      description: playlist.description,
      owner: playlist.creator?.displayName || 'Unknown',
      trackCount: playlist.numberOfTracks || playlist.trackCount || 0,
      duration: playlist.duration || 0,
      coverUrl: playlist.image,
      url: playlist.url,
      isPublic: playlist.publicPlaylist,
      provider: 'tidal',
      externalId: playlist.uuid || '',
    };
  }

  private parseYear(date?: string): number | undefined {
    if (!date) return undefined;
    const d = new Date(date);
    return isNaN(d.getTime()) ? undefined : d.getFullYear();
  }
}
