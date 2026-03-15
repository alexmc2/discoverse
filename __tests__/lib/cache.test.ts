import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheKey, cacheJSON, getCached, setCached } from '@/lib/server/cache';

describe('cacheKey', () => {
  it('joins parts with colons', () => {
    expect(cacheKey(['lf', 'artist.search', 'artist', 'radiohead'])).toBe(
      'lf:artist.search:artist:radiohead'
    );
  });

  it('filters out undefined and null', () => {
    expect(cacheKey(['a', undefined, 'b', null, 'c'])).toBe('a:b:c');
  });

  it('converts numbers to strings', () => {
    expect(cacheKey(['prefix', 42])).toBe('prefix:42');
  });

  it('truncates to 1024 characters', () => {
    const longParts = Array(200).fill('abcdefghij');
    const result = cacheKey(longParts);
    expect(result.length).toBeLessThanOrEqual(1024);
  });

  it('handles empty array', () => {
    expect(cacheKey([])).toBe('');
  });
});

describe('cacheJSON (memory fallback)', () => {
  it('calls fetcher on cache miss and returns result', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
    const result = await cacheJSON('test-miss', 60, fetcher);
    expect(result).toEqual({ data: 'fresh' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns cached value on subsequent calls', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'cached' });
    const key = 'test-hit-' + Date.now();
    await cacheJSON(key, 60, fetcher);
    const result = await cacheJSON(key, 60, fetcher);
    expect(result).toEqual({ data: 'cached' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('re-fetches after TTL expires', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });

    const key = 'test-expire-' + Date.now();
    await cacheJSON(key, 0, fetcher);

    await new Promise((r) => setTimeout(r, 5));

    const result = await cacheJSON(key, 0, fetcher);
    expect(result).toEqual({ v: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('cacheJSON (KV path)', () => {
  let mockKV: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (globalThis as Record<string, unknown>).MUSIC_CACHE = mockKV;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).MUSIC_CACHE;
  });

  it('returns parsed value from KV on cache hit', async () => {
    mockKV.get.mockResolvedValue(JSON.stringify({ name: 'Radiohead' }));
    const fetcher = vi.fn();

    const result = await cacheJSON('kv-hit', 3600, fetcher);

    expect(result).toEqual({ name: 'Radiohead' });
    expect(mockKV.get).toHaveBeenCalledWith('kv-hit');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls fetcher and stores in KV on cache miss', async () => {
    mockKV.get.mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue({ name: 'Bjork' });

    const result = await cacheJSON('kv-miss', 3600, fetcher);

    expect(result).toEqual({ name: 'Bjork' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockKV.put).toHaveBeenCalledWith(
      'kv-miss',
      JSON.stringify({ name: 'Bjork' }),
      { expirationTtl: 3600 }
    );
  });

  it('falls through to memory when KV.get throws', async () => {
    mockKV.get.mockRejectedValue(new Error('KV unavailable'));
    const fetcher = vi.fn().mockResolvedValue({ fallback: true });

    const result = await cacheJSON('kv-error-' + Date.now(), 60, fetcher);

    expect(result).toEqual({ fallback: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('getCached (KV path)', () => {
  let mockKV: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (globalThis as Record<string, unknown>).MUSIC_CACHE = mockKV;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).MUSIC_CACHE;
  });

  it('returns parsed value from KV when present', async () => {
    mockKV.get.mockResolvedValue(JSON.stringify({ cached: true }));
    const result = await getCached('some-key');
    expect(result).toEqual({ cached: true });
  });

  it('returns null from KV when key not found', async () => {
    mockKV.get.mockResolvedValue(null);
    const result = await getCached('missing-key');
    expect(result).toBeNull();
  });

  it('falls through to memory when KV throws', async () => {
    mockKV.get.mockRejectedValue(new Error('KV down'));
    const result = await getCached('error-key');
    expect(result).toBeNull();
  });
});

describe('setCached (KV path)', () => {
  let mockKV: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (globalThis as Record<string, unknown>).MUSIC_CACHE = mockKV;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).MUSIC_CACHE;
  });

  it('stores value in KV with TTL', async () => {
    await setCached('set-key', { data: 42 }, 7200);

    expect(mockKV.put).toHaveBeenCalledWith(
      'set-key',
      JSON.stringify({ data: 42 }),
      { expirationTtl: 7200 }
    );
  });

  it('falls through to memory when KV.put throws', async () => {
    mockKV.put.mockRejectedValue(new Error('KV write failed'));

    // Should not throw — falls through to memory
    await expect(setCached('fail-key', { x: 1 }, 60)).resolves.toBeUndefined();
  });
});
