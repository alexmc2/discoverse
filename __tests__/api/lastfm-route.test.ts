/**
 * @jest-environment node
 */
jest.mock('@/lib/lastfm', () => ({
  isSupportedLastfmMethod: jest.fn((m: string) =>
    ['artist.search', 'artist.getsimilar', 'artist.gettoptags', 'artist.getinfo', 'artist.gettoptracks', 'chart.gettopartists'].includes(m)
  ),
  getLastfmMethodData: jest.fn(),
}));

import { GET } from '@/app/api/lastfm/route';
import { getLastfmMethodData } from '@/lib/lastfm';
import { NextRequest } from 'next/server';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/lastfm');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe('GET /api/lastfm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when method parameter is missing', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Method parameter is required');
  });

  it('returns 400 for unsupported method', async () => {
    const res = await GET(makeRequest({ method: 'user.getinfo' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unsupported method');
  });

  it('forwards params and returns data for valid method', async () => {
    const mockData = { results: { artistmatches: { artist: [] } } };
    (getLastfmMethodData as jest.Mock).mockResolvedValue(mockData);

    const res = await GET(makeRequest({ method: 'artist.search', artist: 'Radiohead' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual(mockData);
    expect(getLastfmMethodData).toHaveBeenCalledWith('artist.search', {
      artist: 'Radiohead',
      limit: '20',
    });
  });

  it('strips api_key and format from forwarded params', async () => {
    (getLastfmMethodData as jest.Mock).mockResolvedValue({});

    await GET(
      makeRequest({
        method: 'artist.getinfo',
        artist: 'Radiohead',
        api_key: 'SHOULD_NOT_FORWARD',
        format: 'json',
      })
    );

    expect(getLastfmMethodData).toHaveBeenCalledWith('artist.getinfo', {
      artist: 'Radiohead',
    });
  });

  it('adds default limit for methods that need it', async () => {
    (getLastfmMethodData as jest.Mock).mockResolvedValue({});

    await GET(makeRequest({ method: 'artist.getsimilar', artist: 'Radiohead' }));

    expect(getLastfmMethodData).toHaveBeenCalledWith('artist.getsimilar', {
      artist: 'Radiohead',
      limit: '20',
    });
  });

  it('does not override explicit limit', async () => {
    (getLastfmMethodData as jest.Mock).mockResolvedValue({});

    await GET(makeRequest({ method: 'artist.getsimilar', artist: 'Radiohead', limit: '5' }));

    expect(getLastfmMethodData).toHaveBeenCalledWith('artist.getsimilar', {
      artist: 'Radiohead',
      limit: '5',
    });
  });

  it('returns 500 when getLastfmMethodData throws', async () => {
    (getLastfmMethodData as jest.Mock).mockRejectedValue(new Error('API down'));

    const res = await GET(makeRequest({ method: 'artist.search', artist: 'Radiohead' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to fetch');
  });

  it('sets cache headers on success', async () => {
    (getLastfmMethodData as jest.Mock).mockResolvedValue({});

    const res = await GET(makeRequest({ method: 'artist.getinfo', artist: 'Radiohead' }));
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
  });
});
