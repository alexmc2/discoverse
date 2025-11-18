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
import { POPULAR_ARTISTS_POOL } from '@/lib/popular-artists';
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

export async function getRandomArtists(count: number = 4): Promise<string[]> {
  const shuffled = [...POPULAR_ARTISTS_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
