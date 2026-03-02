// lib/spotify.ts
// Spotify Web API integration + robust previews with iTunes fallback.
// Safe for both client AND server environments (Node + CF Workers).

/** ====== Spotify types ====== */
interface SpotifyArtistImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyArtistImage[];
  genres: string[];
  popularity: number;
}

interface SpotifySearchResponse {
  artists: { items: SpotifyArtist[] };
}

interface SpotifyTrackSearchResponse {
  tracks?: { items?: SpotifyTrack[] };
}

export interface SpotifyTrackAlbumImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyTrackAlbum {
  name: string;
  images: SpotifyTrackAlbumImage[];
}

export interface SpotifyTrackArtist {
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  album: SpotifyTrackAlbum;
  artists: SpotifyTrackArtist[];
}

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** ====== Small concurrency gate (Miniflare can drop sockets if bursty) ====== */
const FORCE_CLIENT =
  process.env.NEXT_PUBLIC_FORCE_CLIENT_SPOTIFY === '1' ? true : false;
const MAX_CONCURRENCY = 2; // keep low for local Workers; fine on real edge
let active = 0;
const waiters: Array<() => void> = [];

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) {
    await new Promise<void>((r) => waiters.push(r));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiters.shift();
    if (next) next();
  }
}

/** ====== Token cache + single-flight ====== */
let cachedToken: { token: string; expires: number } | null = null;
let tokenInFlight: Promise<string | null> | null = null;

function isServer() {
  return typeof window === 'undefined';
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!isServer()) return path;

  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '') + path;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}${path}`;

  const port = process.env.PORT || '3000';
  return `http://localhost:${port}${path}`;
}

async function fetchTokenDirect(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  // Node has Buffer; Workers/browsers have btoa
  const basic =
    typeof Buffer !== 'undefined'
      ? Buffer.from(`${id}:${secret}`).toString('base64')
      : btoa(`${id}:${secret}`);

  const res = await withLimit(() =>
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
  );

  if (!res.ok) return null;

  const data: SpotifyToken = await res.json();
  cachedToken = {
    token: data.access_token,
    // refresh ~5 minutes early
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.token;
}

async function fetchTokenViaRoute(): Promise<string | null> {
  const url = resolveUrl('/api/spotify/token');
  const res = await withLimit(() => fetch(url, { method: 'POST' }));
  if (!res.ok) return null;

  const data: SpotifyToken = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.token;
}

export async function getSpotifyToken(): Promise<string | null> {
  // In local preview with Miniflare, avoid server-side Spotify calls entirely
  if (isServer() && FORCE_CLIENT) return null;
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;
  if (tokenInFlight) return tokenInFlight;

  tokenInFlight = (async () => {
    // Prefer direct token fetch on the server/Worker (avoids loopback)
    if (isServer()) {
      const direct = await fetchTokenDirect();
      if (direct) return direct;
    }
    // Browser (and fallback): use the Next API route
    return await fetchTokenViaRoute();
  })();

  try {
    return await tokenInFlight;
  } finally {
    tokenInFlight = null;
  }
}

/** ====== Simple circuit breaker around Spotify fetches ====== */
let consecutiveFailures = 0;
let cooloffUntil = 0;

function inCooloff() {
  return Date.now() < cooloffUntil;
}
function noteFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= 3) {
    // after 3 network errors, pause Spotify calls for 30s
    cooloffUntil = Date.now() + 30_000;
    consecutiveFailures = 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyGET<T>(url: string, token: string): Promise<T | null> {
  if (inCooloff()) return null;

  let lastWas429 = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastWas429 = false;
    try {
      const res = await withLimit(() =>
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      );

      if (res.status === 429) {
        lastWas429 = true;
        const retryAfter = Number.parseInt(
          res.headers.get('retry-after') ?? '',
          10
        );
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : (attempt + 1) * 700;
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) return null;

      consecutiveFailures = 0; // success resets breaker
      return (await res.json()) as T;
    } catch {
      // Miniflare often throws "Network connection lost" here
      noteFailure();
    }
  }

  // Trip breaker if we exhausted retries on 429s (catch path already called noteFailure)
  if (lastWas429) noteFailure();
  return null;
}

