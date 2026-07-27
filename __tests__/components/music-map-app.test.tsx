import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replaceMock = jest.fn();
const refreshMock = jest.fn();
const mockBuildGraphData = jest.fn();
const mockGetArtistInfo = jest.fn();
const mockGetLastFmTopTracks = jest.fn();
const mockGetArtistImage = jest.fn();
const mockGetArtistSpotifyUrl = jest.fn();
const mockGetArtistTopTracksWithPreviews = jest.fn();
const mockEnrichTracksWithITunesPreviews = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

jest.mock('next/dynamic', () => () => {
  return function MockDynamicComponent({
    data,
    onNodeClick,
  }: {
    data: {
      nodes: Array<{
        id: string;
        name: string;
        group?: string;
        size?: number;
        tags?: string[];
        depth?: number;
        image?: string;
      }>;
    };
    onNodeClick: (node: {
      id: string;
      name: string;
      group?: string;
      size?: number;
      tags?: string[];
      depth?: number;
      image?: string;
    }) => void;
  }) {
    return (
      <div data-testid="music-graph">
        {data.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onNodeClick(node)}
          >
            Open {node.name}
          </button>
        ))}
      </div>
    );
  };
});

jest.mock('next/image', () => {
  return function MockImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ''} />;
  };
});

jest.mock('@/components/loading-screen', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => (
    <div>{message ?? 'Loading'}</div>
  ),
}));

jest.mock('@/components/ui/header', () => ({
  __esModule: true,
  default: ({
    onSearch,
    onClearData,
  }: {
    onSearch: (artistName: string) => void;
    onClearData: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSearch('Morcheeba')}>
        Search Morcheeba
      </button>
      <button type="button" onClick={onClearData}>
        Reset Graph
      </button>
    </div>
  ),
}));

jest.mock('@/components/default-content', () => ({
  __esModule: true,
  default: () => <div>Default Content</div>,
}));

jest.mock('@/components/ui/mode-toggle', () => ({
  __esModule: true,
  default: () => <div>Mode Toggle</div>,
}));

jest.mock('@/components/ui/legend', () => ({
  __esModule: true,
  default: () => <div>Legend</div>,
}));

jest.mock('@/lib/lastfm', () => ({
  buildGraphData: (...args: unknown[]) => mockBuildGraphData(...args),
  getArtistInfo: (...args: unknown[]) => mockGetArtistInfo(...args),
  getTopTracks: (...args: unknown[]) => mockGetLastFmTopTracks(...args),
}));

jest.mock('@/lib/spotify', () => ({
  enrichTracksWithITunesPreviews: (...args: unknown[]) =>
    mockEnrichTracksWithITunesPreviews(...args),
  getArtistImage: (...args: unknown[]) => mockGetArtistImage(...args),
  getArtistSpotifyUrl: (...args: unknown[]) =>
    mockGetArtistSpotifyUrl(...args),
  getArtistTopTracksWithPreviews: (...args: unknown[]) =>
    mockGetArtistTopTracksWithPreviews(...args),
}));

jest.mock('@/components/artist-panel', () => ({
  __esModule: true,
  default: ({
    artistName,
    artist,
    tracks,
    tracksLoading,
  }: {
    artistName: string | null;
    artist: { name: string; image?: string } | null;
    tracks: Array<{ preview_url: string | null }>;
    tracksLoading: boolean;
  }) => (
    <div data-testid="artist-panel">
      {artistName}|{artist?.name ?? 'loading'}|
      {tracks.filter((track) => !!track.preview_url).length}|
      {tracksLoading ? 'refreshing' : 'ready'}
    </div>
  ),
}));

import MusicMapApp, {
  fetchPanelDataClient,
} from '@/components/music-map-app';

const initialGraphData = {
  nodes: [
    {
      id: 'Morcheeba',
      name: 'Morcheeba',
      group: 'trip-hop',
      size: 30,
      tags: ['trip-hop'],
      depth: 0,
    },
  ],
  links: [],
};

