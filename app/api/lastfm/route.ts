import { NextRequest, NextResponse } from 'next/server';
import { getLastfmMethodData, isSupportedLastfmMethod } from '@/lib/lastfm';

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

    if (!isSupportedLastfmMethod(method)) {
      return NextResponse.json(
        { error: `Unsupported method: ${method}` },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'method' || key === 'api_key' || key === 'format') continue;
      if (!value?.trim()) continue;
      params[key] = value.trim();
    }

    const methodsWithLimit = new Set([
      'artist.search',
      'artist.getsimilar',
      'artist.gettoptracks',
      'chart.gettopartists',
    ]);
    if (methodsWithLimit.has(method) && !params.limit) {
      params.limit = '20';
    }

    const data = await getLastfmMethodData(method, params);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Last.fm API' },
      { status: 500 }
    );
  }
}
