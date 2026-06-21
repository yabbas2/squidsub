import { Song, Album, Artist } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';

export interface DownloadResult {
  stream: Buffer;
  fileExtension: string;
  downloadedQuality?: string;
}

export interface ISquidWTFProvider {
  readonly name: string;
  readonly baseUrl: string;
  readonly externalIdPrefix: string;
  readonly supportsPlaylists: boolean;

  searchAllAsync(query: string, songLimit?: number, albumLimit?: number, artistLimit?: number): Promise<SearchResult>;
  getSongAsync(externalId: string): Promise<Song | null>;
  getAlbumAsync(externalId: string): Promise<Album | null>;
  getArtistAsync(externalId: string): Promise<Artist | null>;
  getArtistAlbumsAsync(externalId: string): Promise<Album[]>;
  downloadTrackAsync(externalId: string, quality: string, signal?: AbortSignal): Promise<DownloadResult>;
  searchPlaylistsAsync(query: string, limit?: number): Promise<ExternalPlaylist[]>;
  getPlaylistAsync(externalId: string): Promise<ExternalPlaylist | null>;
  getPlaylistTracksAsync(externalId: string): Promise<Song[]>;
  isAvailableAsync(): Promise<boolean>;
}
