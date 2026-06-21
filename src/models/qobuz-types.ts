export interface SquidWTFResponse<T> {
  success: boolean;
  data?: T;
}

export interface SquidWTFQobuzSearchData {
  albums?: QobuzItemsList<QobuzAlbum>;
  artists?: QobuzItemsList<QobuzArtist>;
  tracks?: QobuzItemsList<QobuzTrack>;
}

export interface SquidWTFQobuzArtistData {
  artist?: QobuzArtist;
}

export interface SquidWTFQobuzDownloadData {
  url?: string;
}

export interface QobuzItemsList<T> {
  items?: T[];
  limit?: number;
  offset?: number;
  total?: number;
}

export interface QobuzAlbum {
  id?: string;
  title?: string;
  artist?: QobuzArtist;
  artists?: QobuzArtist[];
  image?: QobuzImage;
  release_date_original?: string;
  duration?: number;
  tracks_count?: number;
  genres_list?: QobuzGenre[];
  tracks?: QobuzItemsList<QobuzTrack>;
  parental_warning?: boolean;
  catchline?: string;
  maximum_bit_depth?: number;
  maximum_sampling_rate?: number;
  product_url?: string;
}

export interface QobuzArtist {
  id?: string;
  name?: string;
  image?: QobuzImage;
  picture?: string;
  albums_count?: number;
  biography?: QobuzBiography;
  albums?: QobuzItemsList<QobuzAlbum>;
  similar_artists?: QobuzArtist[];
}

export interface QobuzTrack {
  id?: string;
  title?: string;
  artist?: QobuzArtist;
  artists?: QobuzArtist[];
  album?: QobuzAlbum;
  image?: QobuzImage;
  duration?: number;
  track_number?: number;
  disc_number?: number;
  genre?: QobuzGenre;
  parental_warning?: boolean;
  maximum_bit_depth?: number;
  maximum_sampling_rate?: number;
  copyright?: string;
  performers?: string;
  isrc?: string;
  release_date_original?: string;
}

export interface QobuzImage {
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  back?: string;
}

export interface QobuzGenre {
  id?: number;
  name?: string;
  slug?: string;
}

export interface QobuzBiography {
  content?: string;
  source?: string;
}
