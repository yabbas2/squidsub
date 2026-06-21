const ID_RE = /^ext-([a-z]+)-([a-z]+)-(.+)$/;
const SONG_ID_RE = /^ext-([a-z]+)-(.+)$/;
const PLAYLIST_ID_RE = /^pl-([a-z]+)-(.+)$/;

export function parseSongId(id: string): { isExternal: boolean; provider: string | null; externalId: string | null } {
  const m = id.match(SONG_ID_RE);
  if (m) return { isExternal: true, provider: m[1], externalId: m[2] };
  return { isExternal: false, provider: null, externalId: null };
}

export function parseExternalId(id: string): { isExternal: boolean; provider: string | null; type: string | null; externalId: string | null } {
  const m = id.match(ID_RE);
  if (m) return { isExternal: true, provider: m[1], type: m[2], externalId: m[3] };
  // Try as song ID
  const sm = id.match(SONG_ID_RE);
  if (sm) return { isExternal: true, provider: sm[1], type: 'song', externalId: sm[2] };
  return { isExternal: false, provider: null, type: null, externalId: null };
}

export function makeExternalId(provider: string, type: string, id: string): string {
  return `ext-${provider}-${type}-${id}`;
}

export function makePlaylistId(provider: string, id: string): string {
  return `pl-${provider}-${id}`;
}

export function isExternalPlaylist(id: string): boolean {
  return PLAYLIST_ID_RE.test(id);
}

export function parsePlaylistId(id: string): { provider: string | null; externalId: string | null } {
  const m = id.match(PLAYLIST_ID_RE);
  if (m) return { provider: m[1], externalId: m[2] };
  return { provider: null, externalId: null };
}
