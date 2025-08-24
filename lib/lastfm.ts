import axios from 'axios';
import { getArtistImage } from './spotify';

// Use local API route to avoid CORS issues
const BASE_URL = '/api/lastfm';

interface LastFmArtist {
  name: string;
  mbid?: string;
  match?: string;
  url: string;
  image?: Array<{
    '#text': string;
    size: string;
  }>;
}

interface LastFmTag {
  name: string;
  count: number;
  url: string;
}

export interface Artist {
  id: string;
  name: string;
  match?: number;
  url?: string;
  image?: string;
  tags?: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  group?: string;
  size?: number;
  image?: string;
  tags?: string[];
  depth?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(url: string) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await axios.get(url);
    cache.set(url, { data: response.data, timestamp: Date.now() });
    return response.data;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
}

export async function searchArtist(query: string): Promise<Artist[]> {
  if (!query) return [];
  
  const url = `${BASE_URL}?method=artist.search&artist=${encodeURIComponent(query)}&limit=30`;
  
  try {
    const data = await fetchWithCache(url);
    const artists = data?.results?.artistmatches?.artist || [];
    
    return artists.map((artist: LastFmArtist, index: number) => ({
      id: artist.mbid ? `${artist.mbid}-${index}` : `${artist.name}-${index}`,
      name: artist.name,
      url: artist.url,
      image: artist.image?.find(img => img.size === 'large')?.['#text']
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export async function getSimilarArtists(artistName: string, limit: number = 20): Promise<Artist[]> {
  const url = `${BASE_URL}?method=artist.getsimilar&artist=${encodeURIComponent(artistName)}&limit=${limit}`;
  
  try {
    const data = await fetchWithCache(url);
    const similar = data?.similarartists?.artist || [];
    
    return similar.map((artist: LastFmArtist, index: number) => ({
      id: artist.mbid ? `${artist.mbid}-${index}` : `${artist.name}-${index}`,
      name: artist.name,
      match: parseFloat(artist.match || '0'),
      url: artist.url,
      image: artist.image?.find(img => img.size === 'large')?.['#text']
    }));
  } catch (error) {
    console.error('Similar artists error:', error);
    return [];
  }
}

export async function getArtistTags(artistName: string): Promise<string[]> {
  const url = `${BASE_URL}?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}`;
  
  try {
    const data = await fetchWithCache(url);
    const tags = data?.toptags?.tag || [];
    
    return tags
      .slice(0, 5)
      .map((tag: LastFmTag) => tag.name)
      .filter((tag: string) => tag && tag.length > 0);
  } catch (error) {
    console.error('Tags error:', error);
    return [];
  }
}

export async function getArtistInfo(artistName: string) {
  const url = `${BASE_URL}?method=artist.getinfo&artist=${encodeURIComponent(artistName)}`;
  
  try {
    const data = await fetchWithCache(url);
    const artist = data?.artist;
    
    if (!artist) return null;
    
    return {
      name: artist.name,
      url: artist.url,
      image: artist.image?.find((img: { size: string; '#text': string }) => img.size === 'extralarge')?.['#text'],
      listeners: parseInt(artist.stats?.listeners || '0'),
      playcount: parseInt(artist.stats?.playcount || '0'),
      bio: artist.bio?.summary?.replace(/<[^>]*>/g, '').split('Read more')[0],
      tags: artist.tags?.tag?.slice(0, 5).map((tag: { name: string }) => tag.name) || []
    };
  } catch (error) {
    console.error('Artist info error:', error);
    return null;
  }
}

export async function buildGraphData(seedArtist: string, depth: number = 2) {
  const nodes: Map<string, GraphNode> = new Map();
  const links: GraphLink[] = [];
  const processed = new Set<string>();
  
  // Add seed artist with full info including image from Spotify
  const [seedTags, seedInfo, spotifyImage] = await Promise.all([
    getArtistTags(seedArtist),
    getArtistInfo(seedArtist),
    getArtistImage(seedArtist)
  ]);
  
  const seedNode: GraphNode = {
    id: seedArtist,
    name: seedArtist,
    group: seedTags[0] || 'unknown',
    size: 20,
    image: spotifyImage || seedInfo?.image,
    tags: seedTags,
    depth: 0
  };
  nodes.set(seedArtist, seedNode);
  
  // Get similar artists (depth 1)
  const similar = await getSimilarArtists(seedArtist, 15);
  
  // Fetch Spotify images for all similar artists in parallel
  const artistNames = similar.map(a => a.name);
  const spotifyImagePromises = artistNames.map(name => getArtistImage(name));
  const spotifyImages = await Promise.all(spotifyImagePromises);
  const imageMap = new Map<string, string | undefined>();
  artistNames.forEach((name, i) => {
    if (spotifyImages[i]) {
      imageMap.set(name, spotifyImages[i]);
    }
  });
  
  for (const artist of similar) {
    if (!nodes.has(artist.name)) {
      const tags = await getArtistTags(artist.name);
      nodes.set(artist.name, {
        id: artist.name,
        name: artist.name,
        group: tags[0] || 'unknown',
        size: 10,
        image: imageMap.get(artist.name) || artist.image,
        tags,
        depth: 1
      });
    }
    
    links.push({
      source: seedArtist,
      target: artist.name,
      value: artist.match || 0.5
    });
  }
  
  // Get connections between similar artists (depth 2)
  if (depth >= 2) {
    const similarNames = similar.slice(0, 8).map(a => a.name);
    
    for (const artistName of similarNames) {
      if (processed.has(artistName)) continue;
      processed.add(artistName);
      
      const secondLevel = await getSimilarArtists(artistName, 5);
      
      for (const related of secondLevel) {
        // Only add if it connects to existing nodes
        if (nodes.has(related.name) && related.name !== artistName) {
          links.push({
            source: artistName,
            target: related.name,
            value: (related.match || 0.5) * 0.7
          });
        } else if (!nodes.has(related.name) && nodes.size < 100) {
          // Add new nodes up to limit
          const [tags, spotifyImage] = await Promise.all([
            getArtistTags(related.name),
            getArtistImage(related.name)
          ]);
          nodes.set(related.name, {
            id: related.name,
            name: related.name,
            group: tags[0] || 'unknown',
            size: 5,
            image: spotifyImage || related.image,
            tags,
            depth: 2
          });
          
          links.push({
            source: artistName,
            target: related.name,
            value: (related.match || 0.5) * 0.5
          });
        }
      }
    }
  }
  
  // Calculate node sizes based on connections
  const connectionCount = new Map<string, number>();
  links.forEach(link => {
    connectionCount.set(link.source, (connectionCount.get(link.source) || 0) + 1);
    connectionCount.set(link.target, (connectionCount.get(link.target) || 0) + 1);
  });
  
  nodes.forEach(node => {
    const connections = connectionCount.get(node.id) || 1;
    node.size = Math.min(Math.max(5, connections * 2), 30);
  });
  
  return {
    nodes: Array.from(nodes.values()),
    links
  };
}