describe('MusicMapApp same-artist searches', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    mockBuildGraphData.mockReset();
    mockGetArtistInfo.mockReset();
    mockGetLastFmTopTracks.mockReset();
    mockGetArtistImage.mockReset();
    mockGetArtistSpotifyUrl.mockReset();
    mockGetArtistTopTracksWithPreviews.mockReset();
    mockEnrichTracksWithITunesPreviews.mockReset();
    mockEnrichTracksWithITunesPreviews.mockImplementation(
      async (_artistName: string, tracks: unknown[]) => ({
        tracks,
        lookupSucceeded: true,
      })
    );
    globalThis.fetch = jest.fn() as jest.Mock;
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/?q=Morcheeba');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('refreshes when the live URL already matches the same exact artist', async () => {
    const user = userEvent.setup();

    render(
      <MusicMapApp
        seedArtist="Morcheeba"
        initialGraphData={initialGraphData}
        panelData={null}
        randomArtists={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Search Morcheeba' }));

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('replaces to the search URL after reset clears the live query params', async () => {
    const user = userEvent.setup();

    render(
      <MusicMapApp
        seedArtist="Morcheeba"
        initialGraphData={initialGraphData}
        panelData={null}
        randomArtists={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Reset Graph' }));
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');

    await user.click(screen.getByRole('button', { name: 'Search Morcheeba' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/?q=Morcheeba');
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe('fetchPanelDataClient', () => {
  const originalFetch = globalThis.fetch;
  const placeholderImage =
    'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';

  const makeTrack = (
    name: string,
    previewUrl: string | null
  ) => ({
    id: name,
    name,
    preview_url: previewUrl,
    duration_ms: 180000,
    popularity: 50,
    album: { name: 'Album', images: [] },
    artists: [{ name: 'Duran Duran' }],
  });

  beforeEach(() => {
    mockGetArtistInfo.mockReset();
    mockGetLastFmTopTracks.mockReset();
    mockGetArtistImage.mockReset();
    mockGetArtistSpotifyUrl.mockReset();
    mockGetArtistTopTracksWithPreviews.mockReset();
    mockEnrichTracksWithITunesPreviews.mockReset();
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('upgrades a partial shared cache and falls back to the graph image', async () => {
    const cachedTracks = [
      makeTrack('Ordinary World', 'https://audio.example/ordinary.m4a'),
      makeTrack('Come Undone', null),
    ];
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            artist: {
              name: 'Duran Duran',
              url: 'https://last.fm/music/Duran+Duran',
              image: placeholderImage,
              listeners: 1,
              playcount: 2,
              tags: ['new wave'],
            },
            tracks: cachedTracks,
            trackSource: 'spotify',
          },
        }),
    });
    mockEnrichTracksWithITunesPreviews.mockResolvedValue({
      tracks: [
        cachedTracks[0],
        makeTrack('Come Undone', 'https://audio.example/come-undone.m4a'),
      ],
      lookupSucceeded: true,
    });

    const result = await fetchPanelDataClient(
      'Duran Duran',
      'https://images.example/duran.jpg'
    );

    expect(result.shouldCache).toBe(true);
    expect(result.data.artist?.image).toBe(
      'https://images.example/duran.jpg'
    );
    expect(result.data.tracks).toHaveLength(2);
    expect(result.data.tracks.every((track) => !!track.preview_url)).toBe(
      true
    );
    expect(mockEnrichTracksWithITunesPreviews).toHaveBeenCalledWith(
      'Duran Duran',
      cachedTracks
    );
    expect(mockGetArtistInfo).not.toHaveBeenCalled();
  });

  it('keeps a partial cache unchanged when the preview lookup fails', async () => {
    const cachedTracks = [
      makeTrack('Ordinary World', 'https://audio.example/ordinary.m4a'),
      makeTrack('Come Undone', null),
    ];
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            artist: {
              name: 'Duran Duran',
              url: 'https://last.fm/music/Duran+Duran',
              listeners: 1,
              playcount: 2,
              tags: [],
            },
            tracks: cachedTracks,
            trackSource: 'spotify',
          },
        }),
    });
    mockEnrichTracksWithITunesPreviews.mockResolvedValue({
      tracks: cachedTracks,
      lookupSucceeded: false,
    });

    const result = await fetchPanelDataClient('Duran Duran');

    expect(result.shouldCache).toBe(false);
    expect(result.data.tracks).toEqual(cachedTracks);
  });

  it('caches native Spotify previews when iTunes enrichment fails', async () => {
    const spotifyTracks = [
      makeTrack('Ordinary World', 'https://audio.example/ordinary.m4a'),
      makeTrack('Come Undone', null),
    ];
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });
    mockGetArtistInfo.mockResolvedValue({
      name: 'Duran Duran',
      url: 'https://last.fm/music/Duran+Duran',
      listeners: 1,
      playcount: 2,
      tags: ['new wave'],
    });
    mockGetArtistImage.mockResolvedValue(
      'https://images.example/duran.jpg'
    );
    mockGetArtistSpotifyUrl.mockResolvedValue(
      'https://open.spotify.com/artist/duran'
    );
    mockGetArtistTopTracksWithPreviews.mockResolvedValue({
      tracks: spotifyTracks,
      previewLookupSucceeded: false,
    });

    const result = await fetchPanelDataClient('Duran Duran');

    expect(result.shouldCache).toBe(true);
    expect(result.data.trackSource).toBe('spotify');
    expect(result.data.tracks).toEqual(spotifyTracks);
    expect(mockGetLastFmTopTracks).not.toHaveBeenCalled();
  });

  it('enriches Last.fm tracks when Spotify top tracks are unavailable', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });
    mockGetArtistInfo.mockResolvedValue({
      name: 'Duran Duran',
      url: 'https://last.fm/music/Duran+Duran',
      image: placeholderImage,
      listeners: 1,
      playcount: 2,
      tags: ['new wave'],
    });
    mockGetArtistImage.mockResolvedValue(undefined);
    mockGetArtistSpotifyUrl.mockResolvedValue(undefined);
    mockGetArtistTopTracksWithPreviews.mockResolvedValue({
      tracks: [],
      previewLookupSucceeded: false,
    });
    mockGetLastFmTopTracks.mockResolvedValue([
      {
        name: 'The Reflex',
        artist: 'Duran Duran',
        playcount: 1,
        url: 'https://last.fm/track/The+Reflex',
      },
    ]);
    mockEnrichTracksWithITunesPreviews.mockImplementation(
      async (_artistName: string, tracks: Array<{ name: string }>) => ({
        tracks: tracks.map((track) => ({
          ...track,
          preview_url: 'https://audio.example/reflex.m4a',
          duration_ms: 257000,
        })),
        lookupSucceeded: true,
      })
    );

    const result = await fetchPanelDataClient(
      'Duran Duran',
      'https://images.example/duran.jpg'
    );

    expect(result.shouldCache).toBe(true);
    expect(result.data.trackSource).toBe('lastfm');
    expect(result.data.artist?.image).toBe(
      'https://images.example/duran.jpg'
    );
    expect(result.data.tracks[0].preview_url).toBe(
      'https://audio.example/reflex.m4a'
    );
  });
});

