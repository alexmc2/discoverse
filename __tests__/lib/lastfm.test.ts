// Mock cache so lastfm calls pass through to our mocked fetch
jest.mock('@/lib/server/cache', () => ({
  cacheJSON: jest.fn((_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
  cacheKey: jest.fn((...args: unknown[]) => String(args)),
  getKV: jest.fn(() => null),
}));

// Mock spotify (lastfm imports getArtistImage from spotify)
jest.mock('@/lib/spotify', () => ({
  getArtistImage: jest.fn(() => Promise.resolve(undefined)),
}));

import {
  isSupportedLastfmMethod,
  SUPPORTED_LASTFM_METHODS,
  searchArtist,
  getSimilarArtists,
  getArtistTags,
  getArtistInfo,
  getTopTracks,
  getTopChartArtistNames,
} from '@/lib/lastfm';

describe('isSupportedLastfmMethod', () => {
  it('returns true for all supported methods', () => {
    for (const method of SUPPORTED_LASTFM_METHODS) {
      expect(isSupportedLastfmMethod(method)).toBe(true);
    }
  });

  it('returns false for unsupported methods', () => {
    expect(isSupportedLastfmMethod('artist.delete')).toBe(false);
    expect(isSupportedLastfmMethod('user.getinfo')).toBe(false);
    expect(isSupportedLastfmMethod('')).toBe(false);
  });
});

describe('searchArtist', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns empty array for empty query', async () => {
    const result = await searchArtist('');
    expect(result).toEqual([]);
  });

  it('returns filtered artists above minimum listeners', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: {
            artistmatches: {
              artist: [
                { name: 'Radiohead', mbid: 'mbid1', listeners: '5000000', image: [] },
                { name: 'Tiny Band', mbid: 'mbid2', listeners: '10', image: [] },
                { name: 'Medium Act', mbid: 'mbid3', listeners: '500', image: [] },
              ],
            },
          },
        }),
    });

    const result = await searchArtist('Radio');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Radiohead');
    expect(result[1].name).toBe('Medium Act');
  });

  it('uses custom minListeners threshold', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: {
            artistmatches: {
              artist: [
                { name: 'Big Artist', listeners: '1000', image: [] },
                { name: 'Small Artist', listeners: '100', image: [] },
              ],
            },
          },
        }),
    });

    const result = await searchArtist('test', 500);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Big Artist');
  });
});

describe('getSimilarArtists', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns similar artists with match scores', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          similarartists: {
            artist: [
              { name: 'Thom Yorke', match: '0.95', mbid: 'm1', image: [] },
              { name: 'Muse', match: '0.7', mbid: 'm2', image: [] },
            ],
          },
        }),
    });

    const result = await getSimilarArtists('Radiohead');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Thom Yorke');
    expect(result[0].match).toBe(0.95);
    expect(result[1].name).toBe('Muse');
    expect(result[1].match).toBe(0.7);
  });

  it('handles empty response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ similarartists: {} }),
    });

    const result = await getSimilarArtists('Unknown');
    expect(result).toEqual([]);
  });
});

describe('getArtistTags', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns top 5 tags', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          toptags: {
            tag: [
              { name: 'rock' },
              { name: 'alternative' },
              { name: 'indie' },
              { name: 'electronic' },
              { name: 'experimental' },
              { name: 'british' },
            ],
          },
        }),
    });

    const result = await getArtistTags('Radiohead');

    expect(result).toHaveLength(5);
    expect(result).toEqual(['rock', 'alternative', 'indie', 'electronic', 'experimental']);
  });

  it('handles empty tags', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ toptags: {} }),
    });

    const result = await getArtistTags('Unknown');
    expect(result).toEqual([]);
  });
});

describe('getArtistInfo', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed artist info', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          artist: {
            name: 'Radiohead',
            url: 'https://last.fm/radiohead',
            image: [
              { '#text': 'http://small.jpg', size: 'small' },
              { '#text': 'http://large.jpg', size: 'extralarge' },
            ],
            stats: { listeners: '5000000', playcount: '300000000' },
            bio: { summary: 'English rock band.<a href="...">Read more</a>' },
            tags: { tag: [{ name: 'rock' }, { name: 'alternative' }] },
          },
        }),
    });

    const result = await getArtistInfo('Radiohead');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Radiohead');
    expect(result!.listeners).toBe(5000000);
    expect(result!.playcount).toBe(300000000);
    expect(result!.bio).toBe('English rock band.');
    expect(result!.tags).toEqual(['rock', 'alternative']);
    expect(result!.image).toBe('http://large.jpg');
  });

  it('strips HTML from bio and truncates at "Read more"', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          artist: {
            name: 'Test',
            stats: { listeners: '100' },
            bio: { summary: '<p>Some <b>bold</b> text.</p> Read more on Last.fm' },
            tags: { tag: [] },
          },
        }),
    });

    const result = await getArtistInfo('Test');
    expect(result!.bio).toBe('Some bold text. ');
  });

  it('returns null when artist not found', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await getArtistInfo('xyznonexistent');
    expect(result).toBeNull();
  });
});

describe('getTopTracks', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed tracks', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          toptracks: {
            track: [
              {
                name: 'Creep',
                playcount: '100000',
                url: 'https://last.fm/creep',
                artist: { name: 'Radiohead' },
              },
              {
                name: 'Karma Police',
                playcount: '90000',
                url: 'https://last.fm/karma',
                artist: { name: 'Radiohead' },
              },
            ],
          },
        }),
    });

    const result = await getTopTracks('Radiohead');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'Creep',
      playcount: 100000,
      url: 'https://last.fm/creep',
      artist: 'Radiohead',
    });
  });
});

describe('getTopChartArtistNames', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LASTFM_API_KEY = 'test-key';
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns chart artist names', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          artists: {
            artist: [
              { name: 'Taylor Swift' },
              { name: 'The Weeknd' },
              { name: '' },
              { name: 'Drake' },
            ],
          },
        }),
    });

    const result = await getTopChartArtistNames(50);

    expect(result).toEqual(['Taylor Swift', 'The Weeknd', 'Drake']);
  });
});
