import path from 'node:path';
import os from 'node:os';
import { getConfig } from '../config/settings.js';
import { Song, Album } from '../models/song.js';

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitize(input: string): string {
  if (!input) return 'Unknown';
  const s = input.replace(INVALID_CHARS, '').trim();
  return s || 'Unknown';
}

export function getCachePath(): string {
  return path.join(os.tmpdir(), 'squidsub-cache');
}

export function getOutputDirectory(song: Song): string {
  const config = getConfig();
  const baseDir = config.SQUIDSUB__STORAGE_MODE === 'cache' ? os.tmpdir() : process.cwd();
  const template = config.SQUIDSUB__FOLDER_TEMPLATE;

  if (template) {
    const relativePath = template
      .replace('{artist}', sanitize(song.artist))
      .replace('{album}', sanitize(song.album))
      .replace('{track}', String(song.trackNumber ?? 0).padStart(2, '0'))
      .replace('{title}', sanitize(song.title));
    const dir = path.dirname(path.join(baseDir, 'music', relativePath));
    return dir;
  }

  return path.join(baseDir, 'music');
}

export function getOutputPath(song: Song, outputDir: string, extension: string): string {
  const fileName = `${String(song.trackNumber).padStart(2, '0')} - ${sanitize(song.title)}${extension}`;
  return path.join(outputDir, fileName);
}

export function getAlbumOutputDirectory(album: Album): string {
  const config = getConfig();
  const baseDir = config.SQUIDSUB__STORAGE_MODE === 'cache' ? os.tmpdir() : process.cwd();
  return path.join(baseDir, 'music', sanitize(album.artist), sanitize(album.title));
}

export function sanitizeFileName(input: string): string {
  return sanitize(input).substring(0, 100);
}

export function resolveUniquePath(filePath: string): string {
  if (!filePath) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  if (filePath) {
    try {
      if (filePath) {
        // Check if exists
      }
    } catch { }
  }

  return filePath;
}
