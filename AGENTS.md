# SquidSub — AGENTS.md

## What this is

A Subsonic API proxy (Fastify/TypeScript) that merges music from Navidrome (local) + streaming providers (Qobuz, Tidal, Amazon Music). Clients connect as though to a single Subsonic server.

## Build & Run

```bash
npm install                   # install dependencies
npm run build                 # compile TypeScript → dist/
npm run dev                   # dev mode with hot-reload via tsx
npm start                     # run compiled dist/index.js
npm test                      # Vitest — 83 tests, 16 files
npm run lint                  # tsc --noEmit (type-check only)
```

`.env` is gitignored. Copy `.env.example` (if exists) or set env vars directly.

## Configuration

All config is read from environment / `.env` and validated via Zod.

> **Naming convention:** `.env.example` uses **single underscores** (e.g. `SQUIDWTF_SOURCE`) because Docker Compose `.env` files reference these variable names directly. The actual app and `docker-compose.yml` use **double underscores** (`SQUIDWTF__SOURCE`) as required by the Zod schema. When setting env vars outside of Docker Compose, use the double-underscore form from the table below.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5050` | HTTP listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `NAVIDROME_URL` | `http://localhost:4533` | Navidrome instance URL |
| `NAVIDROME_ADMIN_USERNAME` | — | Admin username (auth against config first, fallback Navidrome ping) |
| `NAVIDROME_ADMIN_PASSWORD` | — | Admin password |
| `SQUIDWTF__SOURCE` | `qobuz` | Active provider (`qobuz` / `tidal` / `amazon`) |
| `SQUIDWTF__QUALITY` | `lossless` | Quality preference |
| `SQUIDWTF__COUNTRY` | `US` | Country code for provider APIs |
| `SQUIDWTF__QOBUZ_BASE_URL` | `https://qobuz.squid.wtf` | Qobuz proxy URL |
| `SQUIDWTF__AMAZON_BASE_URL` | `https://amz.squid.wtf` | Amazon proxy URL |
| `SQUIDWTF__INSTANCES_URL` | — | URL to fetch Tidal instance list |
| `SQUIDWTF__INSTANCES` | — | Comma-separated Tidal instance URLs |
| `SQUIDWTF__INSTANCE_TIMEOUT_SECONDS` | `5` | Per-Tidal-instance timeout |
| `AMAZON__REGION` | `US` | Amazon Music region |
| `AMAZON__QUALITY` | `HD` | Amazon quality level |
| `SQUIDSUB__STORAGE_MODE` | `permanent` | `permanent` or `cache` |
| `SQUIDSUB__FOLDER_TEMPLATE` | `{artist}/{album}/{track} - {title}` | Output file path template |
| `SQUIDSUB__CACHE_DURATION_HOURS` | `1` | Cache expiry (cache mode) |
| `LYRICS__ENABLED` | `true` | Enable Lrclib lyrics fetching |
| `LYRICS__LRCLIB_BASE_URL` | `https://lrclib.net` | Lyrics API base URL |
| `LYRICS__WRITE_LRC_FILE` | `false` | Write `.lrc` sidecar files |

## Architecture

### Routes (`src/routes/subsonic.ts`)

Single router file. All Subsonic endpoints are handled explicitly, with a fallthrough `/*` route that proxies unhandled paths to Navidrome:

- `rest/search3` — queries Navidrome + active streaming provider concurrently, merges results
- `rest/stream` / `rest/download` — proxies local tracks to Navidrome; downloads + caches external tracks on-the-fly
- `rest/getSong` — returns local or external song metadata
- `rest/getArtist` — fetches from Navidrome, then merges matching external albums
- `rest/getAlbum` — fetches from Navidrome, then merges matching external songs
- `rest/getCoverArt` — proxies local art or fetches external art from provider URLs
- `rest/star` / `rest/unstar` — resolves external IDs to local IDs; `Cache` mode triggers permanent download on star
- `rest/scrobble` — resolves external IDs before relaying to Navidrome
- `rest/updatePlaylist` — resolves external song IDs, downloads missing tracks first
- `rest/getTranscodeDecision` — returns transcode info for external songs
- `rest/getLyricsBySongId` — fetches lyrics from Lrclib for external songs
- `/*` — catch-all relay to Navidrome for all other Subsonic endpoints

### Middleware

- **`src/middleware/auth.ts`** — basic auth against `NAVIDROME_ADMIN_USERNAME`/`NAVIDROME_ADMIN_PASSWORD` from config (no Navidrome dependency). Falls back to Navidrome ping when config creds not set. 5-min auth cache. Parses Navidrome response body for `status="failed"` (Navidrome returns HTTP 200 even for wrong passwords).
- **`src/middleware/body-buffer.ts`** — ensures POST body is available for Subsonic form-encoded param parsing
- **`src/middleware/error-handler.ts`** — global Fastify error handler → Subsonic-formatted error response (XML or JSON, matches `f=` param)

### Services

- **`src/services/subsonic/`** — Subsonic protocol layer:
  - `request-parser.ts` — extracts Subsonic params from query string + POST body (body overrides query)
  - `response-builder.ts` — builds XML + JSON Subsonic responses for all types (song, album, artist, lyrics, transcodeDecision, error)
  - `model-mapper.ts` — `SubsonicProxyService` (relays HTTP to Navidrome with stream conversion), `SubsonicModelMapper` (parses Navidrome search response JSON/XML + merges with external results; playlists converted to album format)

