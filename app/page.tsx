// app/page.tsx
import MusicMapApp from '@/components/music-map-app';
import { getDefaultArtistBootstrap } from '@/lib/server/artists';
import { getRandomArtists } from '@/lib/server/random-artists';

interface PageProps {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qParam = sp?.q;
  const seedArtist =
    typeof qParam === 'string' && qParam.trim() ? qParam.trim() : null;

  // Always provide a random artist list for the default content
  const randomArtists = await getRandomArtists();

  if (!seedArtist) {
    // No query: render the landing state. Graph + panel props are empty.
    return (
      <MusicMapApp
        seedArtist={null}
        initialGraphData={null}
        panelData={null}
        randomArtists={randomArtists}
      />
    );
  }

  // Fast path: for default suggested artists, hydrate from precomputed cache.
  // Non-default searches still load on the client to avoid SSR subrequest limits.
  const defaultBootstrap = await getDefaultArtistBootstrap(seedArtist);
  return (
    <MusicMapApp
      seedArtist={seedArtist}
      initialGraphData={defaultBootstrap?.graphData ?? null}
      panelData={defaultBootstrap?.panelData ?? null}
      randomArtists={randomArtists}
    />
  );
}
