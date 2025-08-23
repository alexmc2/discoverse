'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import SearchBar from '@/components/SearchBar';
import ArtistPanel from '@/components/ArtistPanel';
import LoadingScreen from '@/components/LoadingScreen';
import { buildGraphData, GraphNode, GraphLink } from '@/lib/lastfm';
import { Github, Music2 } from 'lucide-react';

// Dynamically import the graph component to avoid SSR issues
const MusicGraph = dynamic(() => import('@/components/MusicGraph'), {
  ssr: false,
  loading: () => <LoadingScreen message="Initializing graph engine..." />
});

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (artistName: string) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    
    try {
      const data = await buildGraphData(artistName);
      
      if (data.nodes.length === 0) {
        setError(`No data found for "${artistName}". Please try another artist.`);
        setGraphData({ nodes: [], links: [] });
      } else {
        setGraphData(data);
        setSelectedArtist(null);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to load artist data. Please check your API key or try again.');
      setGraphData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedArtist(node.name);
  }, []);

  const handleExpand = useCallback((artistName: string) => {
    setSelectedArtist(null);
    handleSearch(artistName);
  }, [handleSearch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      
      {/* Header */}
      <header className="relative z-20 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Music Map</h1>
                <p className="text-gray-400 text-sm">Explore constellations of related artists</p>
              </div>
            </div>
            
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="View on GitHub"
            >
              <Github className="w-6 h-6" />
            </a>
          </div>
          
          <SearchBar onSearch={handleSearch} isLoading={loading} />
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-center">
              {error}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative" style={{ height: 'calc(100vh - 180px)' }}>
        {!hasSearched ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <div className="w-32 h-32 mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-2xl opacity-50 animate-pulse-glow" />
                <div className="relative w-full h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Music2 className="w-16 h-16 text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">
                Discover Musical Connections
              </h2>
              <p className="text-gray-400 max-w-md mx-auto mb-8">
                Search for any artist or band to explore their musical universe. 
                See how artists connect through genres and influences in an interactive constellation.
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {['The Beatles', 'Radiohead', 'Kendrick Lamar', 'Taylor Swift', 'Pink Floyd'].map((artist) => (
                  <button
                    key={artist}
                    onClick={() => handleSearch(artist)}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-purple-900/30 text-gray-300 hover:text-white rounded-full text-sm transition-all duration-300 border border-gray-700 hover:border-purple-600"
                  >
                    {artist}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {loading && <LoadingScreen />}
            </AnimatePresence>
            
            {graphData.nodes.length > 0 && (
              <MusicGraph
                data={graphData}
                onNodeClick={handleNodeClick}
                selectedNode={selectedArtist}
              />
            )}
          </>
        )}
      </main>

      {/* Artist details panel */}
      <ArtistPanel
        artistName={selectedArtist}
        onClose={() => setSelectedArtist(null)}
        onExpand={handleExpand}
      />

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 p-4 text-center text-gray-500 text-sm z-10">
        <p>
          Powered by{' '}
          <a
            href="https://www.last.fm/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Last.fm API
          </a>
        </p>
      </footer>
    </div>
  );
}