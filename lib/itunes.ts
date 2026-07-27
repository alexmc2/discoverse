export interface ITunesTrackRequest {
  name: string;
  artist?: string;
}

export interface ITunesTrackMatch {
  previewUrl: string | null;
  albumName?: string;
  durationMs?: number;
}

interface ITunesSearchResult {
  artistName?: string;
  trackName?: string;
  previewUrl?: string;
  collectionName?: string;
  trackTimeMillis?: number;
}

interface ITunesSearchResponse {
  resultCount?: number;
  results?: ITunesSearchResult[];
}

export interface ITunesLookupResult {
  matches: ITunesTrackMatch[];
  lookupSucceeded: boolean;
  upstreamStatus?: number;
}

interface ITunesLookupOptions {
  searchTerm?: string;
  limit?: number;
  artistTermOnly?: boolean;
}

const EDITION_QUALIFIER =
  /\b(remaster(?:ed)?|version|edit|mix|live|acoustic|mono|stereo|anniversary|deluxe)\b/i;

function foldText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripEditionSuffix(value: string): string {
  let next = value.replace(
    /\s+(?:feat\.?|featuring)\s+.+$/i,
    ''
  );

  const dashIndex = next.search(/\s[-–—]\s/);
  if (dashIndex >= 0 && EDITION_QUALIFIER.test(next.slice(dashIndex + 1))) {
    next = next.slice(0, dashIndex);
  }

  next = next.replace(/\s*[\[(]([^)\]]+)[)\]]\s*$/i, (suffix, content) =>
    EDITION_QUALIFIER.test(content) ? '' : suffix
  );

  return next;
}

function normalizeArtist(value: string): string {
  return foldText(value);
}

function normalizeTrack(value: string, stripEdition: boolean): string {
  return foldText(stripEdition ? stripEditionSuffix(value) : value);
}

function artistMatchScore(requested: string, candidate: string): number {
  const expected = normalizeArtist(requested);
  const actual = normalizeArtist(candidate);
  if (!expected || !actual) return 0;
  if (actual === expected) return 2;
  if (
    actual.startsWith(`${expected} and `) ||
    actual.startsWith(`${expected} featuring `)
  ) {
    return 1;
  }
  return 0;
}

export function matchITunesTracks(
  artistName: string,
  tracks: ITunesTrackRequest[],
  results: ITunesSearchResult[]
): ITunesTrackMatch[] {
  const claimed = new Set<ITunesSearchResult>();

  return tracks.map((track) => {
    const requestedArtist = track.artist?.trim() || artistName;
    const exactTitle = normalizeTrack(track.name, false);
    const canonicalTitle = normalizeTrack(track.name, true);

    let best:
      | {
          result: ITunesSearchResult;
          score: number;
        }
      | undefined;
    let bestUnclaimed:
      | {
          result: ITunesSearchResult;
          score: number;
        }
      | undefined;

    for (const result of results) {
      if (!result.previewUrl || !result.trackName || !result.artistName) {
        continue;
      }

      const artistScore = artistMatchScore(requestedArtist, result.artistName);
      if (!artistScore) continue;

      const resultExactTitle = normalizeTrack(result.trackName, false);
      const resultCanonicalTitle = normalizeTrack(result.trackName, true);
      const titleScore =
        resultExactTitle === exactTitle
          ? 2
          : resultCanonicalTitle === canonicalTitle
          ? 1
          : 0;
      if (!titleScore) continue;

      const score = titleScore * 10 + artistScore;
      if (!best || score > best.score) {
        best = { result, score };
      }
      if (
        !claimed.has(result) &&
        (!bestUnclaimed || score > bestUnclaimed.score)
      ) {
        bestUnclaimed = { result, score };
      }
    }

    // Prefer a result no earlier track has already taken, so a title and its
    // remaster/edit don't both collapse onto the same Apple recording.
    //
    // Only steal an unclaimed result when it scores as well as the best match.
    // Dropping to a strictly worse one would demote an exact title match to a
    // mere edition match — and when two requested tracks share a title they are
    // the same song, so they should keep the same recording rather than be
    // split across a studio and a live take.
    const chosen =
      bestUnclaimed && best && bestUnclaimed.score === best.score
        ? bestUnclaimed
        : best;
    if (chosen) claimed.add(chosen.result);

    return {
      previewUrl: chosen?.result.previewUrl ?? null,
      albumName: chosen?.result.collectionName,
      durationMs: chosen?.result.trackTimeMillis,
    };
  });
}

export function normalizeITunesCountry(country?: string): string {
  const normalized = country?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : 'GB';
}

export interface ITunesCatalogResult {
  results: ITunesSearchResult[];
  lookupSucceeded: boolean;
  upstreamStatus?: number;
}

/**
 * Fetch an artist's Apple catalogue. Split out from `lookupITunesTracks` so the
 * Worker-side proxy can cache the catalogue per artist in KV — Apple rate-limits
 * the shared Cloudflare egress IP hard, so it must be hit once per artist rather
 * than once per page view.
 */
export async function fetchITunesCatalog(
  artistName: string,
  country?: string,
  options: ITunesLookupOptions = {}
): Promise<ITunesCatalogResult> {
  const limit = Math.min(
    200,
    Math.max(1, Math.round(options.limit ?? 200))
  );
  const params = new URLSearchParams({
    term: options.searchTerm?.trim() || artistName,
    country: normalizeITunesCountry(country),
    media: 'music',
    entity: 'song',
    limit: String(limit),
  });
  if (options.artistTermOnly !== false) {
    params.set('attribute', 'artistTerm');
  }

  try {
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        results: [],
        lookupSucceeded: false,
        upstreamStatus: response.status,
      };
    }

    const data = (await response.json()) as ITunesSearchResponse;
    return {
      results: Array.isArray(data.results) ? data.results : [],
      lookupSucceeded: true,
      upstreamStatus: response.status,
    };
  } catch {
    return { results: [], lookupSucceeded: false };
  }
}

export async function lookupITunesTracks(
  artistName: string,
  tracks: ITunesTrackRequest[],
  country?: string,
  options: ITunesLookupOptions = {}
): Promise<ITunesLookupResult> {
  const emptyMatches = tracks.map(() => ({ previewUrl: null }));
  if (!artistName.trim() || tracks.length === 0) {
    return { matches: emptyMatches, lookupSucceeded: true };
  }

  try {
    const catalog = await fetchITunesCatalog(artistName, country, options);
    if (!catalog.lookupSucceeded) {
      return {
        matches: emptyMatches,
        lookupSucceeded: false,
        upstreamStatus: catalog.upstreamStatus,
      };
    }

    return {
      matches: matchITunesTracks(artistName, tracks, catalog.results),
      lookupSucceeded: true,
      upstreamStatus: catalog.upstreamStatus,
    };
  } catch {
    return {
      matches: emptyMatches,
      lookupSucceeded: false,
    };
  }
}
