import { getConfig } from '../../config/settings.js';
import { Song, Album } from '../../models/song.js';
import { SearchResult } from '../../models/search-result.js';
import { ExternalPlaylist } from '../../models/subsonic-types.js';
import { parseSongId, parseExternalId, makeExternalId } from '../../utils/id-helper.js';
import { getOutputDirectory, getOutputPath } from '../../utils/path-helper.js';
import { SquidWTFProviderFactory } from '../providers/factory.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export class BaseDownloadService {
  private factory = new SquidWTFProviderFactory();

  async downloadAndStreamAsync(
    provider: string,
    externalId: string,
    signal?: AbortSignal,
  ): Promise<{ stream: Buffer; filePath: string }> {
    const searchResult = await this.searchForSong(provider, externalId);

    if (!searchResult) {
      throw new Error('Track not found');
    }

    const { song, fullId } = searchResult;

    // Check if file already exists on disk
    const outputDir = getOutputDirectory(song);
    const knownExts = ['.flac', '.mp3', '.m4a', '.ogg', '.wav', '.aac'];
    for (const ext of knownExts) {
      const existing = getOutputPath(song, outputDir, ext);
      if (fs.existsSync(existing)) {
        return { stream: fs.readFileSync(existing), filePath: existing };
      }
    }

    // Download
    const p = this.factory.getProvider();
    const config = getConfig();
    const quality = config.SQUIDWTF__QUALITY || 'lossless';
    const downloadResult = await p.downloadTrackAsync(fullId, quality, signal);

    const finalPath = getOutputPath(song, outputDir, downloadResult.fileExtension);

    // Ensure directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Write file
    fs.writeFileSync(finalPath, downloadResult.stream);

    // Write tags via ffmpeg
    try {
      await this.writeTagsAsync(finalPath, song);
    } catch (err) {
      // Non-critical
    }

    return { stream: fs.readFileSync(finalPath), filePath: finalPath };
  }

  async downloadTrackAsync(trackId: string, quality?: string): Promise<string | null> {
    const { isExternal, provider, externalId } = parseSongId(trackId);
    if (!isExternal || !provider || !externalId) return null;

    try {
      const result = await this.downloadAndStreamAsync(provider, externalId);
      return result.filePath;
    } catch {
      return null;
    }
  }

  async permanentizeCachedSongAsync(provider: string, externalId: string): Promise<boolean> {
    try {
      await this.downloadAndStreamAsync(provider, externalId);
      return true;
    } catch {
      return false;
    }
  }

  private async searchForSong(provider: string, externalId: string): Promise<{ song: Song; fullId: string } | null> {
    const p = this.factory.getProvider();
    const fullId = makeExternalId(provider, 'song', externalId);
    const song = await p.getSongAsync(fullId);
    if (!song) return null;
    return { song, fullId };
  }

  private async writeTagsAsync(filePath: string, song: Song): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    // Use ffmpeg to write metadata tags (-codec copy to avoid re-encode)
    const args: string[] = ['-i', filePath];

    if (song.title) args.push('-metadata', `title=${song.title}`);
    if (song.artist) args.push('-metadata', `artist=${song.artist}`);
    if (song.album) args.push('-metadata', `album=${song.album}`);
    if (song.albumArtist) args.push('-metadata', `album_artist=${song.albumArtist}`);
    if (song.trackNumber) args.push('-metadata', `track=${song.trackNumber}`);
    if (song.discNumber) args.push('-metadata', `disc=${song.discNumber}`);
    if (song.year) args.push('-metadata', `date=${song.year}`);
    if (song.genre) args.push('-metadata', `genre=${song.genre}`);
    if (song.composer) args.push('-metadata', `composer=${song.composer}`);
    if (song.isrc) args.push('-metadata', `isrc=${song.isrc}`);
    if (song.label) args.push('-metadata', `publisher=${song.label}`);
    if (song.copyright) args.push('-metadata', `copyright=${song.copyright}`);
    if (song.provider) args.push('-metadata', `comment=provider:${song.provider}`);

    // Cover art
    if (song.coverArtUrl) {
      try {
        const coverRes = await fetch(song.coverArtUrl);
        if (coverRes.ok) {
          const coverData = Buffer.from(await coverRes.arrayBuffer());
          const coverPath = filePath + '.cover.tmp';
          fs.writeFileSync(coverPath, coverData);
          args.push('-i', coverPath);
          args.push('-map', '0:0');
          args.push('-map', '1:0');
          args.push('-c', 'copy');
          args.push('-metadata:s:v', 'comment=Cover (front)');
        }
      } catch {}
    }

    const ext = path.extname(filePath);
    const tempPath = filePath.replace(ext, `.tagged${ext}`);

    args.push('-codec', 'copy');
    args.push('-y', tempPath);

    try {
      spawnSync('ffmpeg', args, { timeout: 10000, stdio: 'ignore' });
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, filePath);
      }
    } catch {
      // Clean up temp file if it exists
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }
}
