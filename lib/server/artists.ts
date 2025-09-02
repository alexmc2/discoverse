// lib/server/artists.ts
'use server';

import {
  getArtistInfo,
  getTopTracks as getLastFmTopTracks,
  buildGraphData as buildGraph,
} from '@/lib/lastfm';
import {
  getArtistImage,
  getArtistTopTracks,
  getArtistSpotifyUrl, // <-- now exported
} from '@/lib/spotify';
// No caching here: keep randomization per request. Heavy lookups are cached elsewhere.

export interface ArtistDetails {
  name: string;
  url: string;
  image?: string;
  listeners: number;
  playcount: number;
  bio?: string;
  tags: string[];
  spotifyUrl?: string;
}

export interface TrackData {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  artists: Array<{ name: string }>;
}

type TrackSource = 'spotify' | 'lastfm' | null;

export async function fetchGraphData(artistName: string) {
  return await buildGraph(artistName, 2);
}

export async function fetchArtistData(artistName: string) {
  const [info, spotifyImage, spotifyUrl] = await Promise.all([
    getArtistInfo(artistName),
    getArtistImage(artistName),
    getArtistSpotifyUrl(artistName),
  ]);

  const artist: ArtistDetails | null = info
    ? { ...info, image: spotifyImage || info.image, spotifyUrl }
    : null;

  let tracks: TrackData[] = [];
  let trackSource: TrackSource = null;

  try {
    const spotifyTop = await getArtistTopTracks(artistName);
    if (spotifyTop && spotifyTop.length > 0) {
      tracks = spotifyTop.slice(0, 10);
      trackSource = 'spotify';
    } else {
      const lastFmTracks = await getLastFmTopTracks(artistName, 10);
      tracks = lastFmTracks.map((t, idx) => ({
        id: `${artistName}-${t.name}-${idx}`,
        name: t.name,
        preview_url: null,
        duration_ms: 0,
        popularity: 0,
        album: { name: '—', images: [] },
        artists: [{ name: t.artist }],
      }));
      trackSource = 'lastfm';
    }
  } catch {
    // silent fallback
  }

  return { artist, tracks, trackSource };
}

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

export async function getRandomArtists(count: number = 4): Promise<string[]> {
  const shuffled = [...POPULAR_ARTISTS_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
