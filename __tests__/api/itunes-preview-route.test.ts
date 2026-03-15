/**
 * @jest-environment node
 */
import { GET } from '@/app/api/itunes-preview/route';

describe('GET /api/itunes-preview', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeRequest(params: Record<string, string>): Request {
    const url = new URL('http://localhost:3000/api/itunes-preview');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    return new Request(url);
  }

  it('returns 400 when artist is missing', async () => {
    const res = await GET(makeRequest({ track: 'Creep' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when track is missing', async () => {
    const res = await GET(makeRequest({ artist: 'Radiohead' }));
    expect(res.status).toBe(400);
  });

  it('returns preview URL for exact match', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          resultCount: 2,
          results: [
            {
              artistName: 'Radiohead',
              trackName: 'Creep',
              previewUrl: 'http://preview.mp3',
            },
            {
              artistName: 'Radiohead',
              trackName: 'Other Song',
              previewUrl: 'http://other.mp3',
            },
          ],
        }),
    });

    const res = await GET(makeRequest({ artist: 'Radiohead', track: 'Creep' }));
    const body = await res.json();

    expect(body.previewUrl).toBe('http://preview.mp3');
  });

  it('falls back to first result with preview when no exact match', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          resultCount: 1,
          results: [
            {
              artistName: 'Different Artist',
              trackName: 'Different Song',
              previewUrl: 'http://fallback.mp3',
            },
          ],
        }),
    });

    const res = await GET(makeRequest({ artist: 'Radiohead', track: 'Creep' }));
    const body = await res.json();

    expect(body.previewUrl).toBe('http://fallback.mp3');
  });

  it('returns null when no results found', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ resultCount: 0, results: [] }),
    });

    const res = await GET(makeRequest({ artist: 'Radiohead', track: 'Creep' }));
    const body = await res.json();

    expect(body.previewUrl).toBeNull();
  });

  it('returns null when iTunes API fails', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const res = await GET(makeRequest({ artist: 'Radiohead', track: 'Creep' }));
    const body = await res.json();

    expect(body.previewUrl).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const res = await GET(makeRequest({ artist: 'Radiohead', track: 'Creep' }));
    const body = await res.json();

    expect(body.previewUrl).toBeNull();
  });

  it('encodes search term correctly in iTunes URL', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultCount: 0, results: [] }),
    });

    await GET(makeRequest({ artist: 'Björk', track: 'Army of Me' }));

    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const calledUrl = fetchCall[0] as string;
    expect(calledUrl).toContain('itunes.apple.com/search');
    expect(calledUrl).toContain(encodeURIComponent('Björk Army of Me'));
  });
});
