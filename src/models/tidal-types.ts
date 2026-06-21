export interface TidalApiVersionResponse<T> {
  version?: string;
  data?: T;
}

export interface TidalTrackSearchData {
  limit?: number;
  offset?: number;
  totalNumberOfItems?: number;
  items?: TidalTrack[];
}

export interface TidalNestedSearchData {
  albums?: TidalSearchCategory<TidalAlbum>;
  artists?: TidalSearchCategory<TidalArtist>;
  playlists?: TidalSearchCategory<TidalPlaylist>;
}

export interface TidalSearchCategory<T> {
  limit?: number;
  offset?: number;
  totalNumberOfItems?: number;
  items?: T[];
}

export interface TidalTrack {
  id: number | string;
  title?: string;
  artist?: TidalArtist;
  artists?: TidalArtist[];
  album?: TidalAlbum;
  duration?: number;
  trackNumber?: number;
  volumeNumber?: number;
  discNumber?: number;
  isrc?: string;
  copyright?: string;
  explicit?: boolean;
  audioQuality?: string;
  sampleRate?: number;
  bitDepth?: number;
}

export interface TidalAlbum {
  id: number | string;
  title?: string;
  artist?: TidalArtist;
  artists?: TidalArtist[];
  cover?: string;
  releaseDate?: string;
  duration?: number;
  numberOfTracks?: number;
  trackCount?: number;
  volumeCount?: number;
  explicit?: boolean;
  audioQuality?: string;
  description?: string;
  tracks?: TidalItemsList<TidalTrack>;
}

export interface TidalArtist {
  id: number | string;
  name?: string;
  picture?: string;
  artistTypes?: string[];
  albumCount?: number;
  biography?: TidalBiography;
  similar?: TidalArtist[];
  albums?: TidalItemsList<TidalAlbum>;
}

export interface TidalPlaylist {
  uuid?: string;
  title?: string;
  description?: string;
  created?: string;
  creator?: TidalCreator;
  numberOfTracks?: number;
  trackCount?: number;
  duration?: number;
  image?: string;
  publicPlaylist?: boolean;
  url?: string;
  tracks?: TidalItemsList<TidalTrack>;
}

export interface TidalItemsList<T> {
  items?: T[];
  totalNumberOfItems?: number;
  total?: number;
}

export interface TidalCreator {
  id?: number | string;
  displayName?: string;
}

export interface TidalBiography {
  text?: string;
  source?: string;
  summary?: string;
}

export interface TidalDownloadResponseData {
  trackId?: number;
  assetPresentation?: string;
  audioQuality?: string;
  manifest?: string;
  manifestMimeType?: string;
}

export interface TidalBtsManifest {
  mimeType?: string;
  codecs?: string;
  urls?: string[];
}

export interface TidalAlbumDetailData {
  id?: number | string;
  title?: string;
  artist?: TidalArtist;
  cover?: string;
  releaseDate?: string;
  duration?: number;
  numberOfTracks?: number;
  trackCount?: number;
  type?: string;
  items?: TidalAlbumEntry[];
}

export interface TidalAlbumEntry {
  item?: TidalTrack;
  type?: string;
}

export interface TidalArtistResponseData {
  id?: number | string;
  name?: string;
  picture?: string;
  artistTypes?: string[];
  popularity?: number;
}

export interface TidalArtistResponse {
  version?: string;
  artist?: TidalArtistResponseData;
  cover?: TidalCover;
}

export interface TidalCover {
  id?: number | string;
  name?: string;
  '750'?: string;
  image750?: string;
}

export interface TidalPlaylistResponseData {
  uuid?: string;
  title?: string;
  numberOfTracks?: number;
  trackCount?: number;
  duration?: number;
  image?: string;
  squareImage?: string;
  creator?: TidalCreator;
  items?: TidalAlbumEntry[];
}

export interface TidalPlaylistResponse {
  version?: string;
  playlist?: TidalPlaylistResponseData;
  items?: TidalAlbumEntry[];
}