/** ====== Market detection ====== */
function detectMarketPriority(): string[] {
  let first: string | null = null;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const region = locale.split('-')[1];
    if (region && region.length === 2) first = region.toUpperCase();
  } catch {
    // ignore
  }
  const defaults = ['GB', 'US', 'SE', 'DE', 'FR'];
  if (first && !defaults.includes(first)) return [first, ...defaults];
  if (first) return [first, ...defaults.filter((m) => m !== first)];
  return defaults;
}

type TopTracksArchivePayload = {
  generatedAt?: string;
  artists?: Record<
    string,
    {
      artistName?: string;
      tracks?: SpotifyTrack[];
    }
  >;
};

let topTracksArchivePromise: Promise<TopTracksArchivePayload | null> | null = null;
const TOP_TRACKS_ARCHIVE_KV_KEY =
  process.env.TOP_TRACKS_ARCHIVE_KV_KEY || 'archive:top-tracks:v1';

function normalizeArtistKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadTopTracksArchive(): Promise<TopTracksArchivePayload | null> {
  // Keep archive loading server-side to avoid shipping this data to clients.
  if (!isServer()) return null;

  if (!topTracksArchivePromise) {
    topTracksArchivePromise = (async () => {
      try {
        const { getMusicCacheKV } = await import('@/lib/server/cache');
        const kv = await getMusicCacheKV();
        if (!kv) return null;
        const raw = await kv.get(TOP_TRACKS_ARCHIVE_KV_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as TopTracksArchivePayload;
      } catch {
        return null;
      }
    })();
  }

  const archive = await topTracksArchivePromise;
  if (!archive) {
    // Allow retry on later requests if KV was temporarily empty/unavailable.
    topTracksArchivePromise = null;
  }
  return archive;
}

async function getArchiveTopTracks(artistName: string): Promise<SpotifyTrack[]> {
  const archive = await loadTopTracksArchive();
  const normalized = normalizeArtistKey(artistName);
  const tracks = archive?.artists?.[normalized]?.tracks;
  if (!tracks?.length) return [];
  return tracks.slice(0, 10);
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreTrackMatch(track: SpotifyTrack, normalizedArtist: string): number {
  const names = track.artists.map((a) => normalizeMatchText(a.name));
  const hasExact = names.some((name) => name === normalizedArtist);
  const hasContains = names.some(
    (name) => name.includes(normalizedArtist) || normalizedArtist.includes(name)
  );
  const hasPreview = !!track.preview_url;
  return (hasExact ? 1000 : 0) + (hasContains ? 100 : 0) + (hasPreview ? 10 : 0);
}

function dedupeTracksById(tracks: SpotifyTrack[]): SpotifyTrack[] {
  const map = new Map<string, SpotifyTrack>();
  for (const track of tracks) {
    if (!track?.id) continue;
    const prev = map.get(track.id);
    if (!prev) {
      map.set(track.id, track);
      continue;
    }

    if (!prev.preview_url && track.preview_url) {
      map.set(track.id, track);
      continue;
    }

    if ((track.popularity ?? 0) > (prev.popularity ?? 0)) {
      map.set(track.id, track);
    }
  }
  return Array.from(map.values());
}

/** ====== Public: search + images + url ====== */

export async function searchSpotifyArtist(
  artistName: string
): Promise<SpotifyArtist | null> {
  const token = await getSpotifyToken();
  if (!token) return null;

  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
    artistName
  )}&type=artist&limit=1`;

  const data = await spotifyGET<SpotifySearchResponse>(url, token);
  return data?.artists.items?.[0] ?? null;
}

export async function searchSpotifyTracks(
  artistName: string,
  marketHint?: string
): Promise<SpotifyTrack[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  const normalizedArtist = normalizeMatchText(artistName);
  const market = marketHint || detectMarketPriority()[0] || 'US';
  const limit = 10; // API limit max is now 10

  const queries = [`artist:${artistName}`, artistName];
  const collected: SpotifyTrack[] = [];

  for (const query of queries) {
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      query
    )}&type=track&limit=${limit}&market=${market}`;
    const data = await spotifyGET<SpotifyTrackSearchResponse>(url, token);
    const items = data?.tracks?.items ?? [];
    if (items.length) {
      collected.push(...items);
    }
  }

  const deduped = dedupeTracksById(collected);
  deduped.sort((a, b) => {
    const s = scoreTrackMatch(b, normalizedArtist) - scoreTrackMatch(a, normalizedArtist);
    if (s !== 0) return s;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  return deduped.slice(0, 10);
}

export async function getArtistImage(
  artistName: string
): Promise<string | undefined> {
  if (isServer() && FORCE_CLIENT) return undefined;
  try {
    const artist = await searchSpotifyArtist(artistName);
    if (artist && artist.images.length > 0) {
      return artist.images[1]?.url || artist.images[0]?.url;
    }
    return undefined;
  } catch (e) {
    console.error(`Error getting Spotify image for ${artistName}:`, e);
    return undefined;
  }
}

export async function getArtistSpotifyUrl(
  artistName: string
): Promise<string | undefined> {
  if (isServer() && FORCE_CLIENT) return undefined;
  try {
    const artist = await searchSpotifyArtist(artistName);
    if (!artist) return undefined;
    return `https://open.spotify.com/artist/${artist.id}`;
  } catch {
    return undefined;
  }
}

export async function getArtistImages(
  artistNames: string[]
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const batchSize = 5;
  for (let i = 0; i < artistNames.length; i += batchSize) {
    const batch = artistNames.slice(i, i + batchSize);
    const promises = batch.map(async (name) => {
      const image = await getArtistImage(name);
      if (image) imageMap.set(name, image);
    });
    await Promise.all(promises);
  }
  return imageMap;
}

/** ====== iTunes fallback for previews ====== */
interface ITunesResult {
  artistName: string;
  trackName: string;
  previewUrl?: string;
}
interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesResult[];
}

