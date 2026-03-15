/**
 * @jest-environment node
 */

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
            name: 'Kashmir',
            preview_url: 'https://example.com/preview.mp3',
            duration_ms: 1000,
            popularity: 80,
            album: { name: 'Physical Graffiti', images: [] },
            artists: [{ name: 'Led Zeppelin' }],
          },
        ],
        trackSource: 'spotify',
      },
    },
  },
}));

describe('getDefaultArtistBootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).MUSIC_CACHE;
  });

  it('prefers healthier bundled panel data over degraded KV data for default artists', async () => {
    const mockKV = {
      get: jest.fn(async (key: string) => {
        if (key !== 'artist-cache:v1') return null;

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
      }),
      put: jest.fn(),
    };

    (globalThis as Record<string, unknown>).MUSIC_CACHE = mockKV;

    const { getDefaultArtistBootstrap } = await import('@/lib/server/artists');
    const result = await getDefaultArtistBootstrap('Led Zeppelin');

    expect(result?.graphData).toBeTruthy();
    expect(result?.panelData?.trackSource).toBe('spotify');
    expect(
      result?.panelData?.tracks.some((track) => !!track.preview_url)
    ).toBe(true);
  });
});
