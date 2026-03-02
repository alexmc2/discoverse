# Changelog

All notable changes to this project will be documented in this file.

## [2026-03-02]

### Added
- Added `lib/server/search-cache.ts` server action for cache writes, replacing the previous public POST endpoint.
- Added `app/api/search-cache/route.ts` to provide shared KV-backed cache reads for graph and panel payloads by artist name.
- Added stale-while-revalidate cache metadata and response fields (`stale`, `cachedAt`) for global search-cache entries.
- Added configurable soft/hard TTL environment variables for shared search cache:
  - `SEARCH_CACHE_GRAPH_TTL_SECONDS`
  - `SEARCH_CACHE_PANEL_TTL_SECONDS`
  - `SEARCH_CACHE_GRAPH_HARD_TTL_SECONDS`
  - `SEARCH_CACHE_PANEL_HARD_TTL_SECONDS`
- Added `scripts/upload-archives-to-kv.mjs` to upload large archive JSON files into `MUSIC_CACHE` for both production and preview namespaces.
- Added npm scripts:
  - `npm run kv:upload-archives`
  - `npm run kv:upload-archives:dry`
- Added `.github/copilot-instructions.md` with project-specific Copilot review guidance.

### Changed
- Replaced bundle-time JSON archive imports with KV runtime reads:
  - `lib/spotify.ts` now reads top-tracks archive from KV key `archive:top-tracks:v1`.
  - `lib/server/artists.ts` now reads artist bootstrap archive from KV key `archive:artist-cache:v1`.
- Updated `lib/server/cache.ts` KV binding resolution to use Cloudflare context (`Symbol.for('__cloudflare-context__')`) with legacy global fallback.
- Updated `next.config.mjs` to gate `@opennextjs/cloudflare` dev helper behind `NODE_ENV !== 'production'` with dynamic import, avoiding devDependency failure in production.
- Updated `components/music-map-app.tsx` to use shared cache-first lookups for graph and panel data, with background refresh on stale hits. Cache writes now use a server action instead of a direct POST fetch.
- Updated archive loaders in `lib/spotify.ts` and `lib/server/artists.ts` to retry on future requests when a previous KV read returned null.

### Fixed
- Fixed Spotify `spotifyGET` circuit breaker not tripping after exhausting 429 retry attempts, causing repeated rate-limited requests without cooloff.
- Fixed Cloudflare deploy-time worker size failure (`10027`) by moving large archive payloads out of the worker bundle.
- Reduced dry-run upload bundle size to ~`gzip: 1992 KiB` (under free-plan 3 MiB script limit).
- Fixed local/remote KV upload ambiguity for bindings that include both `id` and `preview_id` by using explicit `--preview true|false`.

## [2026-02-21]

### Added
- Added `getDefaultArtistBootstrap` in `lib/server/artists.ts` to serve precomputed default-artist graph/panel data from `data/artist-cache.json`.
- Added `lib/server/random-artists.ts` as the shared random-artist source.
- Added `scripts/refresh-artist-cache.mjs` to regenerate `data/artist-cache.json` from live Last.fm/Spotify data with retry + safe fallback behavior.
- Added `scripts/register-ts-loader.mjs` and `scripts/ts-resolve-loader.mjs` so the refresh script can execute TypeScript modules from Node.
- Added a weekly GitHub Actions cron at `.github/workflows/refresh-artist-cache.yml` to refresh and auto-commit cache updates.
- Added npm script: `npm run refresh:artist-cache`.

### Changed
- Updated `app/page.tsx` to hydrate default-artist searches from precomputed cache, avoiding slow first-load map generation for suggested artists.
- Updated `components/music-map-app.tsx` to initialize graph state from server-provided `initialGraphData` immediately.
- Updated `components/music-graph.tsx` so initial graph render no longer auto-fits over the focused artist, and now retries centering until coordinates are ready for accurate first-load alignment.
- Repointed `app/api/random-artists/route.ts` to use `lib/server/random-artists.ts` (single source of truth for the artist pool).
- Repointed `app/api/lastfm/route.ts` to use shared Last.fm helpers from `lib/lastfm.ts` instead of duplicating API call construction.
- Added exported Last.fm method helpers in `lib/lastfm.ts` for route-level reuse (`getLastfmMethodData`, `isSupportedLastfmMethod`).
- Removed Spotify response caching in `lib/spotify.ts` for artist search and top tracks to prevent stale no-preview track payloads.
- Updated `components/music-map-app.tsx` to ignore cached seed panel tracks when they are Spotify-sourced but have zero playable previews, while fresh data is fetched.
- Updated `components/artist-panel.tsx` to show an explicit “no 30-second previews available” note when tracks are present but none are playable.
- Updated `scripts/refresh-artist-cache.mjs` so partial refresh runs (using `--artist`) preserve all existing cache entries.
