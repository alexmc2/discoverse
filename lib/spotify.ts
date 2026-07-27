// lib/spotify.ts
// Spotify Web API integration + robust previews with iTunes fallback.
// Safe for both client AND server environments (Node + CF Workers).

import {
  lookupITunesTracks,
  type ITunesTrackMatch,
} from './itunes';

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

const MAX_SPOTIFY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 and 5xx are transient; every other non-ok status (bad id, bad token,
// unknown market) will fail identically on retry.
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 4_000) + Math.random() * 250;
}

function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 8_000);
  }
  return backoffMs(attempt);
}

async function spotifyGET<T>(url: string, token: string): Promise<T | null> {
  if (inCooloff()) return null;

  for (let attempt = 0; attempt < MAX_SPOTIFY_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_SPOTIFY_ATTEMPTS - 1;
    try {
      const res = await withLimit(() =>
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      );

      if (res.ok) {
        consecutiveFailures = 0; // success resets breaker
        return (await res.json()) as T;
      }

      if (!isRetryableStatus(res.status)) return null;

      // Callers cannot distinguish "no such artist" from "try again", so a
      // single transient 429/5xx used to drop the entire panel to the Last.fm
      // fallback. Retry before giving up.
      if (isLastAttempt) {
        noteFailure();
        return null;
      }
      await sleep(retryDelayMs(res, attempt));
    } catch {
      // Miniflare often throws "Network connection lost" here
      if (isLastAttempt) {
        noteFailure();
        return null;
      }
      await sleep(backoffMs(attempt));
    }
  }

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
type PreviewableTrack = {
  name: string;
  preview_url: string | null;
  duration_ms?: number;
  artists: Array<{ name: string }>;
  album?: {
    name: string;
    images: Array<{ url: string }>;
  };
};

export interface ITunesEnrichmentResult<T> {
  tracks: T[];
  lookupSucceeded: boolean;
}

interface ClientITunesLookupResponse {
  matches?: ITunesTrackMatch[];
  lookupSucceeded?: boolean;
}

function clonePreviewableTrack<T extends PreviewableTrack>(track: T): T {
  return {
    ...track,
    artists: track.artists.map((artist) => ({ ...artist })),
    album: track.album
      ? {
          ...track.album,
          images: track.album.images.map((image) => ({ ...image })),
        }
      : track.album,
  };
}

async function lookupITunesTracksClient(
  artistName: string,
  tracks: PreviewableTrack[],
  country: string
): Promise<{
  matches: ITunesTrackMatch[];
  lookupSucceeded: boolean;
}> {
  try {
    const response = await withLimit(() =>
      fetch('/api/itunes-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: artistName,
          country,
          tracks: tracks.map((track) => ({
            name: track.name,
            artist: track.artists[0]?.name,
          })),
        }),
      })
    );

    if (!response.ok) {
      return { matches: [], lookupSucceeded: false };
    }

    const data = (await response.json()) as ClientITunesLookupResponse;
    return {
      matches: Array.isArray(data.matches) ? data.matches : [],
      lookupSucceeded: data.lookupSucceeded === true,
    };
  } catch {
    return { matches: [], lookupSucceeded: false };
  }
}

export interface ITunesEnrichmentOptions {
  /**
   * Re-resolve preview URLs that are already present rather than only filling
   * in missing ones. Used to refresh cached panels whose Apple URLs have had
   * time to go stale.
   */
  refreshExisting?: boolean;
}

export async function enrichTracksWithITunesPreviews<
  T extends PreviewableTrack,
