import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { POPULAR_ARTISTS_POOL } from '../lib/popular-artists.ts';
import {
  buildGraphData,
  getArtistInfo,
  getTopTracks as getLastFmTopTracks,
} from '../lib/lastfm.ts';
import {
  getArtistImage,
  getArtistSpotifyUrl,
  getArtistTopTracks,
} from '../lib/spotify.ts';

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
    skipExisting: false,
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

    if (token === '--skip-existing') {
      args.skipExisting = true;
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
      'Refreshes data/artist-cache.json for default artists.',
      '',
      'Usage:',
      '  npm run refresh:artist-cache',
      '  npm run refresh:artist-cache -- --artist \"Depeche Mode\"',
      '  npm run refresh:artist-cache -- --artist=\"Radiohead\" --dry-run',
      '  npm run refresh:artist-cache -- --skip-existing',
      '',
      'Env required:',
      '  NEXT_PUBLIC_LASTFM_API_KEY',
      '',
      'Env optional:',
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

async function fetchPanelData(artistName) {
  const [info, spotifyImage, spotifyUrl] = await Promise.all([
    getArtistInfo(artistName),
    getArtistImage(artistName),
    getArtistSpotifyUrl(artistName),
  ]);

  const artist = info
    ? { ...info, image: spotifyImage || info.image, spotifyUrl }
    : null;

  let tracks = [];
  let trackSource = null;

  try {
    const spotifyTop = await getArtistTopTracks(artistName);
    if (spotifyTop && spotifyTop.length > 0) {
      tracks = spotifyTop.slice(0, 10);
      trackSource = 'spotify';
    } else {
      const lastFmTracks = await getLastFmTopTracks(artistName, 10);
      tracks = lastFmTracks.map((t, idx) => ({
        id: `${artistName}-${t.name}-${idx}`,
        name: t.name,
        preview_url: null,
        duration_ms: 0,
        popularity: 0,
        album: { name: '—', images: [] },
        artists: [{ name: t.artist }],
      }));
      trackSource = 'lastfm';
    }
  } catch {
    // Keep partial panel data if track fetch fails.
  }

  return { artist, tracks, trackSource };
}

async function refreshEntry(artistName, nowIso) {
  const graphData = await withRetry(
    `graph:${artistName}`,
    async () => await buildGraphData(artistName, 2),
    1
  );
  const panelData = await withRetry(
    `panel:${artistName}`,
    async () => await fetchPanelData(artistName),
    1
  );
  return { graphData, panelData, lastUpdated: nowIso };
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

  const toFetch = args.skipExisting
    ? artists.filter((a) => !existing[normalizeArtistName(a)]?.graphData)
    : artists;

  if (args.skipExisting) {
    console.log(
      `${artists.length} total artists, ${artists.length - toFetch.length} already cached, ${toFetch.length} to fetch...`
    );
    // Carry forward all existing entries
    for (const a of artists) {
      const key = normalizeArtistName(a);
      if (existing[key]) next[key] = existing[key];
    }
  } else {
    console.log(`Refreshing ${artists.length} artist cache entries...`);
  }

  const CHECKPOINT_EVERY = 10; // save to disk every N artists

  for (let i = 0; i < toFetch.length; i++) {
    const displayName = toFetch[i];
    const cacheKey = normalizeArtistName(displayName);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const avgPer = refreshedCount > 0 ? (Date.now() - startedAt) / refreshedCount / 1000 : 0;
    const remaining = avgPer > 0 ? Math.round(avgPer * (toFetch.length - i)) : '?';
    process.stdout.write(
      `[${i + 1}/${toFetch.length}] ${displayName} (${elapsed}s elapsed, ~${remaining}s left) ... `
    );

    try {
      next[cacheKey] = await refreshEntry(displayName, nowIso);
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
    if (!args.dryRun && (i + 1) % CHECKPOINT_EVERY === 0) {
      await writeFile(CACHE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      console.log(`  -> checkpoint saved (${Object.keys(next).length} artists in cache)`);
    }
  }

  if (args.dryRun) {
    console.log('Dry run complete. File was not written.');
  } else {
    await writeFile(CACHE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${CACHE_PATH}`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Done in ${elapsedSec}s (refreshed=${refreshedCount}, skipped=${artists.length - toFetch.length}, fallback=${fallbackCount}, failed=${failedCount}).`
  );
  if (failedArtists.length > 0) {
    console.log(`\nFailed artists (rerun with --skip-existing to retry):`);
    for (const name of failedArtists) console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
