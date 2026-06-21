import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { Song, Album, Artist, SongLyrics, LyricLine } from '../../models/song.js';

const XML_NS = 'http://subsonic.org/restapi';
const VERSION = '1.16.1';

const xmlBuilder = new XMLBuilder({
  format: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressBooleanAttributes: false,
});

function detectFormat(urlOrFormat: string): 'xml' | 'json' {
  if (urlOrFormat === 'json' || urlOrFormat.includes('f=json') || (urlOrFormat !== 'xml' && !urlOrFormat.includes('f=xml') && urlOrFormat.includes('json'))) return 'json';
  return 'xml';
}

function okResponseData(elementName: string, data: Record<string, unknown>) {
  return {
    status: 'ok',
    version: VERSION,
    [elementName]: data,
  };
}

function errorResponseData(code: number, message: string) {
  return {
    status: 'failed',
    version: VERSION,
    error: { code, message },
  };
}

function wrapJson(payload: Record<string, unknown>): Record<string, unknown> {
  return { 'subsonic-response': payload };
}

function wrapXml(payload: Record<string, unknown>): string {
  // Build XML manually for the wrapper
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<subsonic-response xmlns="${XML_NS}" status="${payload.status}" version="${VERSION}">\n`;

  if (payload.error) {
    const e = payload.error as any;
    xml += `  <error code="${e.code}" message="${escapeXml(e.message)}"/>\n`;
  } else {
    // Find the data element (everything except status and version)
    const dataKey = Object.keys(payload).find(k => k !== 'status' && k !== 'version');
    if (dataKey) {
      xml += `  ${buildXmlElement(dataKey, (payload as any)[dataKey], 2)}\n`;
    }
  }

  xml += `</subsonic-response>`;
  return xml;
}

function buildXmlElement(name: string, value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return `${pad}<${name}/>`;
  }

  if (Array.isArray(value)) {
    return value.map(v => buildXmlElement(name, v, indent)).join('\n');
  }

  if (typeof value === 'object') {
    const entries = value as Record<string, unknown>;
    let attrs = '';
    let children = '';

    for (const [k, v] of Object.entries(entries)) {
      if (k.startsWith('@_')) {
        attrs += ` ${k.slice(2)}="${escapeXml(String(v))}"`;
      } else if (k === '#text') {
        // handled as text content
      } else {
        children += `\n${buildXmlElement(k, v, indent + 1)}`;
      }
    }

    if (entries['#text'] !== undefined) {
      return `${pad}<${name}${attrs}>${escapeXml(String(entries['#text']))}</${name}>`;
    }

    if (!children.trim()) {
      return `${pad}<${name}${attrs}/>`;
    }

    return `${pad}<${name}${attrs}>${children}\n${pad}</${name}>`;
  }

  return `${pad}<${name}>${escapeXml(String(value))}</${name}>`;
}

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// --- Song conversion ---

export function convertSongToJson(song: Song): Record<string, unknown> {
  return {
    id: song.id,
    parent: song.albumId || undefined,
    title: song.title,
    artist: song.artist,
    album: song.album,
    albumId: song.albumId || undefined,
    artistId: song.artistId || undefined,
    track: song.track || undefined,
    year: song.year || undefined,
    genre: song.genre || undefined,
    coverArt: song.coverArt || song.coverArtUrl || undefined,
    size: undefined,
    contentType: undefined,
    suffix: song.id?.includes('ext-') ? undefined : undefined,
    duration: song.duration || undefined,
    bitRate: undefined,
    isDir: false,
    isVideo: false,
    playCount: undefined,
    created: undefined,
    albumArtist: song.albumArtist || undefined,
    ...(song.isExplicit !== undefined ? { isExplicit: song.isExplicit } : {}),
    ...(song.isrc ? { isrc: song.isrc } : {}),
    ...(song.discNumber ? { discNumber: song.discNumber } : {}),
  };
}

export function convertSongToXml(song: Song): string {
  let xml = `<song id="${escapeXml(song.id)}"`;
  xml += ` parent="${escapeXml(song.albumId || '')}"`;
  xml += ` title="${escapeXml(song.title)}"`;
  xml += ` artist="${escapeXml(song.artist)}"`;
  xml += ` album="${escapeXml(song.album)}"`;
  xml += ` albumId="${escapeXml(song.albumId || '')}"`;
  xml += ` artistId="${escapeXml(song.artistId || '')}"`;
  xml += ` track="${song.track || 0}"`;
  if (song.year) xml += ` year="${song.year}"`;
  if (song.genre) xml += ` genre="${escapeXml(song.genre)}"`;
  if (song.coverArt || song.coverArtUrl) xml += ` coverArt="${escapeXml(song.coverArt || song.coverArtUrl || '')}"`;
  xml += ` duration="${song.duration || 0}"`;
  xml += ` isDir="false"`;
  xml += ` isVideo="false"`;
  if (song.albumArtist) xml += ` albumArtist="${escapeXml(song.albumArtist)}"`;
  if (song.isExplicit !== undefined) xml += ` isExplicit="${song.isExplicit}"`;
  if (song.isrc) xml += ` isrc="${escapeXml(song.isrc)}"`;
  if (song.discNumber) xml += ` discNumber="${song.discNumber}"`;
  xml += `/>`;
  return xml;
}

// --- Album conversion ---

export function convertAlbumToJson(album: Album): Record<string, unknown> {
  return {
    id: album.id,
    name: album.title,
    artist: album.artist,
    artistId: album.artistId || undefined,
    coverArt: album.coverArt || album.coverArtUrl || undefined,
    songCount: album.songCount || album.trackCount || 0,
    duration: album.duration || 0,
    year: album.year || undefined,
    genre: album.genre || undefined,
    created: undefined,
    isDir: true,
    ...(album.isExplicit ? { isExplicit: true } : {}),
  };
}

export function convertAlbumToXml(album: Album): string {
  let xml = `<album id="${escapeXml(album.id)}"`;
  xml += ` name="${escapeXml(album.title)}"`;
  xml += ` artist="${escapeXml(album.artist)}"`;
  if (album.artistId) xml += ` artistId="${escapeXml(album.artistId)}"`;
  if (album.coverArt || album.coverArtUrl) xml += ` coverArt="${escapeXml(album.coverArt || album.coverArtUrl || '')}"`;
  xml += ` songCount="${album.songCount || album.trackCount || 0}"`;
  xml += ` duration="${album.duration || 0}"`;
  if (album.year) xml += ` year="${album.year}"`;
  if (album.genre) xml += ` genre="${escapeXml(album.genre)}"`;
  xml += ` isDir="true"`;
  if (album.isExplicit) xml += ` isExplicit="true"`;
  xml += `/>`;
  return xml;
}

// --- Artist conversion ---

export function convertArtistToJson(artist: Artist): Record<string, unknown> {
  return {
    id: artist.id,
    name: artist.name,
    albumCount: artist.albumCount,
    coverArt: artist.imageUrl || undefined,
    ...(artist.imageUrl ? { artistImageUrl: artist.imageUrl } : {}),
  };
}

export function convertArtistToXml(artist: Artist): string {
  let xml = `<artist id="${escapeXml(artist.id)}"`;
  xml += ` name="${escapeXml(artist.name)}"`;
  xml += ` albumCount="${artist.albumCount}"`;
  if (artist.imageUrl) xml += ` coverArt="${escapeXml(artist.imageUrl)}"`;
  if (artist.imageUrl) xml += ` artistImageUrl="${escapeXml(artist.imageUrl)}"`;
  xml += `/>`;
  return xml;
}

// --- Responses ---

export function createResponse(
  formatOrUrl: string,
  elementName: string,
  data: Record<string, unknown>,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const payload = okResponseData(elementName, data);

  if (format === 'json') {
    return wrapJson(payload);
  }

  return wrapXml(payload);
}

export function createError(
  formatOrUrl: string,
  code: number,
  message: string,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const payload = errorResponseData(code, message);

  if (format === 'json') {
    return wrapJson(payload);
  }

  return wrapXml(payload);
}

export function createSongResponse(
  formatOrUrl: string,
  song: Song,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  if (format === 'json') {
    return wrapJson(okResponseData('song', convertSongToJson(song)));
  }
  return wrapXml({ status: 'ok', version: VERSION, song: convertSongToXml(song) });
}

export function createLyricsResponse(
  formatOrUrl: string,
  lyrics: SongLyrics | null,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const lyricsList: Record<string, unknown> = { structuredLyrics: [] };

  if (lyrics) {
    const entry: Record<string, unknown> = {
      displayArtist: lyrics.displayArtist || '',
      displayTitle: lyrics.displayTitle || '',
      lang: lyrics.lang || 'eng',
      offset: lyrics.offset || 0,
      synced: lyrics.synced,
      line: lyrics.lines.map(l => ({
        start: l.startMs,
        value: l.text,
      })),
    };
    lyricsList.structuredLyrics = [entry];
  }

  if (format === 'json') {
    return wrapJson(okResponseData('lyricsList', lyricsList));
  }

  // XML lyrics response
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<subsonic-response xmlns="${XML_NS}" status="ok" version="${VERSION}">\n`;
  xml += `  <lyricsList>\n`;

  if (lyrics) {
    xml += `    <structuredLyrics displayArtist="${escapeXml(lyrics.displayArtist || '')}" displayTitle="${escapeXml(lyrics.displayTitle || '')}" lang="${escapeXml(lyrics.lang || 'eng')}" offset="${lyrics.offset || 0}" synced="${lyrics.synced}">\n`;
    for (const line of lyrics.lines) {
      xml += `      <line start="${line.startMs}">${escapeXml(line.text)}</line>\n`;
    }
    xml += `    </structuredLyrics>\n`;
  }

  xml += `  </lyricsList>\n`;
  xml += `</subsonic-response>`;
  return xml;
}

