// lib/spotify.ts
// Spotify Web API integration for artist images
// Using Client Credentials flow (no user authentication required)

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  genres: string[];
  popularity: number;
}

interface SpotifySearchResponse {
  artists: {
    items: SpotifyArtist[];
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  duration_ms: number;
  popularity: number;
  album: {
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  artists: Array<{
    name: string;
  }>;
}

interface SpotifyTopTracksResponse {
  tracks: SpotifyTrack[];
}

// Cache token in memory
let cachedToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  try {
    const response = await fetch('/api/spotify/token', {
      method: 'POST',
    });

    // If credentials aren't configured, return null
    if (response.status === 501) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to get Spotify token');
    }

    const data: SpotifyToken = await response.json();
    
    // Cache the token (expires 5 minutes before actual expiry for safety)
    cachedToken = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in - 300) * 1000
    };

    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

export async function searchSpotifyArtist(artistName: string): Promise<SpotifyArtist | null> {
  try {
    const token = await getSpotifyToken();
    
    // If no token (credentials not configured), return null
    if (!token) {
      return null;
    }
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      console.error('Spotify search failed:', response.status);
      return null;
    }

    const data: SpotifySearchResponse = await response.json();
    
    if (data.artists.items.length > 0) {
      return data.artists.items[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Spotify artist:', error);
    return null;
  }
}

export async function getArtistImage(artistName: string): Promise<string | undefined> {
  try {
    const artist = await searchSpotifyArtist(artistName);
    
    if (artist && artist.images.length > 0) {
      // Return the medium-sized image (usually index 1) or the first available
      return artist.images[1]?.url || artist.images[0]?.url;
    }
    
    return undefined;
  } catch (error) {
    console.error(`Error getting Spotify image for ${artistName}:`, error);
    return undefined;
  }
}

// Batch fetch multiple artist images
export async function getArtistImages(artistNames: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  
  // Process in parallel but limit concurrent requests
  const batchSize = 5;
  for (let i = 0; i < artistNames.length; i += batchSize) {
    const batch = artistNames.slice(i, i + batchSize);
    const promises = batch.map(async (name) => {
      const image = await getArtistImage(name);
      if (image) {
        imageMap.set(name, image);
      }
    });
    
    await Promise.all(promises);
  }
  
  return imageMap;
}

export async function getArtistTopTracks(artistName: string, market: string = 'US'): Promise<SpotifyTrack[]> {
  try {
    // First, search for the artist to get their Spotify ID
    const artist = await searchSpotifyArtist(artistName);
    
    if (!artist) {
      return [];
    }

    const token = await getSpotifyToken();
    
    if (!token) {
      return [];
    }
    
    const response = await fetch(
      `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=${market}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      console.error('Spotify top tracks failed:', response.status);
      return [];
    }

    const data: SpotifyTopTracksResponse = await response.json();
    
    console.log(`Found ${data.tracks.length} tracks for ${artistName}`);
    console.log('Tracks with previews:', data.tracks.filter(t => t.preview_url).length);
    
    // Return all tracks, even without preview URLs (we'll handle in UI)
    return data.tracks.slice(0, 10);
  } catch (error) {
    console.error('Error getting Spotify top tracks:', error);
    return [];
  }
}