describe('MusicMapApp panel requests', () => {
  const originalFetch = globalThis.fetch;

  const makeCachedPanel = (artistName: string) => ({
    artist: {
      name: artistName,
      url: `https://last.fm/music/${artistName}`,
      listeners: 1,
      playcount: 2,
      tags: [],
    },
    tracks: [
      {
        id: `${artistName}-track`,
        name: 'Track',
        preview_url: `https://audio.example/${artistName}.m4a`,
        duration_ms: 180000,
        popularity: 1,
        album: { name: 'Album', images: [] },
        artists: [{ name: artistName }],
      },
    ],
    trackSource: 'spotify',
  });

  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/?q=First');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('ignores an older artist response that finishes last', async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('artist=First')) return firstResponse;
      if (url.includes('artist=Second')) return secondResponse;
      throw new Error(`Unexpected request: ${url}`);
    }) as jest.Mock;

    const user = userEvent.setup();
    const graph = {
      nodes: [
        {
          id: 'First',
          name: 'First',
          group: 'one',
          size: 30,
          tags: ['one'],
          depth: 0,
        },
        {
          id: 'Second',
          name: 'Second',
          group: 'two',
          size: 10,
          tags: ['two'],
          depth: 1,
        },
      ],
      links: [],
    };

    render(
      <MusicMapApp
        seedArtist="First"
        initialGraphData={graph}
        panelData={null}
        randomArtists={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open First' }));
    await user.click(screen.getByRole('button', { name: 'Open Second' }));

    await act(async () => {
      resolveSecond({
        ok: true,
        json: () =>
          Promise.resolve({ data: makeCachedPanel('Second') }),
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByTestId('artist-panel')).toHaveTextContent(
        'Second|Second|1|ready'
      );
    });

    await act(async () => {
      resolveFirst({
        ok: true,
        json: () =>
          Promise.resolve({ data: makeCachedPanel('First') }),
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('artist-panel')).toHaveTextContent(
      'Second|Second|1|ready'
    );
  });
});
