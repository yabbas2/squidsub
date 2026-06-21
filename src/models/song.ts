export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: number;
  track: number;
  trackNumber: number;
  discNumber: number;
  year?: number;
  genre?: string;
  coverArtUrl?: string;
  coverArt?: string;
  isrc?: string;
  isExplicit?: boolean;
  isLocal: boolean;
  provider?: string;
  externalProvider?: string;
  externalId?: string;
  localPath?: string;
  albumArtist?: string;
  composer?: string;
  label?: string;
  copyright?: string;
  sampleRate?: number;
  bitDepth?: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: number;
  songCount?: number;
  trackCount?: number;
  duration?: number;
  releaseType?: string;
  coverArtUrl?: string;
  coverArt?: string;
  genre?: string;
  description?: string;
  isLocal: boolean;
  externalProvider?: string;
  externalId?: string;
  provider?: string;
  songs?: Song[];
  isExplicit?: boolean;
}

export interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  albumCount: number;
  biography?: string;
  isLocal: boolean;
  externalProvider?: string;
  externalId?: string;
  provider?: string;
}

export interface SongLyrics {
  displayArtist?: string;
  displayTitle?: string;
  lang?: string;
  offset?: number;
  synced: boolean;
  lines: LyricLine[];
}

export interface LyricLine {
  startMs: number;
  text: string;
}
