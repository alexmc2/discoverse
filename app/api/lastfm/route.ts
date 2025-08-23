import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY || '';
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const method = searchParams.get('method');
    const artist = searchParams.get('artist');
    const limit = searchParams.get('limit') || '20';

    if (!method) {
      return NextResponse.json({ error: 'Method parameter is required' }, { status: 400 });
    }

    // Build the Last.fm API URL
    const params = new URLSearchParams({
      method,
      api_key: API_KEY,
      format: 'json',
      limit,
    });

    if (artist) {
      params.append('artist', artist);
    }

    const url = `${BASE_URL}?${params.toString()}`;

    // Fetch from Last.fm API
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }

    const data = await response.json();

    // Return the data with proper CORS headers
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