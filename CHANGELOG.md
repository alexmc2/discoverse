# Changelog

All notable changes to this project will be documented in this file.

## [2026-03-15] -  Cache hardening and test suite

### Added
- Added Jest test suite with 13 test files covering API routes, shared library code, and component behaviour (PR #10).
- Migrated testing framework from Vitest to Jest using `next/jest`, avoiding an esbuild version conflict with wrangler and OpenNext.
- Test coverage includes cache routes, Spotify and Last.fm helpers, random artist selection, genres, utilities, and the search bar component.
- Added regression tests covering default artists with degraded KV panel data and healthier bundled JSON fallback.
- Added `POST /api/lastfm` regression tests covering artist names containing `&`.

### Fixed
- Fixed cache retrieval so that KV reads correctly unwrap the envelope format and handle missing entries without errors (PR #11).
- Added a quality gate on search cache writes to prevent bad data (e.g. tracks with zero preview URLs due to rate limiting) from being persisted to KV for 180 days (PR #11).
- Updated artist cache with refreshed data for default artist pool (PR #9).
- Fixed default artist panel fallback so degraded KV entries no longer override healthier bundled `artist-cache.json` data for seeded artists.
- Updated the `search-cache` panel fallback to reuse the same default artist quality checks instead of returning the raw KV default cache entry.
- Broadened client-side cache read and write guards to reject any panel data with all-null previews, not just Spotify-sourced entries, preventing Last.fm fallback data from polluting the search cache.
- Switched client-side Last.fm proxy calls from GET query params to `POST /api/lastfm` with a JSON body so artist names containing `&` are no longer truncated into the wrong panel artist metadata.

### Changed
- Updated about page.

## [2026-03-14] -  KV caching, resilience improvements, and bug fixes

### Added
- Added global search cache using Cloudflare KV so that any artist searched by any user is cached and loads instantly for subsequent searches (PR #7).
  - New `POST /api/search-cache` endpoint -  client computes graph/panel data, then POSTs it to KV (fire-and-forget).
  - New `getSearchCacheBootstrap()` in `lib/server/artists.ts` -  SSR falls through from default artist cache to search cache before falling back to client-side computation.
  - Keys use normalised artist names: `search-cache:v1:graph:<name>` and `search-cache:v1:panel:<name>` with 180-day TTL.
- Moved default artist cache loading to KV-first with bundled JSON fallback, so the default artist pool can be expanded beyond the ~99 artists that fit in the Cloudflare Worker bundle limit (PR #7).
- Added `scripts/upload-artist-cache-to-kv.mjs` to push `artist-cache.json` to both preview and production KV namespaces.
- Added "Show more artists" shuffle button on the landing page to cycle through the expanded default artist pool (PR #7).
- Added `app/api/itunes-preview/route.ts` as a server-side CORS proxy for iTunes preview lookups, fixing client-side 403s from iTunes blocking cross-origin requests (PR #7).
- Added track loading indicator in the artist panel so that metadata appears immediately while tracks hydrate in the background (PR #6).
- Expanded default artist pool from ~99 to ~415 artists via the refresh script with `--skip-existing` support and periodic checkpointing (PR #7).
- Added web app manifest (PR #7).

### Fixed
- Fixed panel overwrite regression where cached/seeded artists would briefly show correct track data and then revert to a worse payload from a live fallback fetch. The panel now preserves richer cached metadata and only enriches missing previews instead of replacing the entire payload (PR #5).
- Fixed uncached artist panels missing album names and artwork by expanding the iTunes enrichment path to supply album name, artwork URL, and preview URL (not just preview URLs) (PR #5).
- Fixed uncached graph nodes showing star placeholders instead of artist images by restoring Spotify-first image lookup with placeholder-aware Last.fm fallback (PR #5).
- Fixed graph position on initial load so the seed artist is correctly centered (PR #5).
- Fixed `lastfmGet()` to route client-side requests through the existing `/api/lastfm` proxy, fixing CORS failures when Last.fm stopped including CORS headers (PR #7).
- Fixed `fetchITunesPreview()` to use the new `/api/itunes-preview` proxy client-side while still calling iTunes directly server-side (PR #7).
- Allowed Apple artwork domains (`*.mzstatic.com`) in `next.config.mjs` remote patterns and CSP `img-src` so that iTunes fallback artwork renders (PR #5).
- Fixed search box losing input and behaving erratically after navigation by removing the `navigatingRef.current = false` reset from the query effect (PR #8).
- Added skip logic for search cache writes when Spotify previews fail, preventing rate-limited garbage data from being persisted (PR #7).

### Changed
- Updated landing page background image and adjusted mobile background layout.
- Refresh script now shows elapsed time, ETA, and periodic checkpoints during long runs.

## [2026-03-13] -  Rollback

### Changed
- Rolled back the March 2 Spotify archive experiment. The top-tracks archive, KV-backed shared search cache, server-side panel/graph routes, and concurrency-gated architecture were all removed. The JSON bootstrap cache for default artists was preserved. This was the right call -  the experiment had introduced a cache poisoning loop, Spotify API storms, and panel data regressions that couldn't be fixed without rethinking the approach (which is what the March 14 work did).

## [2026-03-02] -  Spotify workaround experiment (PR #3, later rolled back)

Attempted to work around Spotify's announced endpoint deprecation by centralising API calls server-side with a KV-backed shared search cache and a pre-built top-tracks archive. The approach introduced a cache poisoning loop (client-side refreshes couldn't access the server-only archive, so they overwrote good data with inferior search results), uncached Spotify API storms, and panel data regressions. Rolled back on March 13. The lessons from this attempt directly shaped the successful client-computes-then-POSTs caching architecture added on March 14.

### Added (all later reverted)
- Added `data/top-tracks-archive.json` -  a pre-built archive of top tracks for ~1,995 artists.
- Added KV-backed shared search cache with stale-while-revalidate.
- Added `searchSpotifyTracks()` as a search-based alternative to the deprecated `GET /artists/{id}/top-tracks` endpoint.
- Added 429 retry/backoff and circuit breaker logic in `spotifyGET()`.
- Moved cache writes from an unauthenticated POST endpoint to a server action after a Copilot code review flagged the security risk.

## [2026-02-27] -  Spotify endpoint investigation

### Changed
- Investigated replacement strategies for Spotify's deprecated endpoints. Attempted hybrid track pipeline using Last.fm for ranking, Spotify search for metadata matching, and iTunes for preview URLs. The approach surfaced important constraints but did not reach a deployable state -  this fed into the March 2 experiment.

## [2026-02-21] -  Default artist cache and API unification (PR #2)

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
- Updated `components/artist-panel.tsx` to show an explicit "no 30-second previews available" note when tracks are present but none are playable.
- Updated `scripts/refresh-artist-cache.mjs` so partial refresh runs (using `--artist`) preserve all existing cache entries.

## [2026-01-08] -  Post-CVE stabilisation

### Fixed
- Reverted to last known working state after the December CVE patches introduced a React Server Components regression.

## [2025-12-21] -  Security patches

### Fixed
- Fixed React Server Components CVE vulnerabilities.

## [2025-12-05] -  Dependency upgrades

### Changed
- Upgraded Next.js and React versions to patch CVE-2025-55182.

## [2025-11-18] -  SEO and about page

### Added
- Added about page with project description.
- Added sitemap generation.
- Added SEO metadata and keywords.

## [2025-11-09] -  Minor updates

### Changed
- Updated sitemap.
- Updated mode toggle behaviour.

## [2025-09-08] -  Favicon

### Added
- Added favicon.

## [2025-09-01 to 2025-09-05] -  Cloudflare deployment and polish

### Added
- Deployed to Cloudflare Workers using OpenNext.
- Added search overlay for finding artists.
- Added map/info mode toggle.
- Added OG tags and social sharing metadata.
- Added sitemap.
- Added aria labels for accessibility.

### Fixed
- Fixed Cloudflare image resizing issues in the artist panel.
- Fixed OG tags across multiple iterations.
- Fixed build errors related to deployment.
- Added Brave browser compatibility fix.

### Changed
- Updated mobile header layout.
- Updated graph rendering and image resizing.
- Updated caching behaviour.
- Various UI refinements.

## [2025-08-23 to 2025-08-28] -  Initial build

### Added
- Scaffolded Next.js app with TypeScript and Tailwind CSS.
- Built force-directed artist relationship graph using `react-force-graph-2d`.
- Integrated Last.fm API for related artists, bios, tags, and top tracks.
- Integrated Spotify API for artist images, profile links, and track previews.
- Added artist panel with biography, tags, stats, and playable track previews.
- Added kinetic panning to the map.
- Added track preview playback.
- Added random artist suggestions for the default experience.
- Added Lottie animations.
- Added tooltips and cursor pointers for graph interaction.

### Fixed
- Fixed CORS image loading issues.
- Fixed global padding and layout.
- Fixed Lottie build errors.
