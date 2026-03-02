// lib/server/search-cache.ts
'use server';

import { cacheKey, setCached } from '@/lib/server/cache';

type CacheType = 'graph' | 'panel';

const DAY_SECONDS = 24 * 60 * 60;

function parseTtlFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const CACHE_HARD_TTLS_SECONDS: Record<CacheType, number> = {
  graph: parseTtlFromEnv(
    process.env.SEARCH_CACHE_GRAPH_HARD_TTL_SECONDS,
    180 * DAY_SECONDS
  ),
  panel: parseTtlFromEnv(
    process.env.SEARCH_CACHE_PANEL_HARD_TTL_SECONDS,
    180 * DAY_SECONDS
  ),
};

function isCacheType(value: string): value is CacheType {
  return value === 'graph' || value === 'panel';
}

function normalizeArtistName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeCacheKey(type: CacheType, artistName: string): string {
  return cacheKey(['search-cache', 'v1', type, normalizeArtistName(artistName)]);
}

export async function writeSearchCache(
  type: string,
  artistName: string,
  data: unknown
): Promise<{ ok: boolean }> {
  if (!isCacheType(type)) return { ok: false };

  const artist = artistName?.trim() ?? '';
  if (!artist || artist.length > 160) return { ok: false };
  if (data === undefined || data === null) return { ok: false };

  let serialized = '';
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { ok: false };
  }

  if (serialized.length > 2_000_000) return { ok: false };

  const key = makeCacheKey(type, artist);
  const envelope = {
    v: 1 as const,
    cachedAt: Date.now(),
    data,
  };
  await setCached(key, envelope, CACHE_HARD_TTLS_SECONDS[type]);

  return { ok: true };
}
