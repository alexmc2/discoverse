// app/api/itunes-preview/route.ts
// Server-side proxy for iTunes Search API to avoid CORS errors in browsers.
import {
  lookupITunesTracks,
  normalizeITunesCountry,
  type ITunesTrackRequest,
} from '@/lib/itunes';

const MAX_TRACKS = 10;

function upstreamFailureStatus(status?: number): number {
  return status === 429 ? 429 : 502;
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
    country
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

  const result = await lookupITunesTracks(artist, tracks, country);
  if (!result.lookupSucceeded) {
    return Response.json(
      { matches: result.matches, lookupSucceeded: false },
      { status: upstreamFailureStatus(result.upstreamStatus) }
    );
  }

  return Response.json({
    matches: result.matches,
    lookupSucceeded: true,
  });
}
