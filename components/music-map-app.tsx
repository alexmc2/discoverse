// components/music-map-app.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import ArtistPanel from '@/components/artist-panel';
import LoadingScreen from '@/components/loading-screen';
import Header from '@/components/ui/header';
import DefaultContent from '@/components/default-content';
import ModeToggle from '@/components/ui/mode-toggle';
import Legend from '@/components/ui/legend';
import { buildGraphData, GraphNode, GraphLink } from '@/lib/lastfm';

const MusicGraph = dynamic(() => import('@/components/music-graph'), {
  ssr: false,
  loading: () => <LoadingScreen message="Initializing graph engine..." />,
});

interface GraphData {
  nodes: GraphNode[]; // we may store extra props on nodes (e.g., baseSize), TS allows excess properties
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

  const expansionCache = useRef<Map<string, GraphData>>(new Map());

  // ---------- helpers: merge + recenter/rescale ----------

  // Ensure each node has a stable baseSize to scale from (so sizes don’t compound)
  const ensureBaseSize = useCallback((g: GraphData): GraphData => {
    return {
      nodes: g.nodes.map((n) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = (n as any).baseSize ?? n.size ?? 10;
        return { ...n, baseSize: base } as GraphNode & { baseSize: number };
      }),
      links: g.links.slice(),
    };
  }, []);

  // Merge two graphs without dupes
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
        `${
          typeof l.source === 'string'
            ? l.source
            : (l.source as unknown as string)
        }-${
          typeof l.target === 'string'
            ? l.target
            : (l.target as unknown as string)
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

  // Recompute depth (BFS distance) from new center and rescale size from baseSize
  const recomputeFromCenter = useCallback(
    (g: GraphData, centerName: string): GraphData => {
      const nodes = g.nodes.map((n) => ({ ...n })); // shallow copy to keep state immutable
      const links = g.links.slice();

      const idByName = new Map(
        nodes.map((n) => [n.name.toLowerCase(), n.id] as const)
      );
      const centerId = idByName.get(centerName.toLowerCase());
      if (!centerId) return g; // nothing to do if we somehow don’t have that node

      // Build undirected adjacency from current links
      const adj = new Map<string, Set<string>>();
      for (const l of links) {
        const s =
          typeof l.source === 'string'
            ? l.source
            : (l.source as unknown as string);
        const t =
          typeof l.target === 'string'
            ? l.target
            : (l.target as unknown as string);
        if (!adj.has(s)) adj.set(s, new Set());
        if (!adj.has(t)) adj.set(t, new Set());
        adj.get(s)!.add(t);
        adj.get(t)!.add(s);
      }

      // BFS distances from center
      const dist = new Map<string, number>();
      const q: string[] = [centerId];
      dist.set(centerId, 0);
      while (q.length) {
        const u = q.shift()!;
        const du = dist.get(u)!;
        const nbrs = adj.get(u);
        if (!nbrs) continue;
        for (const v of nbrs) {
          if (!dist.has(v)) {
            dist.set(v, du + 1);
            q.push(v);
          }
        }
      }

      // Size mapping: scale down with distance; boost center a bit.
      // You can tune these constants for your taste.
      const clamp = (v: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, v));
      const MAX_DEPTH_FOR_SIZE = 6;
      const FAR_SIZE_FLOOR = 6; // minimum radius for very distant nodes
      const CENTER_BOOST = 1.6; // how much bigger the center appears
      const NEIGHBOR_BOOST = 1.15; // depth=1
      const DECAY = 0.85; // exponential decay per extra hop (depth>=2)

      for (const n of nodes) {
        const d = dist.get(n.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = (n as any).baseSize ?? n.size ?? 10;

        if (d === 0) {
          n.depth = 0;
          n.size = clamp(Math.round(base * CENTER_BOOST), FAR_SIZE_FLOOR, 28);
        } else if (d === 1) {
          n.depth = 1;
          n.size = clamp(Math.round(base * NEIGHBOR_BOOST), FAR_SIZE_FLOOR, 24);
        } else if (typeof d === 'number') {
          const k = Math.pow(DECAY, Math.min(d, MAX_DEPTH_FOR_SIZE));
          n.depth = d;
          n.size = clamp(Math.round(base * k), FAR_SIZE_FLOOR, 22);
        } else {
          // disconnected from the new center; treat as "far"
          n.depth = MAX_DEPTH_FOR_SIZE + 1;
          n.size = FAR_SIZE_FLOOR;
        }
      }

      return { nodes, links };
    },
    []
  );

  // ---------- load from localStorage ----------
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
        setGraphData(JSON.parse(storedGraphData));
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

  // ---------- actions ----------

  const handleSearch = useCallback(
    async (artistName: string) => {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        const raw = await buildGraphData(artistName);
        if (raw.nodes.length === 0) {
          setError(
            `No data found for "${artistName}". Please try another artist.`
          );
          setGraphData({ nodes: [], links: [] });
        } else {
          const withBase = ensureBaseSize(raw);
          const recentered = recomputeFromCenter(withBase, artistName);
          setGraphData(recentered);
          setSelectedArtist(null);
          setCenterNodeName(artistName);
          expansionCache.current.set(artistName.toLowerCase(), withBase);
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
    },
    [ensureBaseSize, recomputeFromCenter]
  );

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
          data = ensureBaseSize(data);
          expansionCache.current.set(key, data);
        }

        setGraphData((prev) => {
          const merged = mergeGraphData(prev, data!);
          const withBase = ensureBaseSize(merged);
          return recomputeFromCenter(withBase, artistName);
        });

        setSelectedArtist(null);
        setCenterNodeName(artistName);
      } catch (err) {
        console.error('Expand error:', err);
        setError('Failed to expand from artist.');
      } finally {
        setLoading(false);
      }
    },
    [ensureBaseSize, mergeGraphData, recomputeFromCenter]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (mode === 'map') {
        // Expand and re-center on the clicked node, keeping existing graph
        expandFromArtist(node.name);
      } else {
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

  const hasData = graphData.nodes.length > 0;

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
          hasData={hasData}
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
            {hasData && (
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

      {hasSearched && hasData && !loading && (
        <div className="fixed sm:left-4 left-4 sm:bottom-4 bottom-2 z-40 flex flex-col gap-2">
          <Legend />
          <ModeToggle mode={mode} onModeChange={setMode} />
        </div>
      )}

      <ArtistPanel
        artistName={selectedArtist}
        onClose={() => setSelectedArtist(null)}
        onExpand={handleExpandFromPanel}
      />
    </div>
  );
}
