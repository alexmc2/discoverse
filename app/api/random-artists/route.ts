import { NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY || '';
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const POPULAR_ARTISTS_POOL = [
  'The Beatles', 'Radiohead', 'Kendrick Lamar', 'Taylor Swift', 'Pink Floyd',
  'Nirvana', 'Queen', 'David Bowie', 'Led Zeppelin', 'The Rolling Stones',
  'Bob Dylan', 'Kanye West', 'Arctic Monkeys', 'Tame Impala', 'The Strokes',
  'Fleetwood Mac', 'Prince', 'Daft Punk', 'The Smiths', 'Joy Division',
  'Beyoncé', 'Frank Ocean', 'Tyler, The Creator', 'The Weeknd', 'Lana Del Rey',
  'Mac Miller', 'J. Cole', 'Drake', 'Travis Scott', 'Post Malone',
  'Billie Eilish', 'Olivia Rodrigo', 'Dua Lipa', 'Ariana Grande', 'SZA',
  'The Cure', 'Depeche Mode', 'New Order', 'Talking Heads', 'Pixies',
  'Sonic Youth', 'My Bloody Valentine', 'Slowdive', 'Beach House', 'MGMT',
  'Gorillaz', 'Blur', 'Oasis', 'The Verve', 'Pulp',
  'Metallica', 'Black Sabbath', 'Iron Maiden', 'Slayer', 'Megadeth',
  'Miles Davis', 'John Coltrane', 'Charles Mingus', 'Thelonious Monk', 'Bill Evans',
  'Aphex Twin', 'Boards of Canada', 'Four Tet', 'Burial', 'Flying Lotus',
  'MF DOOM', 'Madlib', 'A Tribe Called Quest', 'Wu-Tang Clan', 'Nas',
  'Björk', 'Portishead', 'Massive Attack', 'Thom Yorke', 'Nick Cave',
  'The National', 'Arcade Fire', 'Vampire Weekend', 'Fleet Foxes', 'Bon Iver',
  'Sufjan Stevens', 'Elliott Smith', 'Jeff Buckley', 'Nick Drake', 'Leonard Cohen',
  'Joni Mitchell', 'Neil Young', 'Bob Marley', 'The Clash', 'Sex Pistols',
  'Kraftwerk', 'Can', 'Neu!', 'Brian Eno', 'David Byrne',
  'Stevie Wonder', 'Marvin Gaye', 'Curtis Mayfield', 'James Brown', 'Aretha Franklin',
  'The Velvet Underground', 'Television', 'Patti Smith', 'Iggy Pop', 'Lou Reed'
];

const getRandomArtists = (count: number = 5): string[] => {
  const shuffled = [...POPULAR_ARTISTS_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export async function GET() {
  try {
    // Try to get chart.gettopartists from Last.fm API first
    if (API_KEY) {
      const params = new URLSearchParams({
        method: 'chart.gettopartists',
        api_key: API_KEY,
        format: 'json',
        limit: '100'
      });

      const url = `${BASE_URL}?${params.toString()}`;
      
      try {
        const response = await fetch(url, {
          next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data?.artists?.artist) {
            // Get random 5 artists from the top 100
            const artists = data.artists.artist;
            const shuffled = [...artists].sort(() => Math.random() - 0.5);
            const randomArtists = shuffled.slice(0, 5).map((artist: { name: string }) => artist.name);
            
            return NextResponse.json({ artists: randomArtists }, {
              headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
              }
            });
          }
        }
      } catch (error) {
        console.error('Last.fm API error:', error);
      }
    }
    
    // Fallback to local pool if API fails or no API key
    const randomArtists = getRandomArtists(5);
    
    return NextResponse.json({ artists: randomArtists }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });
  } catch (error) {
    console.error('Random artists API error:', error);
    // Even on error, return some artists
    return NextResponse.json({ artists: getRandomArtists(5) }, { status: 200 });
  }
}