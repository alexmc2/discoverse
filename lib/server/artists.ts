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
  getArtistSpotifyUrl, // <-- now exported
} from '@/lib/spotify';
import { POPULAR_ARTISTS_POOL } from '@/lib/popular-artists';
import { getKV } from '@/lib/server/cache';
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
  POPULAR_ARTISTS_POOL.map((artist) => artist.trim().toLowerCase()),
);

let cachedArtistIndexPromise: Promise<CachedArtistIndex | null> | null = null;

const ARTIST_CACHE_KV_KEY = 'artist-cache:v1';
const SEARCH_CACHE_GRAPH_KEY = 'search-cache:v1:graph:';
const SEARCH_CACHE_PANEL_KEY = 'search-cache:v1:panel:';

function normalizeArtistName(artistName: string): string {
  return artistName.trim().toLowerCase();
}

async function loadCachedArtistIndex(): Promise<CachedArtistIndex | null> {
  if (!cachedArtistIndexPromise) {
    cachedArtistIndexPromise = (async () => {
      // Try KV first (production)
      const kv = getKV();
      if (kv) {
        try {
          const raw = await kv.get(ARTIST_CACHE_KV_KEY);
          if (raw) return JSON.parse(raw) as CachedArtistIndex;
        } catch {
          /* fall through */
        }
      }
      // Fallback: static JSON (local dev)
      return import('@/data/artist-cache.json')
        .then((mod) => mod.default as CachedArtistIndex)
        .catch(() => null);
    })();
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

export async function getSearchCacheBootstrap(artistName: string): Promise<{
  graphData: GraphData;
  panelData: {
    artist: ArtistDetails | null;
    tracks: TrackData[];
    trackSource: TrackSource;
  } | null;
} | null> {
  const kv = getKV();
  if (!kv) return null;
  const normalized = normalizeArtistName(artistName);

  try {
    const graphRaw = await kv.get(SEARCH_CACHE_GRAPH_KEY + normalized);
    if (!graphRaw) return null;
    const graphEnvelope = JSON.parse(graphRaw);
    const graphData = graphEnvelope?.data ?? graphEnvelope;
    if (!graphData?.nodes) return null;

    let panelData = null;
    const panelRaw = await kv.get(SEARCH_CACHE_PANEL_KEY + normalized);
    if (panelRaw) {
      const panelEnvelope = JSON.parse(panelRaw);
      panelData = panelEnvelope?.data ?? panelEnvelope;
    }

    return { graphData, panelData };
  } catch {
    return null;
  }
}
