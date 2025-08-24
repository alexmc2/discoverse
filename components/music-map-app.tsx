// components/MusicMapApp.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import ArtistPanel from '@/components/ArtistPanel';
import LoadingScreen from '@/components/LoadingScreen';
import Header from '@/components/ui/header';
import DefaultContent from '@/components/DefaultContent';
import { buildGraphData, GraphNode, GraphLink } from '@/lib/lastfm';

const MusicGraph = dynamic(() => import('@/components/MusicGraph'), {
  ssr: false,
  loading: () => <LoadingScreen message="Initializing graph engine..." />,
});

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const STORAGE_KEYS = {
  GRAPH_DATA: 'musicMap_graphData',
  HAS_SEARCHED: 'musicMap_hasSearched',
  SELECTED_ARTIST: 'musicMap_selectedArtist',
};

export default function MusicMapApp() {
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedGraphData = localStorage.getItem(STORAGE_KEYS.GRAPH_DATA);
    const storedHasSearched = localStorage.getItem(STORAGE_KEYS.HAS_SEARCHED);
    const storedSelectedArtist = localStorage.getItem(
      STORAGE_KEYS.SELECTED_ARTIST
    );

    if (storedGraphData) {
      try {
        const parsedData = JSON.parse(storedGraphData);
        setGraphData(parsedData);
      } catch (e) {
        console.error('Failed to parse stored graph data:', e);
      }
    }

    if (storedHasSearched === 'true') setHasSearched(true);
    if (storedSelectedArtist && storedSelectedArtist !== 'null')
      setSelectedArtist(storedSelectedArtist);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated)
      localStorage.setItem(STORAGE_KEYS.GRAPH_DATA, JSON.stringify(graphData));
  }, [graphData, isHydrated]);

  useEffect(() => {
    if (isHydrated)
      localStorage.setItem(STORAGE_KEYS.HAS_SEARCHED, String(hasSearched));
  }, [hasSearched, isHydrated]);

  useEffect(() => {
    if (isHydrated)
      localStorage.setItem(
        STORAGE_KEYS.SELECTED_ARTIST,
        String(selectedArtist)
      );
  }, [selectedArtist, isHydrated]);

  const handleSearch = useCallback(async (artistName: string) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await buildGraphData(artistName);

      if (data.nodes.length === 0) {
        setError(
          `No data found for "${artistName}". Please try another artist.`
        );
        setGraphData({ nodes: [], links: [] });
      } else {
        setGraphData(data);
        setSelectedArtist(null);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(
        'Failed to load artist data. Please check your API key or try again.'
      );
      setGraphData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedArtist(node.name);
  }, []);

  const handleExpand = useCallback(
    (artistName: string) => {
      setSelectedArtist(null);
      handleSearch(artistName);
    },
    [handleSearch]
  );

  const handleClearData = useCallback(() => {
    setGraphData({ nodes: [], links: [] });
    setHasSearched(false);
    setSelectedArtist(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEYS.GRAPH_DATA);
    localStorage.removeItem(STORAGE_KEYS.HAS_SEARCHED);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_ARTIST);
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-sky-950/10 via-blue-900/10 to-indigo-950/10 relative overflow-hidden"
      style={{ overflow: 'hidden' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/20 via-blue-900/20 to-indigo-900/20" />

      {!loading && (
        <Header
          onSearch={handleSearch}
          isLoading={loading}
          hasSearched={hasSearched}
          hasData={graphData.nodes.length > 0}
          onClearData={handleClearData}
          error={error}
        />
      )}

      <div
        className="fixed inset-0"
        style={{ paddingTop: !hasSearched ? '180px' : '0' }}
      >
        {!hasSearched ? (
          <DefaultContent onSearch={handleSearch} />
        ) : (
          <>
            <AnimatePresence>{loading && <LoadingScreen />}</AnimatePresence>

            {graphData.nodes.length > 0 && (
              <div className="fixed inset-0 overflow-hidden">
                <MusicGraph
                  data={graphData}
                  onNodeClick={handleNodeClick}
                  selectedNode={selectedArtist}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ArtistPanel
        artistName={selectedArtist}
        onClose={() => setSelectedArtist(null)}
        onExpand={handleExpand}
      />
    </div>
  );
}
