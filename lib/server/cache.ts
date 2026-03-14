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

// Detect a bound KV namespace (configure binding name in wrangler.jsonc)
export function getKV(): KVLike | null {
  // Use a typed view of globalThis to avoid `any` and keep lint happy.
  const g = globalThis as unknown as { MUSIC_CACHE?: KVLike };
  return g.MUSIC_CACHE ?? null;
}

// Simple in-memory fallback (per-isolate, non-persistent)
const memory = new Map<string, { v: string; exp: number }>();

export async function cacheJSON<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const kv = getKV();
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
  const kv = getKV();
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
  const kv = getKV();
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
