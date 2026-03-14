// app/api/itunes-preview/route.ts
// Server-side proxy for iTunes Search API to avoid CORS 403 errors in browsers.

interface ITunesResult {
  artistName: string;
  trackName: string;
  previewUrl?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const track = searchParams.get('track');

  if (!artist || !track) {
    return Response.json({ previewUrl: null }, { status: 400 });
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${artist} ${track}`
    )}&media=music&entity=song&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return Response.json({ previewUrl: null });
    const data = await res.json();

    if (!data.results?.length) return Response.json({ previewUrl: null });

    const lowerArtist = artist.toLowerCase();
    const lowerTrack = track.toLowerCase();

    const exact = data.results.find((r: ITunesResult) => {
      const a = (r.artistName || '').toLowerCase();
      const t = (r.trackName || '').toLowerCase();
      return a.includes(lowerArtist) && t === lowerTrack && !!r.previewUrl;
    });

    const candidate =
      exact ?? data.results.find((r: ITunesResult) => !!r.previewUrl) ?? null;
    return Response.json({ previewUrl: candidate?.previewUrl ?? null });
  } catch {
    return Response.json({ previewUrl: null });
  }
}
