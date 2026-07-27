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
    }

    return {
      previewUrl: best?.result.previewUrl ?? null,
      albumName: best?.result.collectionName,
      durationMs: best?.result.trackTimeMillis,
    };
  });
}

export function normalizeITunesCountry(country?: string): string {
  const normalized = country?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : 'GB';
}

export async function lookupITunesTracks(
  artistName: string,
  tracks: ITunesTrackRequest[],
  country?: string
): Promise<ITunesLookupResult> {
  const emptyMatches = tracks.map(() => ({ previewUrl: null }));
  if (!artistName.trim() || tracks.length === 0) {
    return { matches: emptyMatches, lookupSucceeded: true };
  }

  const params = new URLSearchParams({
    term: artistName,
    country: normalizeITunesCountry(country),
    media: 'music',
    entity: 'song',
    attribute: 'artistTerm',
    limit: '200',
  });

  try {
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        matches: emptyMatches,
        lookupSucceeded: false,
        upstreamStatus: response.status,
      };
    }

    const data = (await response.json()) as ITunesSearchResponse;
    return {
      matches: matchITunesTracks(
        artistName,
        tracks,
        Array.isArray(data.results) ? data.results : []
      ),
      lookupSucceeded: true,
      upstreamStatus: response.status,
    };
  } catch {
    return {
      matches: emptyMatches,
      lookupSucceeded: false,
    };
  }
}
