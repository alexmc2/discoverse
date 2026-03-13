# Changelog

All notable changes to this project will be documented in this file.

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
