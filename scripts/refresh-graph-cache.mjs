import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { POPULAR_ARTISTS_POOL } from '../lib/popular-artists.ts';
import { buildGraphData } from '../lib/lastfm.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CACHE_PATH = path.resolve(ROOT_DIR, 'data/artist-cache.json');

function normalizeArtistName(name) {
  return name.trim().toLowerCase();
}

function parseArgs(argv) {
  const args = {
    artists: [],
    dryRun: false,
    force: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--artist') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --artist');
      }
      args.artists.push(value);
      i++;
      continue;
    }

    if (token.startsWith('--artist=')) {
      const value = token.split('=').slice(1).join('=');
      if (value.trim()) args.artists.push(value.trim());
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--force') {
      args.force = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(
    [
      'Refreshes graph data only in data/artist-cache.json for popular artists.',
      'Skips artists that already have graphData (use --force to re-fetch).',
      '',
      'Usage:',
      '  npm run refresh:graph-cache',
      '  npm run refresh:graph-cache -- --artist "Depeche Mode"',
      '  npm run refresh:graph-cache -- --dry-run',
      '  npm run refresh:graph-cache -- --force',
      '',
      'Env required:',
      '  NEXT_PUBLIC_LASTFM_API_KEY',
      '',
      'Env optional (for artist images):',
      '  SPOTIFY_CLIENT_ID',
      '  SPOTIFY_CLIENT_SECRET',
    ].join('\n')
  );
}

async function readExistingCache() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

async function withRetry(label, fn, retries = 1) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const lastAttempt = attempt === retries;
      if (!lastAttempt) {
        const waitMs = 800 * (attempt + 1);
        console.warn(
          `[retry] ${label} failed (${attempt + 1}/${retries + 1}). Waiting ${waitMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError;
}

function getArtistsToRefresh(argArtists) {
  if (argArtists.length > 0) {
    return argArtists
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((value, idx, arr) => arr.indexOf(value) === idx);
  }

  const seen = new Set();
  const unique = [];
  for (const artist of POPULAR_ARTISTS_POOL) {
    const key = normalizeArtistName(artist);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(artist);
  }
  return unique;
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s}s`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!process.env.NEXT_PUBLIC_LASTFM_API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_LASTFM_API_KEY');
  }

  const artists = getArtistsToRefresh(args.artists);
  if (artists.length === 0) {
    console.log('No artists to refresh.');
    return;
  }

  const existing = await readExistingCache();
  const next = { ...existing };
  const startedAt = Date.now();
  let refreshedCount = 0;
  let fallbackCount = 0;
  let failedCount = 0;
  const failedArtists = [];
  const nowIso = new Date().toISOString();

  const toFetch = args.force
    ? artists
    : artists.filter((a) => !existing[normalizeArtistName(a)]?.graphData);

  const skippedCount = artists.length - toFetch.length;

  console.log(
    `${artists.length} total artists, ${skippedCount} already cached, ${toFetch.length} to fetch`
  );

  if (toFetch.length === 0) {
    console.log('All artists already cached. Use --force to re-fetch.');
    return;
  }

  if (args.dryRun) {
    console.log('\nDry run -- artists that would be fetched:');
    for (const name of toFetch) console.log(`  - ${name}`);
    console.log(`\nDry run complete. No data fetched or written.`);
    return;
  }

  const CHECKPOINT_EVERY = 10;

  for (let i = 0; i < toFetch.length; i++) {
    const displayName = toFetch[i];
    const cacheKey = normalizeArtistName(displayName);
    const elapsed = (Date.now() - startedAt) / 1000;
    const avgPer = refreshedCount > 0 ? elapsed / refreshedCount : 0;
    const remainingSec = avgPer > 0 ? avgPer * (toFetch.length - i) : 0;
    const eta = remainingSec > 0 ? formatTime(remainingSec) : '?';

    process.stdout.write(
      `[${i + 1}/${toFetch.length}] ${displayName} (${formatTime(elapsed)} elapsed, ~${eta} left) ... `
    );

    try {
      const graphData = await withRetry(
        `graph:${displayName}`,
        async () => await buildGraphData(displayName, 2),
        1
      );

      // Preserve existing panelData if present
      const existingEntry = existing[cacheKey];
      next[cacheKey] = {
        graphData,
        ...(existingEntry?.panelData ? { panelData: existingEntry.panelData } : {}),
        lastUpdated: nowIso,
      };
      refreshedCount++;
      console.log('ok');
    } catch (error) {
      if (existing[cacheKey]) {
        next[cacheKey] = existing[cacheKey];
        fallbackCount++;
        console.log('fallback to existing');
      } else {
        failedCount++;
        failedArtists.push(displayName);
        console.log(`skipped (${error?.message || error})`);
      }
    }

    // Checkpoint: save progress to disk periodically
    if ((i + 1) % CHECKPOINT_EVERY === 0) {
      await writeFile(CACHE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      console.log(`  -> checkpoint saved (${Object.keys(next).length} artists in cache)`);
    }
  }

  await writeFile(CACHE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${CACHE_PATH}`);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Done in ${formatTime(Number(elapsedSec))} (refreshed=${refreshedCount}, skipped=${skippedCount}, fallback=${fallbackCount}, failed=${failedCount}).`
  );
  if (failedArtists.length > 0) {
    console.log(`\nFailed artists (rerun to retry -- they'll be picked up automatically):`);
    for (const name of failedArtists) console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
