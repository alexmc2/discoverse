// lib/lastfm.ts
import { getArtistImage } from './spotify';

const LASTFM_API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY || '';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const MIN_LISTENERS = 50;

function isServer() {
  return typeof window === 'undefined';
}

/** ===== Types from Last.fm responses (subset) ===== */

type LfImage = {
  '#text': string;
  size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
};
type LfTag = { name: string; url?: string };
type LfArtistRef = {
  name: string;
  url?: string;
  mbid?: string;
  image?: LfImage[];
  match?: string | number;
  listeners?: string; // present on artist.search responses
};
type LfSimilarArtists = { artist?: LfArtistRef[] };
type LfTopTags = { tag?: LfTag[] };
type LfArtistInfo = {
  name: string;
  url?: string;
  image?: LfImage[];
  stats?: { listeners?: string; playcount?: string };
  bio?: { summary?: string };
  tags?: { tag?: LfTag[] };
};

type LfSearchResults = {
  results?: {
    artistmatches?: {
      artist?: LfArtistRef[];
    };
  };
};

type LfSimilarResp = { similarartists?: LfSimilarArtists };
type LfTopTagsResp = { toptags?: LfTopTags };
type LfInfoResp = { artist?: LfArtistInfo };
type LfTopTracksResp = {
  toptracks?: {
    track?: Array<{
      name: string;
      playcount?: string;
      url?: string;
      artist?: { name?: string };
    }>;
  };
};
type LfChartTopArtistsResp = {
  artists?: {
    artist?: Array<{
      name?: string;
    }>;
  };
};

/** ===== Public model types ===== */