async function fetchITunesPreview(
  artist: string,
  track: string
): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${artist} ${track}`
    )}&media=music&entity=song&limit=5`;
    const res = await withLimit(() => fetch(url));
    if (!res.ok) return null;
    const data: ITunesSearchResponse = await res.json();

    if (!data.results || data.resultCount === 0) return null;

    const lowerArtist = artist.toLowerCase();
    const lowerTrack = track.toLowerCase();

    const exact = data.results.find((r) => {
      const a = (r.artistName || '').toLowerCase();
      const t = (r.trackName || '').toLowerCase();
      return a.includes(lowerArtist) && t === lowerTrack && !!r.previewUrl;
    });

    const candidate = exact ?? data.results.find((r) => !!r.previewUrl) ?? null;
    return candidate?.previewUrl ?? null;
  } catch {
    return null;
  }
}

async function enrichWithITunesPreviews(
  artistName: string,
  tracks: SpotifyTrack[]
): Promise<void> {
  const concurrency = 3;
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tracks.length) {
      const current = index++;
      const t = tracks[current];
      if (t.preview_url) continue;

      const candidate = await fetchITunesPreview(
        t.artists[0]?.name ?? artistName,
        t.name
      );
      if (candidate) t.preview_url = candidate;
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
}

/** ====== Public: top tracks with robust previews ====== */
export async function getArtistTopTracks(
  artistName: string,
  marketHint?: string
): Promise<SpotifyTrack[]> {
  // First, use local archive tracks when present.
  const archiveTracks = await getArchiveTopTracks(artistName);
  if (archiveTracks.length) return archiveTracks.slice(0, 10);

  // In local preview with Miniflare, avoid server-side Spotify calls entirely
  // when explicitly forced, but still allow archive lookup above.
  if (isServer() && FORCE_CLIENT) return [];

  const tracks = await searchSpotifyTracks(artistName, marketHint);
  if (!tracks.length) return [];

  if (tracks.some((t) => !t.preview_url)) {
    await enrichWithITunesPreviews(artistName, tracks);
  }

  return tracks.slice(0, 10);
}
