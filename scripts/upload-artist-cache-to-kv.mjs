#!/usr/bin/env node
// scripts/upload-artist-cache-to-kv.mjs
// Uploads data/artist-cache.json to the MUSIC_CACHE KV namespace.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const file = 'data/artist-cache.json';
if (!existsSync(file)) {
  console.error(`Error: ${file} not found. Run "npm run refresh:artist-cache" first.`);
  process.exit(1);
}

const key = 'artist-cache:v1';

console.log(`Uploading ${file} to KV key "${key}" (preview)...`);
execSync(
  `npx wrangler kv key put "${key}" --binding MUSIC_CACHE --path ${file} --preview --remote`,
  { stdio: 'inherit' }
);

console.log(`Uploading ${file} to KV key "${key}" (production)...`);
execSync(
  `npx wrangler kv key put "${key}" --binding MUSIC_CACHE --path ${file} --preview false --remote`,
  { stdio: 'inherit' }
);

console.log('Done.');
