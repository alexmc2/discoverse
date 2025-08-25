// app/api/random-artists/route.ts
import { NextResponse } from 'next/server';

// const API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY || '';
// const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const POPULAR_ARTISTS_POOL = [
  'The Beatles', 'Radiohead', 'Kendrick Lamar', 'LCD Soundsystem', 'Pink Floyd',
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
  const shuffled = [...POPULAR_ARTISTS_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

export async function GET() {
  // Always use the local pool for truly random results
  const randomArtists = getRandomArtists(5);
  
  return NextResponse.json({ artists: randomArtists }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}