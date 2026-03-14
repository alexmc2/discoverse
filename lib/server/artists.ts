// lib/server/artists.ts
'use server';

import {
  getArtistInfo,
  getTopTracks as getLastFmTopTracks,
  buildGraphData as buildGraph,
  type GraphLink,
  type GraphNode,
} from '@/lib/lastfm';
import {
  getArtistImage,
  getArtistTopTracks,
  enrichTracksWithITunesPreviews,
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

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface CachedArtistEntry {
  graphData?: GraphData;
  panelData?: {
    artist: ArtistDetails | null;
    tracks: TrackData[];
    trackSource: TrackSource;
  };
  lastUpdated?: string;
}

type CachedArtistIndex = Record<string, CachedArtistEntry>;

const DEFAULT_ARTIST_SET = new Set(
  POPULAR_ARTISTS_POOL.map((artist) => artist.trim().toLowerCase())
);

let cachedArtistIndexPromise: Promise<CachedArtistIndex | null> | null = null;

function normalizeArtistName(artistName: string): string {
  return artistName.trim().toLowerCase();
}

async function loadCachedArtistIndex(): Promise<CachedArtistIndex | null> {
  if (!cachedArtistIndexPromise) {
    cachedArtistIndexPromise = import('@/data/artist-cache.json')
      .then((mod) => mod.default as CachedArtistIndex)
      .catch(() => null);
  }
  return cachedArtistIndexPromise;
}

export async function fetchGraphData(artistName: string) {
  return await buildGraph(artistName, 2);
}

export async function fetchArtistData(artistName: string) {
  const [info, spotifyImage, spotifyUrl] = await Promise.all([
    getArtistInfo(artistName),
    getArtistImage(artistName),
    getArtistSpotifyUrl(artistName),
  ]);

  let tracks: TrackData[] = [];
  let trackSource: TrackSource = null;

  try {
    const spotifyTop = await getArtistTopTracks(artistName);
    if (spotifyTop && spotifyTop.length > 0) {
      tracks = spotifyTop.slice(0, 10);
      trackSource = 'spotify';
    } else {
      const lastFmTracks = await getLastFmTopTracks(artistName, 10);
      tracks = await enrichTracksWithITunesPreviews(
        artistName,
        lastFmTracks.map((t, idx) => ({
          id: `${artistName}-${t.name}-${idx}`,
          name: t.name,
          preview_url: null,
          duration_ms: 0,
          popularity: 0,
          album: { name: '—', images: [] },
          artists: [{ name: t.artist }],
        }))
      );
      trackSource = 'lastfm';
    }
  } catch {
    // silent fallback
  }

  const fallbackTrackImage = tracks.find(
    (track) => track.album?.images?.[0]?.url
  )?.album.images[0]?.url;
  const resolvedArtistImage =
    spotifyImage && !spotifyImage.includes('2a96cbd8b46e442fc41c2b86b821562f')
      ? spotifyImage
      : info?.image && !info.image.includes('2a96cbd8b46e442fc41c2b86b821562f')
      ? info.image
      : fallbackTrackImage;
  const artist: ArtistDetails | null = info
    ? { ...info, image: resolvedArtistImage, spotifyUrl }
    : null;

  return { artist, tracks, trackSource };
}

export async function getDefaultArtistBootstrap(artistName: string): Promise<{
  graphData: GraphData;
  panelData: {
    artist: ArtistDetails | null;
    tracks: TrackData[];
    trackSource: TrackSource;
  } | null;
} | null> {
  const normalized = normalizeArtistName(artistName);
  if (!normalized || !DEFAULT_ARTIST_SET.has(normalized)) {
    return null;
  }

  const index = await loadCachedArtistIndex();
  if (!index) return null;

  const cached = index[normalized];
  if (!cached?.graphData) return null;

  return {
    graphData: cached.graphData,
    panelData: cached.panelData ?? null,
  };
}