export interface Artist {
  id: string;
  name: string;
  match?: number;
  url?: string;
  image?: string;
  tags?: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  group?: string; // first tag (normalized)
  size?: number;
  image?: string;
  tags?: string[];
  depth?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export interface Track {
  name: string;
  playcount: number;
  url: string;
  artist: string;
}

/** ===== Helpers ===== */

function firstImage(images?: LfImage[], pref: LfImage['size'] = 'extralarge') {
  if (!images || images.length === 0) return '';
  const best = images.find((img) => img.size === pref)?.['#text'] || '';
  return best || images[images.length - 1]['#text'] || '';
}

function normalizeTag(tag?: string) {
  return (tag || 'unknown').toLowerCase();
}

/** ===== Core GET helper ===== */

import { cacheJSON, cacheKey } from './server/cache';

async function lastfmGet<T>(
  method: string,
  params: Record<string, string | number> = {},
  ttlSeconds = 6 * 60 * 60 // default 6h cache
): Promise<T> {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set('method', method);
  url.searchParams.set('format', 'json');

  // Provide API key on both server and client when available
  if (isServer()) {
    if (!LASTFM_API_KEY) throw new Error('Missing NEXT_PUBLIC_LASTFM_API_KEY');
    url.searchParams.set('api_key', LASTFM_API_KEY);
  } else if (LASTFM_API_KEY) {
    url.searchParams.set('api_key', LASTFM_API_KEY);
  }

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const finalUrl = url.toString();

  // KV-backed cache by normalized (method + params)
  const key = cacheKey(['lf', method, ...Object.entries(params).flat()]);
  return cacheJSON<T>(key, ttlSeconds, async () => {
    const res = await fetch(finalUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Last.fm error ${res.status} for ${method}`);
    return (await res.json()) as T;
  });
}

/** ===== Public API ===== */

// Filter out tiny artists (default: min 50 listeners) for cleaner suggestions.
export async function searchArtist(
  query: string,
  minListeners = MIN_LISTENERS
): Promise<Artist[]> {
  if (!query) return [];
  const data = await lastfmGet<LfSearchResults>(
    'artist.search',
    {
      artist: query,
      limit: 30,
    },
    6 * 60 * 60
  );
  const artists = data?.results?.artistmatches?.artist ?? [];

  const filtered = (artists || []).filter((a) => {
    const listeners = parseInt(a.listeners || '0', 10);
    return Number.isFinite(listeners) && listeners >= minListeners;
  });

  return filtered.map((artist, index) => ({
    id: artist.mbid ? `${artist.mbid}-${index}` : `${artist.name}-${index}`,
    name: artist.name,
    url: artist.url,
    image: firstImage(artist.image, 'large'),
  }));
}

export async function getSimilarArtists(
  artistName: string,
  limit = 20
): Promise<Artist[]> {
  const data = await lastfmGet<LfSimilarResp>(
    'artist.getsimilar',
    {
      artist: artistName,
      limit,
    },
    12 * 60 * 60
  );
  const similar = data?.similarartists?.artist ?? [];
  return (similar || []).map((artist, index) => ({
    id: artist.mbid ? `${artist.mbid}-${index}` : `${artist.name}-${index}`,
    name: artist.name,
    match:
      typeof artist.match === 'string'
        ? parseFloat(artist.match)
        : artist.match ?? 0,
    url: artist.url,
    image: firstImage(artist.image, 'large'),
  }));
}

export async function getArtistTags(artistName: string): Promise<string[]> {
  const data = await lastfmGet<LfTopTagsResp>(
    'artist.gettoptags',
    {
      artist: artistName,
    },
    24 * 60 * 60
  );
  const tags = data?.toptags?.tag ?? [];
  return (tags || [])
    .slice(0, 5)
    .map((t) => t.name)
    .filter((t): t is string => !!t && t.length > 0);
}

export async function getArtistInfo(artistName: string) {
  const data = await lastfmGet<LfInfoResp>(
    'artist.getinfo',
    {
      artist: artistName,
    },
    24 * 60 * 60
  );
  const artist = data?.artist;
  if (!artist) return null;

  return {
    name: artist.name,
    url: artist.url ?? '',
    image: firstImage(artist.image, 'extralarge'),
    listeners: parseInt(artist.stats?.listeners || '0', 10),
    playcount: parseInt(artist.stats?.playcount || '0', 10),
    bio: (artist.bio?.summary || '')
      .replace(/<[^>]*>/g, '')
      .split('Read more')[0],
    tags:
      artist.tags?.tag
        ?.slice(0, 5)
        .map((t) => t.name)
        .filter((t): t is string => !!t) ?? [],
  };
}

export async function getTopTracks(
  artistName: string,
  limit = 10
): Promise<Track[]> {
  const data = await lastfmGet<LfTopTracksResp>(
    'artist.gettoptracks',
    {
      artist: artistName,
      limit,
    },
    12 * 60 * 60
  );
  const tracks = data?.toptracks?.track ?? [];
  return (tracks || []).map((track) => ({
    name: track.name,
    playcount: parseInt(track.playcount || '0', 10),
    url: track.url || '',
    artist: track.artist?.name || artistName,
  }));
}

export async function getTopChartArtistNames(limit = 50): Promise<string[]> {
  const data = await lastfmGet<LfChartTopArtistsResp>(
    'chart.gettopartists',
    { limit },
    6 * 60 * 60
  );
  const artists = data?.artists?.artist ?? [];
  return (artists || [])
    .map((artist) => artist?.name?.trim())
    .filter((name): name is string => !!name && name.length > 0);
}

/** ===== Image + Listeners memos (type-safe, no `any`) ===== */

declare global {
  var __lf_imageMemo: Map<string, Promise<string | undefined>> | undefined;
  var __lf_listenersMemo: Map<string, Promise<number | null>> | undefined;
}

const imageMemo: Map<
  string,
  Promise<string | undefined>
> = globalThis.__lf_imageMemo ?? new Map<string, Promise<string | undefined>>();
if (!globalThis.__lf_imageMemo) {
  globalThis.__lf_imageMemo = imageMemo;
}

const listenersMemo: Map<
  string,
  Promise<number | null>
> = globalThis.__lf_listenersMemo ?? new Map<string, Promise<number | null>>();
if (!globalThis.__lf_listenersMemo) {
  globalThis.__lf_listenersMemo = listenersMemo;
}

function getImageMemoized(name: string): Promise<string | undefined> {
  const key = name.toLowerCase();
  if (!imageMemo.has(key)) {
    imageMemo.set(
      key,
      (async (): Promise<string | undefined> => {
        try {
          return await getArtistImage(name);
        } catch {
          return undefined;
        }
      })()
    );
  }
  return imageMemo.get(key)!;
}

async function getListenersMemoized(name: string): Promise<number | null> {
  const key = name.toLowerCase();
  if (!listenersMemo.has(key)) {
    listenersMemo.set(
      key,
      (async (): Promise<number | null> => {
        try {
          const info = await getArtistInfo(name);
          return info?.listeners ?? null;
        } catch {
          return null;
        }
      })()
    );
  }
  return listenersMemo.get(key)!;
}

/** ===== Graph builder (filters nodes by MIN_LISTENERS) ===== */

export async function buildGraphData(seedArtist: string, depth = 2) {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const processed = new Set<string>();

  const [seedTags, seedInfo, seedSpotifyImage] = await Promise.all([
    getArtistTags(seedArtist),
    getArtistInfo(seedArtist),
    getImageMemoized(seedArtist),
  ]);

  const seedNode: GraphNode = {
    id: seedArtist,
    name: seedArtist,
    group: normalizeTag(seedTags[0]),
    size: 20,
    image: seedSpotifyImage || seedInfo?.image,
    tags: seedTags,
    depth: 0,
  };
  nodes.set(seedArtist, seedNode);

  const similar = await getSimilarArtists(seedArtist, 15);

  // Prefetch D1 images + listeners
  const d1Names = similar.map((a) => a.name);
  const [d1Images, d1Listeners] = await Promise.all([
    Promise.all(d1Names.map(getImageMemoized)),
    Promise.all(d1Names.map(getListenersMemoized)),
  ]);
  const d1ImageMap = new Map<string, string | undefined>();
  const d1ListenerMap = new Map<string, number | null>();
  d1Names.forEach((n, i) => {
    d1ImageMap.set(n, d1Images[i]);
    d1ListenerMap.set(n, d1Listeners[i]);
  });

  for (const artist of similar) {
    const listeners = d1ListenerMap.get(artist.name) ?? 0;
    if ((listeners ?? 0) < MIN_LISTENERS) {
      continue; // skip low-listener D1 nodes/links
    }

    if (!nodes.has(artist.name)) {
      const tags = await getArtistTags(artist.name);
      nodes.set(artist.name, {
        id: artist.name,
        name: artist.name,
        group: normalizeTag(tags[0]),
        size: 10,
        image: d1ImageMap.get(artist.name) || artist.image,
        tags,
        depth: 1,
      });
    }
    links.push({
      source: seedArtist,
      target: artist.name,
      value: artist.match ?? 0.5,
    });
  }

  if (depth >= 2) {
    const d1KeptNames = similar
      .map((a) => a.name)
      .filter((n) => (d1ListenerMap.get(n) ?? 0) >= MIN_LISTENERS)
      .slice(0, 8);

    for (const name of d1KeptNames) {
      if (processed.has(name)) continue;
      processed.add(name);

      const secondLevel = await getSimilarArtists(name, 5);
      const d2Names = secondLevel.map((a) => a.name);

      // Very conservative images, but listeners we fetch for all candidates to filter
      const d2CandidatesForImages = secondLevel.slice(0, 2).map((a) => a.name);
      const [d2Images, d2Listeners] = await Promise.all([
        Promise.all(d2CandidatesForImages.map(getImageMemoized)),
        Promise.all(d2Names.map(getListenersMemoized)),
      ]);
      const d2ImageMap = new Map<string, string | undefined>();
      d2CandidatesForImages.forEach((n, i) => d2ImageMap.set(n, d2Images[i]));
      const d2ListenerMap = new Map<string, number | null>();
      d2Names.forEach((n, i) => d2ListenerMap.set(n, d2Listeners[i]));

      for (const related of secondLevel) {
        const relListeners = d2ListenerMap.get(related.name) ?? 0;
        if ((relListeners ?? 0) < MIN_LISTENERS) {
          continue; // skip low-listener D2 nodes/links
        }

        if (nodes.has(related.name) && related.name !== name) {
          links.push({
            source: name,
            target: related.name,
            value: (related.match ?? 0.5) * 0.7,
          });
        } else if (!nodes.has(related.name) && nodes.size < 150) {
          const tags = await getArtistTags(related.name);
          nodes.set(related.name, {
            id: related.name,
            name: related.name,
            group: normalizeTag(tags[0]),
            size: 6,
            image: d2ImageMap.get(related.name) || related.image,
            tags,
            depth: 2,
          });
          links.push({
            source: name,
            target: related.name,
            value: (related.match ?? 0.5) * 0.5,
          });
        }
      }
    }
  }

  // Size by degree
  const degree = new Map<string, number>();
  links.forEach((l) => {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  });

  nodes.forEach((node) => {
    const connections = degree.get(node.id) || 1;
    node.size = Math.min(Math.max(6, connections * 2), 30);
  });

  return {
    nodes: Array.from(nodes.values()),
    links,
  };
}
