import { SearchResult } from '../../models/search-result.js';
import { Song, Album, Artist } from '../../models/song.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { SquidWTFProviderFactory } from '../providers/factory.js';
import { makeExternalId } from '../../utils/id-helper.js';

export class SquidWTFMetadataService {
  private factory: SquidWTFProviderFactory;

  constructor(factory: SquidWTFProviderFactory) {
    this.factory = factory;
  }

  async searchAllAsync(query: string, songLimit = 20, albumLimit = 20, artistLimit = 20): Promise<SearchResult> {
    const provider = this.factory.getProvider();
    return provider.searchAllAsync(query, songLimit, albumLimit, artistLimit);
  }

  async searchArtistsAsync(query: string, limit = 20): Promise<Artist[]> {
    const result = await this.searchAllAsync(query, 0, 0, limit);
    return result.artists;
  }

  async searchAlbumsAsync(query: string, limit = 20): Promise<Album[]> {
    const result = await this.searchAllAsync(query, 0, limit, 0);
    return result.albums;
  }

  async getSongAsync(provider: string, externalId: string): Promise<Song | null> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'song', externalId);
    return p.getSongAsync(fullId);
  }

  async getAlbumAsync(provider: string, externalId: string): Promise<Album | null> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'album', externalId);
    return p.getAlbumAsync(fullId);
  }

  async getArtistAsync(provider: string, externalId: string): Promise<Artist | null> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'artist', externalId);
    return p.getArtistAsync(fullId);
  }

  async getArtistAlbumsAsync(provider: string, externalId: string): Promise<Album[]> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'artist', externalId);
    return p.getArtistAlbumsAsync(fullId);
  }

  async searchPlaylistsAsync(query: string, limit = 20): Promise<ExternalPlaylist[]> {
    const provider = this.factory.getProvider();
    return provider.searchPlaylistsAsync(query, limit);
  }

  async getPlaylistAsync(provider: string, externalId: string): Promise<ExternalPlaylist | null> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'playlist', externalId);
    return p.getPlaylistAsync(fullId);
  }

  async getPlaylistTracksAsync(provider: string, externalId: string): Promise<Song[]> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'playlist', externalId);
    return p.getPlaylistTracksAsync(fullId);
  }
}
