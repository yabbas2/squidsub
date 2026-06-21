import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(5050),
  HOST: z.string().default('0.0.0.0'),

  // Navidrome
  NAVIDROME_URL: z.string().default('http://localhost:4533'),
  NAVIDROME_ADMIN_USERNAME: z.string().optional(),
  NAVIDROME_ADMIN_PASSWORD: z.string().optional(),

  // SquidWTF
  SQUIDWTF__SOURCE: z.enum(['qobuz', 'tidal', 'amazon']).default('qobuz'),
  SQUIDWTF__QUALITY: z.string().default('lossless'),
  SQUIDWTF__COUNTRY: z.string().default('US'),
  SQUIDWTF__QOBUZ_BASE_URL: z.string().default('https://qobuz.squid.wtf'),
  SQUIDWTF__AMAZON_BASE_URL: z.string().default('https://amz.squid.wtf'),

  // Tidal instance config
  SQUIDWTF__INSTANCES_URL: z.string().optional(),
  SQUIDWTF__INSTANCES: z.string().optional(), // comma-separated list
  SQUIDWTF__INSTANCE_TIMEOUT_SECONDS: z.coerce.number().default(5),

  // Amazon settings
  AMAZON__REGION: z.string().default('US'),
  AMAZON__QUALITY: z.string().default('HD'),

  // Storage
  SQUIDSUB__STORAGE_MODE: z.enum(['permanent', 'cache']).default('permanent'),
  SQUIDSUB__FOLDER_TEMPLATE: z.string().default('{artist}/{album}/{track} - {title}'),
  SQUIDSUB__CACHE_DURATION_HOURS: z.coerce.number().default(1),

  // Lyrics
  LYRICS__ENABLED: z.coerce.boolean().default(true),
  LYRICS__LRCLIB_BASE_URL: z.string().default('https://lrclib.net'),
  LYRICS__WRITE_LRC_FILE: z.coerce.boolean().default(false),
}).passthrough();

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}