- **`src/services/providers/`** — streaming provider abstraction:
  - `interface.ts` — `ISquidWTFProvider` interface
  - `factory.ts` — `SquidWTFProviderFactory` selects provider based on `SQUIDWTF__SOURCE` (qobuz/tidal/amazon)
  - `qobuz-provider.ts` — Qobuz: search, getSong, getAlbum, getArtist, getArtistAlbums, downloadTrack. Uses Qobuz proxy (`qobuz.squid.wtf`). Handles captcha retry on 403.
  - `amazon-provider.ts` — Amazon Music: search, track metadata, download via prepare/async-job/status-poll flow (12-min timeout, retry on 502/503/403 with fresh captcha)
  - `tidal-provider.ts` — Tidal: search, track info, album, artist, artist albums, playlists, playlist tracks, download (DASH or BTS manifest)

- **`src/services/squidwtf/`** — SquidWTF utilities:
  - `amazon-drm-decryptor.ts` — AES-128-CTR decryption (ECB keystream + XOR)
  - `cmaf-demuxer.ts` — extracts FLAC from CMAF/MP4 containers (fLaC marker or STSD atom)
  - `tidal-dash-parser.ts` — regex-based DASH MPD manifest parser, selects best FLAC stream by bandwidth
  - `instance-manager.ts` — Tidal API instance failover (static from config or dynamic from uptime URL, 15-min cache)
  - `metadata-service.ts` — `SquidWTFMetadataService` wrapping the provider factory

- **`src/services/download/download-service.ts`** — `BaseDownloadService`: local file caching, ffmpeg tag writing (title, artist, album, genre, cover art, ISRC), album download support, permanentize for cache mode

- **`src/services/lyrics/lyrics-service.ts`** — `LrclibLyricsService`: fetches synced lyrics from lrclib.net, optional `.lrc` sidecar writing

- **`src/services/validation/validation-result.ts`** — `ValidationResult` DTO

- **`src/services/captcha/captcha-solver.ts`** — ALTCHA proof-of-work solver for Amazon captchas (28-min token caching)

### Models (`src/models/`)

- `song.ts` — `Song`, `Album`, `Artist`, `SongLyrics`, `LyricLine` interfaces
- `search-result.ts` — `SearchResult` class
- `subsonic-types.ts` — `ExternalPlaylist` interface
- `qobuz-types.ts` — Qobuz API response DTOs
- `amazon-types.ts` — Amazon API response DTOs
- `tidal-types.ts` — Tidal API response DTOs

### Utils (`src/utils/`)

- `id-helper.ts` — `parseSongId` (3-part `ext-{provider}-{id}`), `parseExternalId` (4-part `ext-{provider}-{type}-{id}`), `makeExternalId`, `makePlaylistId`, `isExternalPlaylist`, `parsePlaylistId`
- `credentials.ts` — `tryFromDictionary` extracts Subsonic creds from params, decrypts `enc:` XOR passwords (key: `gesundheit`)
- `path-helper.ts` — `sanitizeFileName`, `getCachePath`, `getOutputDirectory`, `getOutputPath`, `getAlbumOutputDirectory`
- `quality-helper.ts` — `getQualityLevel`, `shouldUpgrade` for quality string comparison
- `string-normalizer.ts` — `createComparisonKey`, `normalizeForComparison` for dedup (smart quotes → ASCII)

### Storage Modes

| Mode | Behavior |
|---|---|
| `permanent` | External tracks fully downloaded to disk immediately |
| `cache` | External tracks cached on-stream; starring "permanentizes" them |

## ID Conventions

| Pattern | Example |
|---|---|
| `ext-{provider}-{externalId}` | `ext-qobuz-12345` (song ID) |
| `ext-{provider}-{type}-{externalId}` | `ext-qobuz-song-12345` (4-part, also parsed by `parseExternalId`) |
| `pl-{provider}-{externalId}` | `pl-tidal-abc123` (playlist ID) |

All IDs parsed via `parseSongId()` or `parseExternalId()` in `id-helper.ts`.

## Key Technical Details

- **Auth**: Validates against config-stored admin credentials first (no Navidrome dependency). Falls back to Navidrome ping. Navidrome returns HTTP 200 with `status="failed"` for wrong passwords — auth handler parses response body.
- **Qobuz proxy** (`qobuz.squid.wtf`) currently returns HTML (down/maintenance) — graceful degradation returns empty search results.
- **Amazon download flow**: captcha → prepare → async job → status poll (iterates `statusUrls` array with retries).
- **Tidal download**: prefers DASH manifest for FLAC, falls back to BTS manifest. Instance failover via `SquidWTFInstanceManager`.
- **Stream conversion**: Web ReadableStream → Node.js Readable for Navidrome stream relay.
- **All services wired as singletons** in `src/server.ts` (no DI container; manual construction).

## Tests (`tests/unit/`)

- **Vitest** — 16 test files, 83 tests.
- Mocks in `tests/mocks.ts` (Fastify request builder).
- Test directories mirror source: `utils/`, `subsonic/`, `squidwtf/`, `providers/`, `models/`, `middleware/`, `validation/`.
- No integration tests requiring a running Navidrome or external service.
- Run all: `npm test`. Watch mode: `npm run test:watch`.

## Differences from C# Original

| Aspect | C# (SquidSub) | TypeScript (SquidSub Node) |
|---|---|---|
| Framework | ASP.NET 8 | Fastify 5 |
| Language | C# 12 | TypeScript 5 |
| Tests | xUnit + FluentAssertions + Moq | Vitest |
| Config | `IOptions<T>` | Zod-validated env |
| Logging | built-in ILogger | pino + pino-pretty |
| Auth | always Navidrome ping | config creds first, Navidrome fallback |
| DI | built-in DI container | manual singleton construction |
| Validation | StartupValidationOrchestrator | Zod schema validation at startup |
