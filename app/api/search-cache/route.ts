// app/api/search-cache/route.ts
import { getKV } from '@/lib/server/cache';
import { getDefaultArtistPanelData } from '@/lib/server/artists';

const HARD_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days

export async function GET(request: Request) {
  const kv = getKV();
  if (!kv) return Response.json({ data: null });

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const type = searchParams.get('type');

  if (!artist || (type !== 'graph' && type !== 'panel')) {
    return Response.json({ data: null }, { status: 400 });
  }

  const normalized = artist.trim().toLowerCase();

  try {
    // Check search cache first
    const searchKey = `search-cache:v1:${type}:${normalized}`;
    const raw = await kv.get(searchKey);
    if (raw) {
      const envelope = JSON.parse(raw);
      return Response.json({ data: envelope?.data ?? envelope });
    }

    // For panel data, also check the default artist cache
    if (type === 'panel') {
      const panelData = await getDefaultArtistPanelData(artist);
      if (panelData) {
        return Response.json({ data: panelData });
      }
    }

    return Response.json({ data: null });
  } catch {
    return Response.json({ data: null });
  }
}

export async function POST(request: Request) {
  const kv = getKV();
  if (!kv) return Response.json({ ok: false }, { status: 503 });

  let body: { artist?: string; type?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { artist, type, data } = body;

  if (
    !artist ||
    typeof artist !== 'string' ||
    (type !== 'graph' && type !== 'panel') ||
    !data
  ) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const normalized = artist.trim().toLowerCase();
  const key = `search-cache:v1:${type}:${normalized}`;
  const envelope = { v: 1, cachedAt: Date.now(), data };

  try {
    await kv.put(key, JSON.stringify(envelope), { expirationTtl: HARD_TTL_SECONDS });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
