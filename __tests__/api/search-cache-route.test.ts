/**
 * @jest-environment node
 */
const mockKV = {
  get: jest.fn(),
  put: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/lib/server/cache', () => ({
  getKV: jest.fn(() => mockKV),
}));

jest.mock('@/data/artist-cache.json', () => ({
  __esModule: true,
  default: {
    'led zeppelin': {
      graphData: { nodes: [{ id: 'led-zeppelin' }], links: [] },
      panelData: {
        artist: {
          name: 'Led Zeppelin',
          url: 'https://www.last.fm/music/Led+Zeppelin',
          listeners: 1000,
          playcount: 1000,
          tags: [],
        },
        tracks: [
          {
            id: 'lz-spotify-1',
            name: 'Stairway to Heaven',
            preview_url: 'https://example.com/preview.mp3',
            duration_ms: 482000,
            popularity: 100,
            album: { name: 'Led Zeppelin IV', images: [] },
            artists: [{ name: 'Led Zeppelin' }],
          },
        ],
        trackSource: 'spotify',
      },
    },
  },
}));

import { POST } from '@/app/api/search-cache/route';
import { GET } from '@/app/api/search-cache/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/search-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search-cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores graph data in KV with correct key', async () => {
    const graphData = { nodes: [{ id: 'a' }], links: [] };
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'graph', data: graphData })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockKV.put).toHaveBeenCalledTimes(1);
    const [key, payload, opts] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:graph:radiohead');
    const stored = JSON.parse(payload);
    expect(stored.data).toEqual(graphData);
    expect(stored.v).toBe(1);
    expect(typeof stored.cachedAt).toBe('number');
    expect(opts.expirationTtl).toBe(180 * 24 * 60 * 60);
  });

  it('stores panel data in KV with correct key', async () => {
    const panelData = { artist: { name: 'Radiohead' }, tracks: [] };
    const res = await POST(
      makeRequest({ artist: 'Radiohead', type: 'panel', data: panelData })
    );

    expect(res.status).toBe(200);
    const [key] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:panel:radiohead'); // no special chars, unchanged
  });

  it('normalizes artist name to lowercase', async () => {
    await POST(
      makeRequest({ artist: '  Björk  ', type: 'graph', data: { nodes: [] } })
    );

    const [key] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:graph:bj%C3%B6rk');
  });

  it('encodes reserved characters in artist name', async () => {
    await POST(
      makeRequest({
        artist: 'Simon & Garfunkel',
        type: 'graph',
        data: { nodes: [] },
      })
    );

    const [key] = mockKV.put.mock.calls[0];
    expect(key).toBe('search-cache:v1:graph:simon%20%26%20garfunkel');
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

describe('GET /api/search-cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to the healthier bundled default artist panel when KV data is degraded', async () => {
    mockKV.get.mockImplementation(async (key: string) => {
      if (key === 'search-cache:v1:panel:led zeppelin') return null;
      if (key === 'artist-cache:v1') {
        return JSON.stringify({
          'led zeppelin': {
            graphData: { nodes: [{ id: 'led-zeppelin' }], links: [] },
            panelData: {
              artist: {
                name: 'Led Zeppelin',
                url: 'https://www.last.fm/music/Led+Zeppelin',
                listeners: 1,
                playcount: 1,
                tags: [],
              },
              tracks: [
                {
                  id: 'lz-1',
                  name: 'Stairway to Heaven',
                  preview_url: null,
                  duration_ms: 0,
                  popularity: 0,
                  album: { name: '—', images: [] },
                  artists: [{ name: 'Led Zeppelin' }],
                },
              ],
              trackSource: 'lastfm',
            },
          },
        });
      }
      return null;
    });

    const res = await GET(
      new Request(
        'http://localhost:3000/api/search-cache?artist=Led%20Zeppelin&type=panel'
      )
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.trackSource).toBe('spotify');
    expect(body.data.tracks.length).toBeGreaterThan(0);
    expect(body.data.tracks.some((track: { preview_url: string | null }) => !!track.preview_url)).toBe(
      true
    );
  });
});

describe('POST /api/search-cache (no KV)', () => {
  it('returns 503 when KV is not available', async () => {
    jest.resetModules();
    jest.doMock('@/lib/server/cache', () => ({
      getKV: jest.fn(() => null),
    }));

    const { POST: POST2 } = await import('@/app/api/search-cache/route');

    const res = await POST2(
      makeRequest({ artist: 'Radiohead', type: 'graph', data: {} })
    );
    expect(res.status).toBe(503);
  });
});
