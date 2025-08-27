// lib/spotify.ts
// Spotify Web API integration + robust previews with iTunes fallback.
// Safe for both client AND server environments.

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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

// iTunes types (subset)
interface ITunesResult {
  artistName: string;
  trackName: string;
  previewUrl?: string; // 30s MP3/AAC
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesResult[];
}

// ===== Token cache =====
let cachedToken: { token: string; expires: number } | null = null;

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window !== 'undefined') return path;

  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '') + path;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}${path}`;

  const port = process.env.PORT || '3000';
  return `http://localhost:${port}${path}`;
}

async function getSpotifyToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }
  try {
    const url = resolveUrl('/api/spotify/token');
    const res = await fetch(url, { method: 'POST' });
    if (res.status === 501) return null; // credentials not configured
    if (!res.ok) throw new Error('Failed to get Spotify token');
    const data: SpotifyToken = await res.json();
    cachedToken = {
      token: data.access_token,
      // refresh ~5 minutes early
      expires: Date.now() + (data.expires_in - 300) * 1000,
    };
    return cachedToken.token;
  } catch (e) {
    console.error('Error getting Spotify token:', e as Error);
    return null;
  }
}

// ===== Helpers =====
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

async function spotifyGET<T>(url: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn('Spotify request failed', res.status, url);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error('Spotify fetch error', e);
    return null;
  }
}

// ===== Public: search + images + url =====
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

// NEW: exported and typed Spotify URL helper
export async function getArtistSpotifyUrl(
  artistName: string
): Promise<string | undefined> {
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

// ===== iTunes fallback =====
async function fetchITunesPreview(
  artist: string,
  track: string
): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${artist} ${track}`
    )}&media=music&entity=song&limit=5`;
    const res = await fetch(url);
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
      if (candidate) {
        t.preview_url = candidate;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
}

// ===== Public: top tracks with robust previews =====
export async function getArtistTopTracks(
  artistName: string,
  marketHint?: string
): Promise<SpotifyTrack[]> {
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
