import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/image', () => {
  return function MockImage(
    props: React.ImgHTMLAttributes<HTMLImageElement>
  ) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ''} />;
  };
});

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children: React.ReactNode;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
}));

import ArtistPanel from '@/components/artist-panel';

const artist = {
  name: 'Duran Duran',
  url: 'https://last.fm/music/Duran+Duran',
  listeners: 1,
  playcount: 2,
  tags: ['new wave'],
};

const tracks = [
  {
    id: 'ordinary-world',
    name: 'Ordinary World',
    preview_url: null,
    duration_ms: 324000,
    popularity: 1,
    album: { name: 'Duran Duran', images: [] },
    artists: [{ name: 'Duran Duran' }],
  },
];

describe('ArtistPanel preview state', () => {
  it('does not report unavailable previews while tracks are refreshing', () => {
    const props = {
      artistName: 'Duran Duran',
      artist,
      tracks,
      trackSource: 'spotify' as const,
      onClose: jest.fn(),
    };
    const { rerender } = render(
      <ArtistPanel {...props} tracksLoading />
    );

    expect(
      screen.queryByText(
        'No 30-second previews are currently available for these tracks.'
      )
    ).not.toBeInTheDocument();

    rerender(<ArtistPanel {...props} tracksLoading={false} />);

    expect(
      screen.getByText(
        'No 30-second previews are currently available for these tracks.'
      )
    ).toBeInTheDocument();
  });
});
