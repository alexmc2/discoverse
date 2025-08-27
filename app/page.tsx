// app/page.tsx
import MusicMapApp from '@/components/music-map-app';
import {
  fetchGraphData,
  fetchArtistData,
  getRandomArtists,
} from '@/lib/server/artists';

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

  // With a query: fetch graph + panel data in parallel on the server
  const [graphData, panelData] = await Promise.all([
    fetchGraphData(seedArtist),
    fetchArtistData(seedArtist),
  ]);

  return (
    <MusicMapApp
      seedArtist={seedArtist}
      initialGraphData={graphData}
      panelData={panelData}
      randomArtists={randomArtists}
    />
  );
}
