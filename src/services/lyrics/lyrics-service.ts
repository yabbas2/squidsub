import { Song, SongLyrics } from '../../models/song.js';
import { getConfig } from '../../config/settings.js';

export class LrclibLyricsService {
  readonly enabled: boolean;

  private baseUrl: string;
  private cache = new Map<string, { result: SongLyrics | null; expiresAt: number }>();
  private negativeCache = new Map<string, { expiresAt: number }>();

  constructor() {
    const config = getConfig();
    this.enabled = config.LYRICS__ENABLED;
    this.baseUrl = config.LYRICS__LRCLIB_BASE_URL;
  }

  async getLyricsAsync(song: Song, signal?: AbortSignal): Promise<SongLyrics | null> {
    if (!this.enabled) return null;

    const cacheKey = `${song.artist}|${song.title}|${song.duration}`;

    // Check positive cache (6h)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.result;

    // Check negative cache (10min)
    const negCached = this.negativeCache.get(cacheKey);
    if (negCached && Date.now() < negCached.expiresAt) return null;

    try {
      // Try exact match first
      const params = new URLSearchParams({
        artist_name: song.artist,
        track_name: song.title,
        duration: String(Math.round(song.duration)),
      });

      const res = await fetch(`${this.baseUrl}/api/get?${params}`, { signal });
      if (res.ok) {
        const data = await res.json() as any;
        const lyrics = this.parseLrclibResponse(data);
        if (lyrics) {
          this.cache.set(cacheKey, { result: lyrics, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
          return lyrics;
        }
      }

      // Try search fallback
      const searchParams = new URLSearchParams({
        track_name: song.title,
        artist_name: song.artist,
      });
      const searchRes = await fetch(`${this.baseUrl}/api/search?${searchParams}`, { signal });
      if (searchRes.ok) {
        const results = await searchRes.json() as any[];
        if (Array.isArray(results) && results.length > 0) {
          // Score by duration match
          const scored = results
            .map((r: any) => ({
              item: r,
              score: r.duration ? Math.abs(r.duration - Math.round(song.duration)) : 999,
            }))
            .sort((a: any, b: any) => a.score - b.score);

          const best = scored[0];
          if (best.score <= 3) {
            const lyrics = this.parseLrclibResponse(best.item);
            if (lyrics) {
              this.cache.set(cacheKey, { result: lyrics, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
              return lyrics;
            }
          }
        }
      }

      this.negativeCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000 });
      return null;
    } catch {
      this.negativeCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000 });
      return null;
    }
  }

  async tryWriteSidecarAsync(audioFilePath: string, song: Song): Promise<void> {
    const config = getConfig();
    if (!config.LYRICS__WRITE_LRC_FILE) return;

    const lrcPath = audioFilePath.replace(/\.[^/.]+$/, '.lrc');
    const lyrics = await this.getLyricsAsync(song);
    if (!lyrics) return;

    const lines = lyrics.lines.map(l => {
      const ms = l.startMs;
      const min = Math.floor(ms / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      const cent = Math.floor((ms % 1000) / 10);
      return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cent).padStart(2, '0')}]${l.text}`;
    });

    const content = `#${lyrics.displayTitle || song.title}\n#${lyrics.displayArtist || song.artist}\n${lines.join('\n')}`;
    await fs.promises.writeFile(lrcPath, content, 'utf-8');
  }

  private parseLrclibResponse(data: any): SongLyrics | null {
    if (!data) return null;

    const synced = data.synced && Array.isArray(data.syncedLyrics);

    if (synced) {
      return {
        synced: true,
        displayArtist: data.artistName,
        displayTitle: data.trackName,
        lang: data.language || 'eng',
        offset: 0,
        lines: data.syncedLyrics.map((line: string) => {
          const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
          if (match) {
            const mins = parseInt(match[1], 10);
            const secs = parseInt(match[2], 10);
            const ms = parseInt(match[3], 10) * 10;
            return { startMs: mins * 60000 + secs * 1000 + ms, text: (match[4] || '').trim() };
          }
          return { startMs: 0, text: line };
        }),
      };
    }

    // Fallback to plain lyrics
    if (data.plainLyrics) {
      return {
        synced: false,
        displayArtist: data.artistName,
        displayTitle: data.trackName,
        lang: data.language || 'eng',
        offset: 0,
        lines: data.plainLyrics.split('\n').filter((l: string) => l.trim()).map((l: string) => ({
          startMs: 0,
          text: l.trim(),
        })),
      };
    }

    return null;
  }
}

import fs from 'node:fs';
