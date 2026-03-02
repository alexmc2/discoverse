import { NextRequest, NextResponse } from 'next/server';
import { cacheKey, getCached, setCached } from '@/lib/server/cache';

type CacheType = 'graph' | 'panel';

const DAY_SECONDS = 24 * 60 * 60;

function parseTtlFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const CACHE_SOFT_TTLS_SECONDS: Record<CacheType, number> = {
  graph: parseTtlFromEnv(process.env.SEARCH_CACHE_GRAPH_TTL_SECONDS, 30 * DAY_SECONDS),
  panel: parseTtlFromEnv(process.env.SEARCH_CACHE_PANEL_TTL_SECONDS, 30 * DAY_SECONDS),
};

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

type CacheEnvelopeV1 = {
  v: 1;
  cachedAt: number;
  data: unknown;
};

function isCacheEnvelopeV1(value: unknown): value is CacheEnvelopeV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CacheEnvelopeV1>;
  return v.v === 1 && typeof v.cachedAt === 'number' && 'data' in v;
}

function unpackCacheEntry(value: unknown): { data: unknown; cachedAt: number | null } {
  if (isCacheEnvelopeV1(value)) {
    return { data: value.data, cachedAt: value.cachedAt };
  }
  // Legacy entry format: raw data only.
  return { data: value, cachedAt: null };
}

function isCacheType(value: string | null): value is CacheType {
  return value === 'graph' || value === 'panel';
}

function normalizeArtistName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeCacheKey(type: CacheType, artistName: string): string {
  return cacheKey(['search-cache', 'v1', type, normalizeArtistName(artistName)]);
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const artist = searchParams.get('artist')?.trim() ?? '';

  if (!isCacheType(type)) return badRequest('Invalid or missing cache type');
  if (!artist) return badRequest('Artist is required');
  if (artist.length > 160) return badRequest('Artist is too long');

  const key = makeCacheKey(type, artist);
  const cached = await getCached<unknown>(key);
  if (cached === null) {
    return NextResponse.json(
      { hit: false, data: null, stale: false, cachedAt: null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { data, cachedAt } = unpackCacheEntry(cached);
  const isStale = cachedAt === null
    ? true
    : Date.now() - cachedAt > CACHE_SOFT_TTLS_SECONDS[type] * 1000;

  return NextResponse.json(
    {
      hit: true,
      stale: isStale,
      cachedAt,
      data,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object') return badRequest('Invalid body');

  const payload = body as {
    type?: string;
    artist?: string;
    data?: unknown;
  };

  const type = payload.type ?? null;
  const artist = payload.artist?.trim() ?? '';
  const data = payload.data;

  if (!isCacheType(type)) return badRequest('Invalid or missing cache type');
  if (!artist) return badRequest('Artist is required');
  if (artist.length > 160) return badRequest('Artist is too long');
  if (data === undefined || data === null) return badRequest('Data is required');

  let serialized = '';
  try {
    serialized = JSON.stringify(data);
  } catch {
    return badRequest('Data must be JSON serializable');
  }

  if (serialized.length > 2_000_000) {
    return badRequest('Payload too large', 413);
  }

  const key = makeCacheKey(type, artist);
  const envelope: CacheEnvelopeV1 = {
    v: 1,
    cachedAt: Date.now(),
    data,
  };
  await setCached(key, envelope, CACHE_HARD_TTLS_SECONDS[type]);

  return NextResponse.json({ ok: true, cachedAt: envelope.cachedAt });
}
