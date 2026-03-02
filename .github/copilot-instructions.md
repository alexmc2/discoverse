# Copilot Instructions For This Repository

Use these instructions when GitHub Copilot is asked to review code or suggest changes for this project.

## Project context

- Stack: Next.js 15 + OpenNext Cloudflare adapter + Cloudflare Workers/KV.
- Deployment target has strict worker size limits.
- Large archive JSON data must not be bundled into worker code.
- Shared cache behavior matters for user-facing performance.

## Review priorities (highest first)

1. **Behavioral regressions**
   - Search graph and panel data still load correctly.
   - Artist panel and track preview behavior remains intact.
   - Fallback paths still work when cache misses happen.
2. **Cloudflare deploy safety**
   - No new large server imports from `data/*.json`.
   - Worker bundle size risk is called out if heavy dependencies are added.
   - Runtime code remains compatible with Cloudflare worker environment.
3. **Caching correctness**
   - Shared cache keys are normalized and stable.
   - Stale-while-revalidate behavior does not block user responses.
   - TTL changes are explicit and configurable by env vars where possible.
4. **Security and secrets**
   - No hardcoded tokens or secrets.
   - `CLOUDFLARE_API_TOKEN` and other secrets are read from environment only.
5. **Type and API safety**
   - Route handlers validate request inputs and return clear errors.
   - JSON payloads are serializable and bounded.

## Things to flag explicitly in reviews

- Any import of:
  - `@/data/top-tracks-archive.json`
  - `@/data/artist-cache.json`
  in runtime server paths.
- Any change that could remove or bypass `MUSIC_CACHE` usage.
- Any cache change that makes stale entries block UX.
- Any deploy command change that can target wrong env/namespace.

## Expected review output style

1. List findings first, ordered by severity.
2. Provide precise file+line references for each finding.
3. Include a short rationale and concrete fix suggestion.
4. If no findings, state that clearly and mention residual risks.

## Quick validation commands to suggest

```bash
npm run build
npx opennextjs-cloudflare build
npx wrangler versions upload --dry-run --env=""
```

If the change touches archive KV behavior:

```bash
npm run kv:upload-archives:dry
```
