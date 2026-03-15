import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replaceMock = jest.fn();
const refreshMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

jest.mock('next/dynamic', () => () => {
  return function MockDynamicComponent() {
    return <div data-testid="music-graph" />;
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

jest.mock('@/components/artist-panel', () => ({
  __esModule: true,
  default: () => <div>Artist Panel</div>,
}));

import MusicMapApp from '@/components/music-map-app';

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
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    window.history.replaceState({}, '', '/?q=Morcheeba');
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
