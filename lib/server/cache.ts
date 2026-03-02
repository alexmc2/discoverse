// lib/server/cache.ts
// Lightweight JSON cache that prefers Cloudflare KV when available,
// with an in-memory fallback for local dev.

type KVLike = {
  get: (key: string, opts?: { type?: 'text' | 'json' }) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    opts?: { expirationTtl?: number }
  ) => Promise<void>;
};

type CloudflareContextLike = {
  env?: {
    MUSIC_CACHE?: KVLike;
  };
};

const cloudflareContextSymbol = Symbol.for('__cloudflare-context__');

function getKVFromContext(): KVLike | null {
  const g = globalThis as Record<string | symbol, unknown>;
  const context = g[cloudflareContextSymbol] as CloudflareContextLike | undefined;
  return context?.env?.MUSIC_CACHE ?? null;
}

// Detect a bound KV namespace (configure binding name in wrangler.jsonc)
async function getKV(): Promise<KVLike | null> {
  // Legacy fallback if a binding is attached directly to global scope.
  const g = globalThis as unknown as { MUSIC_CACHE?: KVLike };
  if (g.MUSIC_CACHE) return g.MUSIC_CACHE;

  // OpenNext/Cloudflare stores bindings under the Cloudflare context symbol.
  return getKVFromContext();
}

export async function getMusicCacheKV(): Promise<KVLike | null> {
  return getKV();
}

// Simple in-memory fallback (per-isolate, non-persistent)
const memory = new Map<string, { v: string; exp: number }>();

export async function cacheJSON<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const kv = await getKV();
  const now = Date.now();

  if (kv) {
    try {
      const hit = await kv.get(key);
      if (hit) {
        return JSON.parse(hit) as T;
      }
      const fresh = await fetcher();
      // Best-effort store; ignore failures
      kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds }).catch(() => {});
      return fresh;
    } catch {
      // fall through to memory cache
    }
  }

  // Memory fallback
  const rec = memory.get(key);
  if (rec && rec.exp > now) {
    return JSON.parse(rec.v) as T;
  }
  const fresh = await fetcher();
  memory.set(key, { v: JSON.stringify(fresh), exp: now + ttlSeconds * 1000 });
  return fresh;
}

export function cacheKey(parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p))
    .join(':')
    .slice(0, 1024); // guard against extreme keys
}

// Optional helpers when you want to check first, then decide whether to set
export async function getCached<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  const now = Date.now();
  if (kv) {
    try {
      const hit = await kv.get(key);
      return hit ? (JSON.parse(hit) as T) : null;
    } catch {
      // fall through
    }
  }
  const rec = memory.get(key);
  if (rec && rec.exp > now) {
    return JSON.parse(rec.v) as T;
  }
  return null;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const kv = await getKV();
  const now = Date.now();
  const payload = JSON.stringify(value);
  if (kv) {
    try {
      await kv.put(key, payload, { expirationTtl: ttlSeconds });
      return;
    } catch {
      // fall through to memory
    }
  }
  memory.set(key, { v: payload, exp: now + ttlSeconds * 1000 });
}
