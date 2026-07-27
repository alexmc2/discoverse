// Mock the cache module so spotify doesn't hit real caches
jest.mock('@/lib/server/cache', () => ({
  cacheJSON: jest.fn((_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
  cacheKey: jest.fn((...args: unknown[]) => String(args)),
  getKV: jest.fn(() => null),
  getCached: jest.fn(() => Promise.resolve(null)),
  setCached: jest.fn(() => Promise.resolve()),
}));

describe('spotify module', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetModules();
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('searchSpotifyArtist', () => {
    it('returns the first artist from Spotify search results', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [{ url: 'http://img.jpg', height: 300, width: 300 }],
        genres: ['alternative rock'],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              artists: { items: [mockArtist] },
            }),
        });

      const { searchSpotifyArtist } = await import('@/lib/spotify');
      const result = await searchSpotifyArtist('Radiohead');

      expect(result).toEqual(mockArtist);
    });

    it('returns null when search has no results', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              artists: { items: [] },
            }),
        });

      const { searchSpotifyArtist } = await import('@/lib/spotify');
      const result = await searchSpotifyArtist('xyznonexistent');

      expect(result).toBeNull();
    });

    it('returns null when no token is available', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { searchSpotifyArtist } = await import('@/lib/spotify');
      const result = await searchSpotifyArtist('Radiohead');

      expect(result).toBeNull();
    });
  });

  describe('getArtistImage', () => {
    it('returns the second image URL when multiple are available', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [
          { url: 'http://large.jpg', height: 640, width: 640 },
          { url: 'http://medium.jpg', height: 300, width: 300 },
          { url: 'http://small.jpg', height: 64, width: 64 },
        ],
        genres: [],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        });

      const { getArtistImage } = await import('@/lib/spotify');
      const result = await getArtistImage('Radiohead');

      expect(result).toBe('http://medium.jpg');
    });

    it('returns first image when only one is available', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [{ url: 'http://only.jpg', height: 640, width: 640 }],
        genres: [],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        });

      const { getArtistImage } = await import('@/lib/spotify');
      const result = await getArtistImage('Radiohead');

      expect(result).toBe('http://only.jpg');
    });

    it('returns undefined when artist has no images', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [],
        genres: [],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        });

      const { getArtistImage } = await import('@/lib/spotify');
      const result = await getArtistImage('Radiohead');

      expect(result).toBeUndefined();
    });
  });

  describe('getArtistSpotifyUrl', () => {
    it('returns the correct Spotify URL', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [],
        genres: [],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        });

      const { getArtistSpotifyUrl } = await import('@/lib/spotify');
      const result = await getArtistSpotifyUrl('Radiohead');

      expect(result).toBe('https://open.spotify.com/artist/abc123');
    });
  });

  describe('getArtistTopTracks', () => {
    it('returns top tracks for an artist', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [],
        genres: [],
        popularity: 80,
      };
      const mockTracks = [
        {
          id: 'track1',
          name: 'Creep',
          preview_url: 'http://preview.mp3',
          duration_ms: 240000,
          popularity: 75,
          album: { name: 'Pablo Honey', images: [] },
          artists: [{ name: 'Radiohead' }],
        },
      ];

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tracks: mockTracks }),
        });

      const { getArtistTopTracks } = await import('@/lib/spotify');
      const result = await getArtistTopTracks('Radiohead');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Creep');
      expect(result[0].preview_url).toBe('http://preview.mp3');
    });

    it('returns empty array when no token available', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { getArtistTopTracks } = await import('@/lib/spotify');
      const result = await getArtistTopTracks('Radiohead');

      expect(result).toEqual([]);
    });

    it('uses one batch preview lookup when Spotify tracks lack previews', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [],
        genres: [],
        popularity: 80,
      };
      const mockTracks = [
        {
          id: 'track1',
          name: 'Creep',
          preview_url: null,
          duration_ms: 240000,
          popularity: 75,
          album: { name: 'Pablo Honey', images: [] },
          artists: [{ name: 'Radiohead' }],
        },
        {
          id: 'track2',
          name: 'Karma Police',
          preview_url: null,
          duration_ms: 0,
          popularity: 70,
          album: { name: '—', images: [] },
          artists: [{ name: 'Radiohead' }],
        },
      ];

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tracks: mockTracks }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              lookupSucceeded: true,
              matches: [
                {
                  previewUrl: 'https://audio.example/creep.m4a',
                },
                {
                  previewUrl: 'https://audio.example/karma.m4a',
                  albumName: 'OK Computer',
                  durationMs: 264000,
                },
              ],
            }),
        });

      const { getArtistTopTracksWithPreviews } = await import(
        '@/lib/spotify'
      );
      const result = await getArtistTopTracksWithPreviews(
        'Radiohead',
        'GB'
      );

      expect(result.previewLookupSucceeded).toBe(true);
      expect(result.tracks.map((track) => track.preview_url)).toEqual([
        'https://audio.example/creep.m4a',
        'https://audio.example/karma.m4a',
      ]);
      expect(result.tracks[1].album.name).toBe('OK Computer');
      expect(result.tracks[1].duration_ms).toBe(264000);

      const calls = (globalThis.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(4);
      expect(
        calls.filter(([url]) =>
          String(url).includes('/top-tracks?market=')
        )
      ).toHaveLength(1);
      expect(calls[3][0]).toBe('/api/itunes-preview');
      expect(calls[3][1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(calls[3][1].body)).toMatchObject({
        artist: 'Radiohead',
        country: 'GB',
        tracks: [
          { name: 'Creep', artist: 'Radiohead' },
          { name: 'Karma Police', artist: 'Radiohead' },
        ],
      });
    });

    it('preserves Spotify data when the batch preview lookup fails', async () => {
      const originalTracks = [
        {
          id: 'track1',
          name: 'Creep',
          preview_url: 'https://audio.example/native.m4a',
          duration_ms: 240000,
          popularity: 75,
          album: { name: 'Pablo Honey', images: [] },
          artists: [{ name: 'Radiohead' }],
        },
        {
          id: 'track2',
          name: 'Karma Police',
          preview_url: null,
          duration_ms: 264000,
          popularity: 70,
          album: { name: 'OK Computer', images: [] },
          artists: [{ name: 'Radiohead' }],
        },
      ];
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      const { enrichTracksWithITunesPreviews } = await import(
        '@/lib/spotify'
      );
      const result = await enrichTracksWithITunesPreviews(
        'Radiohead',
        originalTracks,
        'GB'
      );

      expect(result.lookupSucceeded).toBe(false);
      expect(result.tracks).toEqual(originalTracks);
      expect(result.tracks).not.toBe(originalTracks);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns no Spotify tracks when the top-tracks endpoint is unavailable', async () => {
      const mockArtist = {
        id: 'abc123',
        name: 'Radiohead',
        images: [],
        genres: [],
        popularity: 80,
      };

      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ artists: { items: [mockArtist] } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
        });

      const { getArtistTopTracksWithPreviews } = await import(
        '@/lib/spotify'
      );
      const result = await getArtistTopTracksWithPreviews('Radiohead');

      expect(result).toEqual({
        tracks: [],
        previewLookupSucceeded: false,
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
