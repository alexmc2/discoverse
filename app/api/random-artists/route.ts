// app/api/random-artists/route.ts
import { NextResponse } from 'next/server';
// Keep results random on each request; no KV caching here.

// const API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY || '';
// const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const POPULAR_ARTISTS_POOL = [
  'Depeche Mode',
  'Radiohead',
  'LCD Soundsystem',
  'Fujiya & Miyagi',
  'Pink Floyd',
  'Suede',
  'Queen',
  'David Bowie',
  'Led Zeppelin',
  'Haruomi Hosono',
  'The Rolling Stones',
  'Bob Dylan',
  'Arctic Monkeys',
  'Tame Impala',
  'The Strokes',
  'Fleetwood Mac',
  'Prince',
  'Daft Punk',
  'The Smiths',
  'Joy Division',
  'Micheal Jackson',
  'Frank Ocean',
  'The Weeknd',
  'J. Cole',
  'Travis Scott',
  'Post Malone',
  'Leonard Cohen',
  'Billie Eilish',
  'Olivia Rodrigo',
  'Dua Lipa',
  'Marie Davidson',
  'SZA',
  'Shrag',
  'The Cure',
  'Depeche Mode',
  'Manic Street Preachers',
  'New Order',
  'Talking Heads',
  'First Aid Kit',
  'Pixies',
  'Clock DVA',
  'Sonic Youth',
  'My Bloody Valentine',
  'Beach House',
  'MGMT',
  'Pulp',
  'Metallica',
  'AC/DC',
  'Miles Davis',
  'John Coltrane',
  'Charles Mingus',
  'Thelonious Monk',
  'Bill Evans',
  'Aphex Twin',
  'Boards of Canada',
  'Four Tet',
  'Burial',
  'Flying Lotus',
  'MF DOOM',
  'Madlib',
  'Nirvana',
  'A Tribe Called Quest',
  'Wu-Tang Clan',
  'Nas',
  'Björk',
  'Portishead',
  'Massive Attack',
  'Thom Yorke',
  'Nick Cave',
  'The National',
  'Death Cab for Cutie',
  'Vampire Weekend',
  'Fleet Foxes',
  'Kid Francescoli',
  'Bon Iver',
  'Sufjan Stevens',
  'Elliott Smith',
  'Leonard Cohen',
  'Neil Young',
  'The Clash',
  'Sex Pistols',
  'Kraftwerk',
  'Can',
  'Neu!',
  'Brian Eno',
  'David Byrne',
  'Marvin Gaye',
  'Curtis Mayfield',
  'Cabaret Voltaire',
  'James Brown',
  'Aretha Franklin',
  'The Velvet Underground',
  'Television',
  'Iggy Pop',
  'Lou Reed',
  'Pigbag',
  'Calvin Harris',
  'Travis Scott',
  'Charli XCX',
  'The Weeknd',
  'D-Block Europe',
  'The Kooks',
  'NewJeans',
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
  const randomArtists = getRandomArtists(5);
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
