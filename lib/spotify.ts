// lib/spotify.ts
// Spotify Web API integration + robust previews with iTunes fallback.
// - Tries multiple Spotify markets to find preview_url
// - Falls back to Apple iTunes Search API for 30s previews (CORS-friendly)
// - No `any` usage; strict TS.

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

async function getSpotifyToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }
  try {
    const res = await fetch('/api/spotify/token', { method: 'POST' });
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
    console.error('Error getting Spotify token:', e);
    return null;
  }
}

// ===== Helpers =====
function detectMarketPriority(): string[] {
  // e.g. "en-GB" -> "GB"
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

// ===== Public: search + images =====
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
    // Use media=music and entity=song to keep it tight; iTunes is CORS-enabled
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${artist} ${track}`
    )}&media=music&entity=song&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: ITunesSearchResponse = await res.json();

    if (!data.results || data.resultCount === 0) return null;

    const lowerArtist = artist.toLowerCase();
    const lowerTrack = track.toLowerCase();

    // Prefer near-exact match on both artist and track
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

// Attach iTunes previews to any track without preview_url
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

  // Try each market until we get any tracks
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

  // If no previews, try merging from other markets by name match
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

  // iTunes fallback for any remaining missing previews
  if (tracks.some((t) => !t.preview_url)) {
    await enrichWithITunesPreviews(artistName, tracks);
  }

  return tracks.slice(0, 10);
}
