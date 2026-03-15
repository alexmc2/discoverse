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

let kvArtistIndexPromise: Promise<CachedArtistIndex | null> | null = null;
let bundledArtistIndexPromise: Promise<CachedArtistIndex | null> | null = null;

const ARTIST_CACHE_KV_KEY = 'artist-cache:v1';
const SEARCH_CACHE_GRAPH_KEY = 'search-cache:v1:graph:';
const SEARCH_CACHE_PANEL_KEY = 'search-cache:v1:panel:';

function normalizeArtistName(artistName: string): string {
  return artistName.trim().toLowerCase();
}

function getPlayablePreviewCount(tracks: TrackData[] | undefined): number {
  return (tracks ?? []).filter((track) => !!track.preview_url).length;
}

function getRichTrackCount(tracks: TrackData[] | undefined): number {
  return (tracks ?? []).filter((track) => {
    const hasAlbumName = !!track.album?.name && track.album.name !== '—';
    const hasAlbumArt = (track.album?.images?.length ?? 0) > 0;
    const hasDuration = (track.duration_ms ?? 0) > 0;
    const hasPopularity = (track.popularity ?? 0) > 0;
    return hasAlbumName || hasAlbumArt || hasDuration || hasPopularity;
  }).length;
}

function getPanelDataQuality(
  panelData: CachedArtistEntry['panelData'] | null | undefined
): number {
  if (!panelData) return -1;

  const tracks = panelData.tracks ?? [];
  const playablePreviewCount = getPlayablePreviewCount(tracks);
  const richTrackCount = getRichTrackCount(tracks);
  const sourceScore =
    panelData.trackSource === 'spotify'
      ? 20
      : panelData.trackSource === 'lastfm'
      ? 5
      : 0;

  return (
    sourceScore +
    tracks.length +
    playablePreviewCount * 100 +
    richTrackCount * 10 +
    (panelData.artist ? 1 : 0)
  );
}

function chooseBestPanelData(
  preferred: CachedArtistEntry['panelData'] | null | undefined,
  fallback: CachedArtistEntry['panelData'] | null | undefined
): CachedArtistEntry['panelData'] | null {
  if (!preferred) return fallback ?? null;
  if (!fallback) return preferred;

  return getPanelDataQuality(fallback) > getPanelDataQuality(preferred)
    ? fallback
    : preferred;
}

async function loadKVArtistIndex(): Promise<CachedArtistIndex | null> {
  if (!kvArtistIndexPromise) {
    kvArtistIndexPromise = (async () => {
      const kv = getKV();
      if (!kv) return null;
      try {
        const raw = await kv.get(ARTIST_CACHE_KV_KEY);
        return raw ? (JSON.parse(raw) as CachedArtistIndex) : null;
      } catch {
        return null;
      }
    })();
  }
  return kvArtistIndexPromise;
}

async function loadBundledArtistIndex(): Promise<CachedArtistIndex | null> {
  if (!bundledArtistIndexPromise) {
    bundledArtistIndexPromise = import('@/data/artist-cache.json')
      .then((mod) => mod.default as CachedArtistIndex)
      .catch(() => null);
  }
  return bundledArtistIndexPromise;
}

async function getDefaultArtistEntry(
  artistName: string
): Promise<CachedArtistEntry | null> {
  const normalized = normalizeArtistName(artistName);
  if (!normalized || !DEFAULT_ARTIST_SET.has(normalized)) {
    return null;
  }

  const [kvIndex, bundledIndex] = await Promise.all([
    loadKVArtistIndex(),
    loadBundledArtistIndex(),
  ]);

  const kvEntry = kvIndex?.[normalized];
  const bundledEntry = bundledIndex?.[normalized];
  const graphData = kvEntry?.graphData ?? bundledEntry?.graphData;
  const panelData = chooseBestPanelData(
    kvEntry?.panelData ?? null,
    bundledEntry?.panelData ?? null
  );

  if (!graphData && !panelData) {
    return null;
  }

  return {
    graphData,
    panelData: panelData ?? undefined,
    lastUpdated: kvEntry?.lastUpdated ?? bundledEntry?.lastUpdated,
  };
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
  const cached = await getDefaultArtistEntry(artistName);
  if (!cached?.graphData) return null;

  return {
    graphData: cached.graphData,
    panelData: cached.panelData ?? null,
  };
}

export async function getDefaultArtistPanelData(
  artistName: string
): Promise<{
  artist: ArtistDetails | null;
  tracks: TrackData[];
  trackSource: TrackSource;
} | null> {
  const cached = await getDefaultArtistEntry(artistName);
  return cached?.panelData ?? null;
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