>(
  artistName: string,
  tracks: T[],
  marketHint?: string,
  options: ITunesEnrichmentOptions = {}
): Promise<ITunesEnrichmentResult<T>> {
  const nextTracks = tracks.map(clonePreviewableTrack);
  if (
    nextTracks.length === 0 ||
    (!options.refreshExisting &&
      nextTracks.every((track) => !!track.preview_url))
  ) {
    return { tracks: nextTracks, lookupSucceeded: true };
  }

  const country = (
    marketHint?.trim() || detectMarketPriority()[0] || 'GB'
  ).toUpperCase();

  const requests = nextTracks.map((track) => ({
    name: track.name,
    artist: track.artists[0]?.name,
  }));

  // Call Apple directly, from the browser as well as the server. iTunes Search
  // sends CORS headers, and going direct puts each lookup on the end user's own
  // IP. Routing every user through /api/itunes-preview instead funnels the whole
  // site through the Worker's handful of egress IPs, which Apple rate-limits
  // hard (observed: 12 of 12 deployed requests returning 429/502).
  let lookup = await lookupITunesTracks(artistName, requests, country);

  // Keep the proxy as a fallback for clients where the direct call is blocked
  // (extensions, corporate DNS, or a future Apple CORS change).
  if (!lookup.lookupSucceeded && !isServer()) {
    lookup = await lookupITunesTracksClient(artistName, nextTracks, country);
  }

  if (!lookup.lookupSucceeded) {
    return { tracks: nextTracks, lookupSucceeded: false };
  }

  for (const [index, track] of nextTracks.entries()) {
    const match = lookup.matches[index];
    if (!match) continue;

    if ((!track.preview_url || options.refreshExisting) && match.previewUrl) {
      track.preview_url = match.previewUrl;
    }
    if ((!track.duration_ms || track.duration_ms <= 0) && match.durationMs) {
      track.duration_ms = match.durationMs;
    }
    if (
      track.album &&
      (!track.album.name || track.album.name === '—') &&
      match.albumName
    ) {
      track.album.name = match.albumName;
    }
  }

  return { tracks: nextTracks, lookupSucceeded: true };
}

/** ====== Public: top tracks with robust previews ====== */
export interface ArtistTopTracksResult {
  tracks: SpotifyTrack[];
  previewLookupSucceeded: boolean;
}

export async function getArtistTopTracksWithPreviews(
  artistName: string,
  marketHint?: string
): Promise<ArtistTopTracksResult> {
  if (isServer() && FORCE_CLIENT) {
    return { tracks: [], previewLookupSucceeded: false };
  }
  const token = await getSpotifyToken();
  if (!token) return { tracks: [], previewLookupSucceeded: false };

  const artist = await searchSpotifyArtist(artistName);
  if (!artist) return { tracks: [], previewLookupSucceeded: false };

  // Try each market in turn. An artist with no catalogue in the viewer's own
  // storefront returns an empty track list rather than an error, and dropping
  // out here sends the whole panel to the Last.fm fallback.
  const hinted = marketHint?.trim().toUpperCase();
  const marketOrder = hinted
    ? [hinted, ...detectMarketPriority().filter((m) => m !== hinted)]
    : detectMarketPriority();

  let tracks: SpotifyTrack[] = [];
  let market = marketOrder[0] ?? 'GB';
  for (const candidate of marketOrder) {
    const url = `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=${candidate}`;
    const data = await spotifyGET<SpotifyTopTracksResponse>(url, token);
    if (data?.tracks?.length) {
      tracks = data.tracks.slice(0, 10);
      market = candidate;
      break;
    }
  }

  if (!tracks.length) {
    return { tracks: [], previewLookupSucceeded: false };
  }

  // Note: the pre-PR#17 code also re-queried every market hunting for a
  // non-null preview_url. Spotify now returns null for preview_url on every
  // endpoint and every market, so that loop is pure latency. iTunes below is
  // the only preview source.

  const enriched = await enrichTracksWithITunesPreviews(
    artistName,
    tracks,
    market
  );
  return {
    tracks: enriched.tracks.slice(0, 10),
    previewLookupSucceeded: enriched.lookupSucceeded,
  };
}

export async function getArtistTopTracks(
  artistName: string,
  marketHint?: string
): Promise<SpotifyTrack[]> {
  const result = await getArtistTopTracksWithPreviews(
    artistName,
    marketHint
  );
  return result.tracks;
}
