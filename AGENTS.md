# Repository Guidelines

## Project Structure & Modules
- `app/`: Next.js App Router pages and API routes (`app/api/*/route.ts`).
- `components/`: UI and feature components (PascalCase `.tsx`).
- `lib/`: API clients and utilities (`lib/server` for server-only code).
- `public/`: Static assets (SVGs, Lotties).
- Config: `next.config.mjs`, `eslint.config.mjs`, `open-next.config.ts`, `wrangler.jsonc`.

## Build, Test, and Development
- `npm run dev`: Start local dev with Turbopack at `http://localhost:3000`.
- `npm run build`: Production build.
- `npm run start`: Run built app locally.
- `npm run preview`: Build and preview on Cloudflare Workers (OpenNext).
- `npm run deploy`: Build and deploy to Cloudflare Workers.
- `npm run lint`: Lint codebase with ESLint.

## Coding Style & Conventions
- **Language**: TypeScript, React 19, Next.js 15 App Router.
- **Linting**: ESLint (`next/core-web-vitals`, TypeScript). Fix issues before PRs.
- **Styling**: Tailwind CSS v4 via PostCSS; prefer utility classes.
- **Indentation/format**: 2 spaces; keep lines concise; no unused exports.
- **Naming**: Components `PascalCase.tsx`; hooks/utils `camelCase.ts`; API routes `app/api/<name>/route.ts`.
- **Images**: Next Image uses custom loader (`image-loader.ts`) and `remotePatterns` in `next.config.mjs`.

## Testing Guidelines
- No formal test suite yet. For changes, verify manually:
  - Core flows: search, graph expand, artist panel, image loading.
  - API routes: `lastfm`, `random-artists`, `spotify/token`.
- If introducing tests, add `__tests__/` or `tests/` and a `npm test` script.

## Commit & Pull Requests
- **Commits**: Short, imperative summaries (e.g., `fix image loader`, `add random artists`). Group related changes.
- **PRs must include**:
  - Description of changes and rationale; link issues.
  - Screenshots or short video for UI changes.
  - Steps to reproduce and verify; note env vars or migrations.
  - Scope labels (e.g., ui, api, infra).

## Security & Configuration
- Secrets in `.env.local` (dev) and Cloudflare env; never commit keys. Reference: `NEXT_PUBLIC_LASTFM_API_KEY`, `SPOTIFY_CLIENT_ID/SECRET`.
- Cloudflare: OpenNext config in `open-next.config.ts`; routes in `wrangler.jsonc` (production env). Use `npm run preview` before `deploy`.

## Architecture Notes
- Data via `lib/lastfm.ts` and `lib/spotify.ts`; server helpers in `lib/server`.
- Force-graph rendering in `components/music-graph.tsx`; main app in `components/music-map-app.tsx`.