export function createTranscodeDecisionResponse(
  formatOrUrl: string,
  song: Song,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const decision = {
    canDirectPlay: true,
    canTranscode: false,
    sourceStream: {
      protocol: 'http',
      container: song.id?.includes('ext-') ? 'raw' : 'mp3',
      codec: 'mp3',
      audioChannels: 2,
      audioBitrate: 128000,
    },
  };

  const payload = {
    ...okResponseData('transcodeDecision', decision),
    openSubsonic: true,
  };

  if (format === 'json') {
    return wrapJson(payload);
  }

  // XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<subsonic-response xmlns="${XML_NS}" status="ok" version="${VERSION}" openSubsonic="true">\n`;
  xml += `  <transcodeDecision canDirectPlay="true" canTranscode="false">\n`;
  xml += `    <sourceStream protocol="http" container="raw" codec="mp3" audioChannels="2" audioBitrate="128000"/>\n`;
  xml += `  </transcodeDecision>\n`;
  xml += `</subsonic-response>`;
  return xml;
}

export function createAlbumResponse(
  formatOrUrl: string,
  album: Album,
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const jsonAlbum = convertAlbumToJson(album);
  const songs = album.songs?.map(s => convertSongToJson(s)) || [];

  if (format === 'json') {
    return wrapJson(okResponseData('album', { ...jsonAlbum, song: songs }));
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<subsonic-response xmlns="${XML_NS}" status="ok" version="${VERSION}">\n`;
  // Build album XML tag with attributes
  xml += `  <album id="${escapeXml(album.id)}" name="${escapeXml(album.title)}" artist="${escapeXml(album.artist)}"`;
  if (album.artistId) xml += ` artistId="${escapeXml(album.artistId)}"`;
  if (album.coverArt || album.coverArtUrl) xml += ` coverArt="${escapeXml(album.coverArt || album.coverArtUrl || '')}"`;
  xml += ` songCount="${album.songCount || album.trackCount || 0}" duration="${album.duration || 0}"`;
  if (album.year) xml += ` year="${album.year}"`;
  if (album.genre) xml += ` genre="${escapeXml(album.genre)}"`;
  xml += ` isDir="true"`;
  if (album.isExplicit) xml += ` isExplicit="true"`;
  xml += `>\n`;
  for (const song of songs) {
    xml += `    ${convertSongToXml(song as any)}\n`;
  }
  xml += `  </album>\n`;
  xml += `</subsonic-response>`;
  return xml;
}

export function createArtistResponse(
  formatOrUrl: string,
  artist: Artist,
  albums: Album[],
): string | Record<string, unknown> {
  const format = detectFormat(formatOrUrl);
  const jsonArtist = convertArtistToJson(artist);
  const jsonAlbums = albums.map(a => convertAlbumToJson(a));

  if (format === 'json') {
    return wrapJson(okResponseData('artist', { ...jsonArtist, album: jsonAlbums }));
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<subsonic-response xmlns="${XML_NS}" status="ok" version="${VERSION}">\n`;
  xml += `  <artist id="${escapeXml(artist.id)}" name="${escapeXml(artist.name)}" albumCount="${artist.albumCount}"`;
  if (artist.imageUrl) xml += ` coverArt="${escapeXml(artist.imageUrl)}" artistImageUrl="${escapeXml(artist.imageUrl)}"`;
  xml += `>\n`;
  for (const a of albums) {
    xml += `    ${convertAlbumToXml(a)}\n`;
  }
  xml += `  </artist>\n`;
  xml += `</subsonic-response>`;
  return xml;
}
