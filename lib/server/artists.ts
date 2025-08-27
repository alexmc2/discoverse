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
  'The Beatles',
  'Radiohead',
  'LCD Soundsystem',
  'Pink Floyd',
  'Nirvana',
  'Queen',
  'David Bowie',
  'Led Zeppelin',
  'The Rolling Stones',
  'Bob Dylan',
  'Kanye West',
  'Arctic Monkeys',
  'Tame Impala',
  'The Strokes',
  'Fleetwood Mac',
  'Prince',
  'Daft Punk',
  'The Smiths',
  'Joy Division',
  'Frank Ocean',
  'Tyler, The Creator',
  'The Weeknd',
  'Lana Del Rey',
  'Mac Miller',
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
  'Pixies',
  'Sonic Youth',
  'My Bloody Valentine',
  'Slowdive',
  'Beach House',
  'MGMT',
  'Gorillaz',
  'Blur',
  'Oasis',
  'The Verve',
  'Pulp',
  'Metallica',
  'Black Sabbath',
  'Iron Maiden',
  'Slayer',
  'Megadeth',
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
  'A Tribe Called Quest',
  'Wu-Tang Clan',
  'Nas',
  'Björk',
  'Portishead',
  'Massive Attack',
  'Thom Yorke',
  'Nick Cave',
  'The National',
  'Arcade Fire',
  'Vampire Weekend',
  'Fleet Foxes',
  'Bon Iver',
  'Sufjan Stevens',
  'Elliott Smith',
  'Jeff Buckley',
  'Nick Drake',
  'Leonard Cohen',
  'Joni Mitchell',
  'Neil Young',
  'Bob Marley',
  'The Clash',
  'Sex Pistols',
  'Kraftwerk',
  'Can',
  'Neu!',
  'Brian Eno',
  'David Byrne',
  'Stevie Wonder',
  'Marvin Gaye',
  'Curtis Mayfield',
  'James Brown',
  'Aretha Franklin',
  'The Velvet Underground',
  'Television',
  'Patti Smith',
  'Iggy Pop',
  'Lou Reed',
  'Pigbag',
];

export async function getRandomArtists(): Promise<string[]> {
  const shuffled = [...POPULAR_ARTISTS_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 4);
}
