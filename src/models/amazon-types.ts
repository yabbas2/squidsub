export interface AmazonSearchResponse {
  trackList?: AmazonSearchTrack[];
}

export interface AmazonSearchTrack {
  asin?: string;
  title?: string;
  primaryArtistName?: string;
  artistName?: string;
  albumArtistName?: string;
  album?: AmazonSearchAlbum;
}

export interface AmazonSearchAlbum {
  title?: string;
  id?: string;
  image?: string;
}

export interface AmazonTrackMetadataResponse {
  metadata?: AmazonTrackMetadata;
}

export interface AmazonTrackMetadata {
  asin?: string;
  title?: string;
  artist?: string;
  album?: string;
  album_asin?: string;
  album_artist?: string;
  cover?: string;
  year?: string;
  date?: string;
  track_number?: string;
  disc_number?: string;
  disc_total?: string;
  track_total?: string;
  genre?: string;
  isrc?: string;
  is_explicit?: boolean;
  duration?: number;
}

export interface AmazonDownloadPrepareResponse {
  directUrl?: string;
}

export interface AmazonDownloadStartResponse {
  job_id?: string;
}

export interface AmazonDownloadStatusResponse {
  status?: string;
  directUrl?: string;
  token?: string;
  filename?: string;
  error?: string;
  elapsed_seconds?: number;
}
