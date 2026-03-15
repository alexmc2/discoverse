/**
 * @jest-environment node
 */
import { GET } from '@/app/api/random-artists/route';
import { POPULAR_ARTISTS_POOL } from '@/lib/popular-artists';

describe('GET /api/random-artists', () => {
  it('returns 4 random artists', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.artists).toHaveLength(4);
  });

  it('returns artists from the pool', async () => {
    const res = await GET();
    const body = await res.json();

    for (const artist of body.artists) {
      expect(POPULAR_ARTISTS_POOL).toContain(artist);
    }
  });

  it('sets no-cache headers', async () => {
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
