// app/api/spotify/token/route.ts
import { NextResponse } from 'next/server';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST() {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      return NextResponse.json(
        { error: 'Spotify credentials not configured' },
        { status: 501 }
      );
    }

    const credentials =
      typeof Buffer !== 'undefined'
        ? Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        : btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Spotify token HTTP error:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to get Spotify token' },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Spotify token error:', error);
    return NextResponse.json(
      { error: 'Failed to get Spotify token' },
      { status: 500 }
    );
  }
}
