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

interface SpotifyTopTracksResponse {
  tracks: SpotifyTrack[];
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

async function spotifyGET<T>(url: string, token: string): Promise<T | null> {
  if (inCooloff()) return null;

  try {
    const res = await withLimit(() =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    );
    if (!res.ok) return null;

    consecutiveFailures = 0; // success resets breaker
    return (await res.json()) as T;
  } catch {
    // Miniflare often throws "Network connection lost" here
    noteFailure();
    return null;
  }
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
  if (isServer() && FORCE_CLIENT) return [];
  const token = await getSpotifyToken();
  if (!token) return [];

  const artist = await searchSpotifyArtist(artistName);
  if (!artist) return [];

  const marketOrder = marketHint
    ? [marketHint, ...detectMarketPriority().filter((m) => m !== marketHint)]
    : detectMarketPriority();

  let tracks: SpotifyTrack[] = [];
  for (const market of marketOrder) {
    const url = `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=${market}`;
    const data = await spotifyGET<SpotifyTopTracksResponse>(url, token);
    if (data?.tracks?.length) {
      tracks = data.tracks.slice(0, 10);
      break;
    }
  }
  if (!tracks.length) return [];

  // Try alternate markets for previews if needed
  const hasAnyPreview = tracks.some((t) => !!t.preview_url);
  if (!hasAnyPreview) {
    for (const market of marketOrder) {
      const url = `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=${market}`;
      const data = await spotifyGET<SpotifyTopTracksResponse>(url, token);
      if (!data?.tracks?.length) continue;
      for (const t of tracks) {
        if (!t.preview_url) {
          const alt = data.tracks.find(
            (x) => x.name.toLowerCase() === t.name.toLowerCase()
          );
          if (alt?.preview_url) t.preview_url = alt.preview_url;
        }
      }
      if (tracks.some((t) => !!t.preview_url)) break;
    }
  }

  if (tracks.some((t) => !t.preview_url)) {
    await enrichWithITunesPreviews(artistName, tracks);
  }

  return tracks.slice(0, 10);
}
