'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import ArtistPanel from '@/components/artist-panel';
import LoadingScreen from '@/components/loading-screen';
import Header from '@/components/ui/header';
import DefaultContent from '@/components/default-content';
import { buildGraphData, GraphNode, GraphLink } from '@/lib/lastfm';

const MusicGraph = dynamic(() => import('@/components/music-graph'), {
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
  MODE: 'musicMap_mode',
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
  const [mode, setMode] = useState<'map' | 'info'>('info');
  const [centerNodeName, setCenterNodeName] = useState<string | null>(null);

  // Simple in-memory cache for expansions
  const expansionCache = useRef<Map<string, GraphData>>(new Map());

  useEffect(() => {
    const storedGraphData = localStorage.getItem(STORAGE_KEYS.GRAPH_DATA);
    const storedHasSearched = localStorage.getItem(STORAGE_KEYS.HAS_SEARCHED);
    const storedSelectedArtist = localStorage.getItem(
      STORAGE_KEYS.SELECTED_ARTIST
    );
    const storedMode = localStorage.getItem(STORAGE_KEYS.MODE) as
      | 'map'
      | 'info'
      | null;

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
    if (storedMode === 'map' || storedMode === 'info') setMode(storedMode);
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

  useEffect(() => {
    if (isHydrated) localStorage.setItem(STORAGE_KEYS.MODE, mode);
  }, [mode, isHydrated]);

  const mergeGraphData = useCallback(
    (base: GraphData, incoming: GraphData): GraphData => {
      const nodeById = new Map(base.nodes.map((n) => [n.id, n] as const));
      const nodes: GraphNode[] = [...base.nodes];

      for (const n of incoming.nodes) {
        if (!nodeById.has(n.id)) {
          nodeById.set(n.id, n);
          nodes.push(n);
        }
      }

      const linkKey = (l: GraphLink) =>
        `${typeof l.source === 'string' ? l.source : l.source}-${
          typeof l.target === 'string' ? l.target : l.target
        }`;
      const existingLinks = new Set(base.links.map(linkKey));
      const links: GraphLink[] = [...base.links];

      for (const l of incoming.links) {
        const k = linkKey(l);
        if (!existingLinks.has(k)) {
          existingLinks.add(k);
          links.push(l);
        }
      }

      return { nodes, links };
    },
    []
  );

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
        setCenterNodeName(artistName); // ensure center on initial search
        expansionCache.current.set(artistName.toLowerCase(), data);
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

  const expandFromArtist = useCallback(
    async (artistName: string) => {
      const key = artistName.toLowerCase();
      let data = expansionCache.current.get(key);

      setLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        if (!data) {
          data = await buildGraphData(artistName);
          if (data.nodes.length === 0) {
            setLoading(false);
            return;
          }
          expansionCache.current.set(key, data);
        }

        setGraphData((prev) => mergeGraphData(prev, data!));
        setSelectedArtist(null);
        setCenterNodeName(artistName); // request re-center on the new artist
      } catch (err) {
        console.error('Expand error:', err);
        setError('Failed to expand from artist.');
      } finally {
        setLoading(false);
      }
    },
    [mergeGraphData]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (mode === 'map') {
        // In Map mode, clicking expands/merges and recenters
        expandFromArtist(node.name);
      } else {
        // Info mode: open the side panel (existing behavior)
        setSelectedArtist(node.name);
      }
    },
    [mode, expandFromArtist]
  );

  const handleExpandFromPanel = useCallback(
    (artistName: string) => {
      setSelectedArtist(null);
      expandFromArtist(artistName);
    },
    [expandFromArtist]
  );

  const handleClearData = useCallback(() => {
    setGraphData({ nodes: [], links: [] });
    setHasSearched(false);
    setSelectedArtist(null);
    setError(null);
    setCenterNodeName(null);
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
          mode={mode}
          onModeChange={setMode}
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
                  centerNodeName={centerNodeName}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ArtistPanel
        artistName={selectedArtist}
        onClose={() => setSelectedArtist(null)}
        onExpand={handleExpandFromPanel}
      />
    </div>
  );
}
