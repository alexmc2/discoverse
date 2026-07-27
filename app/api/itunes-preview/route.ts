// app/api/itunes-preview/route.ts
// Server-side proxy for iTunes Search API to avoid CORS errors in browsers.
import {
  fetchITunesCatalog,
  lookupITunesTracks,
  matchITunesTracks,
  normalizeITunesCountry,
  type ITunesCatalogResult,
  type ITunesTrackRequest,
} from '@/lib/itunes';
import { getCached, setCached } from '@/lib/server/cache';

const MAX_TRACKS = 10;
const CATALOG_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function upstreamFailureStatus(status?: number): number {
  return status === 429 ? 429 : 502;
}

type CachedCatalog = Pick<ITunesCatalogResult, 'results'>;

/**
 * Apple rate-limits the Cloudflare Worker's shared egress IP aggressively, so
 * this proxy caches each artist's catalogue rather than re-querying per request.
 * Clients call Apple directly (it sends CORS headers) and only fall back here,
 * so this path should stay cold.
 */
async function getCatalog(
  artist: string,
  country: string
): Promise<ITunesCatalogResult> {
  const key = `itunes:catalog:v1:${country}:${encodeURIComponent(
    artist.trim().toLowerCase()
  )}`;

  const cached = await getCached<CachedCatalog>(key);
  if (cached?.results?.length) {
    return { results: cached.results, lookupSucceeded: true };
  }

  const fresh = await fetchITunesCatalog(artist, country);
  if (fresh.lookupSucceeded && fresh.results.length) {
    // Best-effort; a failed write must not fail the request.
    setCached<CachedCatalog>(key, { results: fresh.results }, CATALOG_TTL_SECONDS).catch(
      () => {}
    );
  }
  return fresh;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const track = searchParams.get('track');
  const country = searchParams.get('country') ?? undefined;

  if (!artist || !track) {
    return Response.json({ previewUrl: null }, { status: 400 });
  }

  const result = await lookupITunesTracks(
    artist,
    [{ name: track, artist }],
    country,
    {
      searchTerm: `${artist} ${track}`,
      limit: 25,
      artistTermOnly: false,
    }
  );
  if (!result.lookupSucceeded) {
    return Response.json(
      { previewUrl: null },
      { status: upstreamFailureStatus(result.upstreamStatus) }
    );
  }

  return Response.json({ previewUrl: result.matches[0]?.previewUrl ?? null });
}

export async function POST(request: Request) {
  let body: {
    artist?: unknown;
    tracks?: unknown;
    country?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { matches: [], lookupSucceeded: false },
      { status: 400 }
    );
  }

  const artist =
    typeof body.artist === 'string' ? body.artist.trim() : '';
  const country =
    typeof body.country === 'string'
      ? normalizeITunesCountry(body.country)
      : undefined;
  const rawTracks = Array.isArray(body.tracks) ? body.tracks : [];
  const tracks: ITunesTrackRequest[] = rawTracks
    .filter(
      (track): track is { name: string; artist?: string } =>
        !!track &&
        typeof track === 'object' &&
        'name' in track &&
        typeof track.name === 'string' &&
        track.name.trim().length > 0 &&
        (!('artist' in track) ||
          track.artist === undefined ||
          typeof track.artist === 'string')
    )
    .map((track) => ({
      name: track.name.trim(),
      artist: track.artist?.trim() || undefined,
    }));

  if (
    !artist ||
    rawTracks.length === 0 ||
    rawTracks.length > MAX_TRACKS ||
    tracks.length !== rawTracks.length
  ) {
    return Response.json(
      { matches: [], lookupSucceeded: false },
      { status: 400 }
    );
  }

  const catalog = await getCatalog(artist, normalizeITunesCountry(country));
  if (!catalog.lookupSucceeded) {
    return Response.json(
      {
        matches: tracks.map(() => ({ previewUrl: null })),
        lookupSucceeded: false,
      },
      { status: upstreamFailureStatus(catalog.upstreamStatus) }
    );
  }

  return Response.json({
    matches: matchITunesTracks(artist, tracks, catalog.results),
    lookupSucceeded: true,
  });
}
