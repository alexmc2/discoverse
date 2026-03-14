import { NextResponse } from 'next/server';
import { getRandomArtists } from '@/lib/server/random-artists';

export async function GET() {
  const randomArtists = getRandomArtists(4);
  return NextResponse.json(
    { artists: randomArtists },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

