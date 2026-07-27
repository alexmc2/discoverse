// scripts/check-preview-health.mjs
// Samples the deployed shared cache and verifies that cached preview URLs still
// play. Exists because every previous top-tracks outage was invisible for
// months: the unit suite mocks fetch, so it stays green while production rots.
//
//   node scripts/check-preview-health.mjs [--sample 12] [--threshold 0.9]
//                                         [--base https://discoverse.co.uk]

import process from 'node:process';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = arg('base', 'https://discoverse.co.uk').replace(/\/$/, '');

// Fall back to the defaults on unparseable input. A NaN threshold would make
// `ratio < THRESHOLD` false for every value, so the check would report OK no
// matter how many previews were dead — the exact silent-pass this script exists
// to prevent.
const sampleRaw = Number(arg('sample', '12'));
const thresholdRaw = Number(arg('threshold', '0.9'));
const SAMPLE = Number.isFinite(sampleRaw) ? Math.max(1, Math.round(sampleRaw)) : 12;
const THRESHOLD = Number.isFinite(thresholdRaw)
  ? Math.min(1, Math.max(0, thresholdRaw))
  : 0.9;

const REQUEST_TIMEOUT_MS = 10_000;

// A spread of seeded artists plus a few that exercise awkward name handling.
const CANDIDATES = [
  'Depeche Mode', 'Radiohead', 'The Beatles', 'Bob Dylan', 'Nick Drake',
  'Massive Attack', 'Pink Floyd', 'Queen', 'David Bowie', 'Led Zeppelin',
  'The Rolling Stones', 'Arctic Monkeys', 'Simon & Garfunkel', 'Miles Davis',
  'Crosby, Stills & Nash', 'LCD Soundsystem',
];

// Bounded so one hung Apple CDN connection cannot stall the scheduled job.
async function headOk(url) {
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.status === 200 || res.status === 206;
  } catch {
    return false;
  }
}

const failures = [];
let checkedArtists = 0;
let totalUrls = 0;
let playableUrls = 0;

for (const artist of CANDIDATES.slice(0, SAMPLE)) {
  const url = `${BASE}/api/search-cache?artist=${encodeURIComponent(artist)}&type=panel`;
  let data = null;
  try {
    // Same bound as headOk — a hung cache read would stall the job just as badly.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    ({ data } = await res.json());
  } catch (err) {
    failures.push(`${artist}: cache request failed (${err.message})`);
    continue;
  }

  if (!data) {
    console.log(`  ${artist.padEnd(24)} not cached (skipped)`);
    continue;
  }

  checkedArtists++;
  const urls = (data.tracks ?? []).map((t) => t.preview_url).filter(Boolean);
  if (urls.length === 0) {
    failures.push(`${artist}: cached panel has zero playable previews`);
    console.log(`  ${artist.padEnd(24)} 0 previews  <-- FAIL`);
    continue;
  }

  const results = await Promise.all(urls.map(headOk));
  const ok = results.filter(Boolean).length;
  totalUrls += urls.length;
  playableUrls += ok;

  const flag = ok < urls.length ? '  <-- dead URLs' : '';
  console.log(`  ${artist.padEnd(24)} ${ok}/${urls.length} playable${flag}`);
  if (ok < urls.length) {
    failures.push(`${artist}: ${urls.length - ok} of ${urls.length} preview URLs are dead`);
  }
}

const ratio = totalUrls ? playableUrls / totalUrls : 0;
console.log(
  `\n${checkedArtists} cached artists, ${playableUrls}/${totalUrls} previews playable ` +
    `(${(ratio * 100).toFixed(1)}%, threshold ${(THRESHOLD * 100).toFixed(0)}%)`
);

if (checkedArtists === 0) {
  console.error('\nFAIL: no cached artists found at all — the shared cache is empty or unreachable.');
  process.exit(1);
}

if (ratio < THRESHOLD) {
  console.error(`\nFAIL: preview health ${(ratio * 100).toFixed(1)}% is below threshold.`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

if (failures.length) {
  console.warn('\nPassed threshold, but with issues:');
  for (const f of failures) console.warn(`  - ${f}`);
}

console.log('\nOK');
