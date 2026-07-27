/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/itunes-preview/route';

describe('/api/itunes-preview', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeGetRequest(params: Record<string, string>): Request {
    const url = new URL('http://localhost:3000/api/itunes-preview');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new Request(url);
  }

  function makePostRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/itunes-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('GET compatibility endpoint', () => {
    it('returns 400 when artist or track is missing', async () => {
      const withoutArtist = await GET(makeGetRequest({ track: 'Creep' }));
      const withoutTrack = await GET(
        makeGetRequest({ artist: 'Radiohead' })
      );

      expect(withoutArtist.status).toBe(400);
      expect(withoutTrack.status).toBe(400);
    });

    it('returns the exact artist and track preview', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            resultCount: 2,
            results: [
              {
                artistName: 'Radiohead',
                trackName: 'Creep',
                previewUrl: 'https://audio.example/creep.m4a',
              },
              {
                artistName: 'Radiohead',
                trackName: 'Other Song',
                previewUrl: 'https://audio.example/other.m4a',
              },
            ],
          }),
      });

      const response = await GET(
        makeGetRequest({ artist: 'Radiohead', track: 'Creep' })
      );

      await expect(response.json()).resolves.toEqual({
        previewUrl: 'https://audio.example/creep.m4a',
      });
    });

    it('does not substitute an unrelated artist or track', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            resultCount: 1,
            results: [
              {
                artistName: 'Different Artist',
                trackName: 'Different Song',
                previewUrl: 'https://audio.example/wrong.m4a',
              },
            ],
          }),
      });

      const response = await GET(
        makeGetRequest({ artist: 'Radiohead', track: 'Creep' })
      );

      await expect(response.json()).resolves.toEqual({ previewUrl: null });
    });

    it('uses a targeted Apple search with a normalized country', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ resultCount: 0, results: [] }),
      });

      await GET(
        makeGetRequest({
          artist: 'Björk',
          track: 'Army of Me',
          country: 'us',
        })
      );

      const [calledUrl, options] = (
        globalThis.fetch as jest.Mock
      ).mock.calls[0] as [string, RequestInit];
      const url = new URL(calledUrl);
      expect(url.hostname).toBe('itunes.apple.com');
      expect(url.searchParams.get('term')).toBe('Björk Army of Me');
      expect(url.searchParams.has('attribute')).toBe(false);
      expect(url.searchParams.get('entity')).toBe('song');
      expect(url.searchParams.get('limit')).toBe('25');
      expect(url.searchParams.get('country')).toBe('US');
      expect(options.cache).toBe('no-store');
    });

    it('surfaces upstream failures instead of caching a silent null', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const response = await GET(
        makeGetRequest({ artist: 'Radiohead', track: 'Creep' })
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ previewUrl: null });
    });

    it('preserves an upstream rate-limit status', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      const response = await GET(
        makeGetRequest({ artist: 'Radiohead', track: 'Creep' })
      );

      expect(response.status).toBe(429);
    });

    it('returns 502 when the Apple request throws', async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const response = await GET(
        makeGetRequest({ artist: 'Radiohead', track: 'Creep' })
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ previewUrl: null });
    });
  });

  describe('POST batch endpoint', () => {
    it('matches a track list with one Apple request and preserves order', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            resultCount: 3,
            results: [
              {
                artistName: 'Duran Duran',
                trackName: 'Come Undone',
                previewUrl: 'https://audio.example/come-undone.m4a',
                collectionName: 'Duran Duran',
                trackTimeMillis: 256000,
              },
              {
                artistName: 'Duran Duran',
                trackName: 'Hungry Like the Wolf (2009 Remaster)',
                previewUrl: 'https://audio.example/hungry.m4a',
                collectionName: "Rio (Collector's Edition)",
                trackTimeMillis: 220000,
              },
              {
                artistName: 'Unrelated Band',
                trackName: 'Ordinary World',
                previewUrl: 'https://audio.example/wrong.m4a',
              },
            ],
          }),
      });

      const response = await POST(
        makePostRequest({
          artist: 'Duran Duran',
          country: 'gb',
          tracks: [
            { name: 'Ordinary World', artist: 'Duran Duran' },
            { name: 'Come Undone', artist: 'Duran Duran' },
            {
              name: 'Hungry Like the Wolf - 2009 Remaster',
              artist: 'Duran Duran',
            },
          ],
        })
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        lookupSucceeded: true,
        matches: [
          { previewUrl: null },
          {
            previewUrl: 'https://audio.example/come-undone.m4a',
            albumName: 'Duran Duran',
            durationMs: 256000,
          },
          {
            previewUrl: 'https://audio.example/hungry.m4a',
            albumName: "Rio (Collector's Edition)",
            durationMs: 220000,
          },
        ],
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const appleUrl = new URL(
        (globalThis.fetch as jest.Mock).mock.calls[0][0] as string
      );
      expect(appleUrl.searchParams.get('term')).toBe('Duran Duran');
      expect(appleUrl.searchParams.get('attribute')).toBe('artistTerm');
      expect(appleUrl.searchParams.get('limit')).toBe('200');
    });

    it('rejects empty, malformed, and oversized track lists', async () => {
      const empty = await POST(
        makePostRequest({ artist: 'Radiohead', tracks: [] })
      );
      const malformed = await POST(
        makePostRequest({
          artist: 'Radiohead',
          tracks: [{ name: '' }],
        })
      );
      const oversized = await POST(
        makePostRequest({
          artist: 'Radiohead',
          tracks: Array.from({ length: 11 }, (_, index) => ({
            name: `Track ${index}`,
          })),
        })
      );

      expect(empty.status).toBe(400);
      expect(malformed.status).toBe(400);
      expect(oversized.status).toBe(400);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns 429 and marks the lookup unsuccessful when Apple rate-limits', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      const response = await POST(
        makePostRequest({
          artist: 'Radiohead',
          tracks: [{ name: 'Creep' }],
        })
      );

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual({
        matches: [{ previewUrl: null }],
        lookupSucceeded: false,
      });
    });
  });
});
