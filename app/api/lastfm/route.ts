import { NextRequest, NextResponse } from 'next/server';
import { getLastfmMethodData, isSupportedLastfmMethod } from '@/lib/lastfm';

const METHODS_WITH_LIMIT = new Set([
  'artist.search',
  'artist.getsimilar',
  'artist.gettoptracks',
  'chart.gettopartists',
]);

async function handleLastfm(
  method: string,
  params: Record<string, string>
) {
  if (!isSupportedLastfmMethod(method)) {
    return NextResponse.json(
      { error: `Unsupported method: ${method}` },
      { status: 400 }
    );
  }

  if (METHODS_WITH_LIMIT.has(method) && !params.limit) {
    params.limit = '20';
  }

  const data = await getLastfmMethodData(method, params);

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const method = searchParams.get('method');

    if (!method) {
      return NextResponse.json(
        { error: 'Method parameter is required' },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'method' || key === 'api_key' || key === 'format') continue;
      if (!value?.trim()) continue;
      params[key] = value.trim();
    }

    return await handleLastfm(method, params);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Last.fm API' },
      { status: 500 }
    );
  }
}

// POST handler: accepts JSON body so artist names with "&" aren't
// mangled by URL-parameter parsing on the Cloudflare/OpenNext edge.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const method = body?.method;

    if (!method || typeof method !== 'string') {
      return NextResponse.json(
        { error: 'Method parameter is required' },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === 'method' || key === 'api_key' || key === 'format') continue;
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const str = String(value).trim();
      if (!str) continue;
      params[key] = str;
    }

    return await handleLastfm(method, params);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Last.fm API' },
      { status: 500 }
    );
  }
}
