import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockKV = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/server/cache', () => ({
  getKV: vi.fn(() => mockKV),
}));

import { POST } from '@/app/api/search-cache/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/search-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores graph data in KV with correct key', async () => {
    const graphData = { nodes: [{ id: 'a' }], links: [] };
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'graph', data: graphData })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockKV.put).toHaveBeenCalledOnce();
    const [key, payload, opts] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:graph:radiohead');
    const stored = JSON.parse(payload);
    expect(stored.data).toEqual(graphData);
    expect(stored.v).toBe(1);
    expect(stored.cachedAt).toBeTypeOf('number');
    // 180 days TTL
    expect(opts.expirationTtl).toBe(180 * 24 * 60 * 60);
  });

  it('stores panel data in KV with correct key', async () => {
    const panelData = { artist: { name: 'Radiohead' }, tracks: [] };
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'panel', data: panelData })
    );

    expect(res.status).toBe(200);
    const [key] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:panel:radiohead');
  });

  it('normalizes artist name to lowercase', async () => {
    await POST(
      makeRequest({ artist: '  Björk  ', type: 'graph', data: { nodes: [] } })
    );

    const [key] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:graph:björk');
  });

  it('returns 400 for invalid body', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/search-cache', {
        method: 'POST',
        body: 'not json',
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when artist is missing', async () => {
    const res = await POST(makeRequest({ type: 'graph', data: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when type is invalid', async () => {
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'invalid', data: {} })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when data is missing', async () => {
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'graph' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 when KV.put fails', async () => {
    mockKV.put.mockRejectedValueOnce(new Error('KV write failed'));

    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'graph', data: {} })
    );
    expect(res.status).toBe(500);
  });
});

describe('POST /api/search-cache (no KV)', () => {
  it('returns 503 when KV is not available', async () => {
    // Re-mock with null KV
    vi.resetModules();
    vi.doMock('@/lib/server/cache', () => ({
      getKV: vi.fn(() => null),
    }));

    const { POST: POST2 } = await import('@/app/api/search-cache/route');

    const res = await POST2(
      makeRequest({ artist: 'Radiohead', type: 'graph', data: {} })
    );
    expect(res.status).toBe(503);
  });
});
