import { NextResponse } from 'next/server';

// Spotify Client Credentials
// You'll need to get these from https://developer.spotify.com/dashboard
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST() {
  try {
    // Check if credentials are configured
    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      return NextResponse.json(
        { error: 'Spotify credentials not configured' },
        { status: 501 }
      );
    }
    
    // Create base64 encoded credentials
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    // Request access token from Spotify
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get Spotify token');
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