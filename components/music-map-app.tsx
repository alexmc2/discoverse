// components/music-map-app.tsx
'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/loading-screen';
import Header from '@/components/ui/header';
import DefaultContent from '@/components/default-content';
import ModeToggle from '@/components/ui/mode-toggle';
import Legend from '@/components/ui/legend';
import ArtistPanel from '@/components/artist-panel';
import type { GraphNode, GraphLink } from '@/lib/lastfm';
import {
  buildGraphData,
  getArtistInfo,
  getTopTracks as getLastFmTopTracks,
} from '@/lib/lastfm';
import {
  getArtistImage,
  getArtistTopTracks,
  getArtistSpotifyUrl,
} from '@/lib/spotify';

type TrackSource = 'spotify' | 'lastfm' | null;

interface PanelData {
  artist: {
    name: string;
    url: string;
    image?: string;
    listeners: number;
    playcount: number;
    bio?: string;
    tags: string[];
    spotifyUrl?: string;
  } | null;
  tracks: Array<{
    id: string;
    name: string;
    preview_url: string | null;
    duration_ms: number;
    popularity: number;
    album: { name: string; images: Array<{ url: string }> };
    artists: Array<{ name: string }>;
  }>;
  trackSource: TrackSource;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const MusicGraph = dynamic(() => import('@/components/music-graph'), {
  ssr: false,
  loading: () => <LoadingScreen message="Initializing graph engine..." />,
});

// Merge incoming graph data into the existing graph while:
// - preserving object identity and x/y of existing nodes (keeps layout stable)
// - anchoring new nodes near the provided focus when possible
// - recomputing sizes by degree after merge
function mergeGraphs(
  base: GraphData,
  incoming: GraphData,
  opts?: { anchorName?: string }
): GraphData {
  // Produce a stable, undirected key for a link even if react-force-graph
  // mutates source/target from ids to node objects.
  type IdCarrier = Record<string, unknown> & { id?: unknown };
  type LinkLike = { source: unknown; target: unknown };

  const getId = (end: unknown): string => {
    if (typeof end === 'string' || typeof end === 'number') return String(end);
    if (end && typeof end === 'object') {
      const obj = end as IdCarrier;
      if ('id' in obj && (typeof obj.id === 'string' || typeof obj.id === 'number')) {
        return String(obj.id);
      }
    }
    return String(end);
  };
  const linkKey = (l: LinkLike) => {
    const a = getId(l.source);
    const b = getId(l.target);
    return a < b ? `${a}—${b}` : `${b}—${a}`; // undirected key
  };

  // Build a map of existing node objects so we can reuse references
  const nodeMap = new Map<string, GraphNode>();
  for (const n of base.nodes) nodeMap.set(n.id, n);

  // Find anchor position (the node we expanded from)
  const anchor = opts?.anchorName
    ? (nodeMap.get(opts.anchorName) as GraphNode &
        Partial<{ x: number; y: number }>)
    : undefined;

  // Merge/insert nodes. For existing nodes, mutate in place to keep refs.
  for (const n of incoming.nodes) {
    const prev = nodeMap.get(n.id);
    if (prev) {
      // Mutate important fields but keep existing coordinates/velocity fields.
      (prev as GraphNode).image = prev.image || n.image;
      (prev as GraphNode).tags = prev.tags?.length ? prev.tags : n.tags;
      (prev as GraphNode).group = prev.group || n.group;
      (prev as GraphNode).depth = Math.min(prev.depth ?? 99, n.depth ?? 99);
      // Keep size conservative; we’ll recompute later as well
      (prev as GraphNode).size = Math.max(prev.size ?? 6, n.size ?? 6);
    } else {
      // Create new node; if we have an anchor with coords, nudge near it
      const created: GraphNode & Partial<{ x: number; y: number }> = {
        ...n,
      };
      if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number') {
        const jitter = () => (Math.random() - 0.5) * 20; // small spread near anchor
        created.x = anchor.x + jitter();
        created.y = anchor.y + jitter();
      }
      nodeMap.set(n.id, created);
    }
  }

  // Merge links (dedupe by source→target key)
  const linksMap = new Map<string, GraphLink>();
  for (const l of base.links) linksMap.set(linkKey(l as unknown as LinkLike), l);
  for (const l of incoming.links) linksMap.set(linkKey(l as unknown as LinkLike), l);

  const mergedNodes = Array.from(nodeMap.values());
  const mergedLinks = Array.from(linksMap.values());

  // Recompute node sizes from degree so older nodes grow when gaining edges
  const degree = new Map<string, number>();
  for (const l of mergedLinks) {
    const lk = l as unknown as LinkLike;
    const s = getId(lk.source);
    const t = getId(lk.target);
    degree.set(s, (degree.get(s) || 0) + 1);
    degree.set(t, (degree.get(t) || 0) + 1);
  }
  for (const node of mergedNodes) {
    const connections = degree.get(node.id) || 1;
    node.size = Math.min(Math.max(6, connections * 2), 30);
  }

  return { nodes: mergedNodes, links: mergedLinks };
}

async function fetchPanelDataClient(artistName: string): Promise<PanelData> {
  const [info, spotifyImg, spotifyUrl] = await Promise.all([
    getArtistInfo(artistName),
    getArtistImage(artistName),
    getArtistSpotifyUrl(artistName),
  ]);
  const artist = info
    ? { ...info, image: spotifyImg || info.image, spotifyUrl }
    : null;

  let tracks: PanelData['tracks'] = [];
  let trackSource: TrackSource = null;

  try {
    const spotifyTop = await getArtistTopTracks(artistName);
    if (spotifyTop?.length) {
      tracks = spotifyTop.slice(0, 10);
      trackSource = 'spotify';
    } else {
      const lastFmTracks = await getLastFmTopTracks(artistName, 10);
      tracks = lastFmTracks.map((t, idx) => ({
        id: `${artistName}-${t.name}-${idx}`,
        name: t.name,
        preview_url: null,
        duration_ms: 0,
        popularity: 0,
        album: { name: '—', images: [] },
        artists: [{ name: t.artist }],
      }));
      trackSource = 'lastfm';
    }
  } catch {
    /* noop */
  }

  return { artist, tracks, trackSource };
}

export default function MusicMapApp({
  seedArtist,
  initialGraphData,
  panelData,
  randomArtists,
}: {
  seedArtist: string | null;
  initialGraphData: GraphData | null;
  panelData: PanelData | null;
  randomArtists: string[];
}) {
  const router = useRouter();

  const [mode, setMode] = useState<'map' | 'info'>('info');

  const [isPending, startTransition] = useTransition();
  const [showOverlay, setShowOverlay] = useState(false);
  const pendingRef = useRef(false);
  const [isClientGraphLoading, setIsClientGraphLoading] = useState(false);

  useEffect(() => {
    if (isPending && !pendingRef.current) {
      pendingRef.current = true;
      setShowOverlay(true);
    }
    if (!isPending && pendingRef.current) {
      pendingRef.current = false;
      const t = setTimeout(() => setShowOverlay(false), 150);
      return () => clearTimeout(t);
    }
  }, [isPending]);

  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!initialGraphData) return;
    setGraph((prev) =>
      firstLoadRef.current || prev.nodes.length === 0
        ? initialGraphData
        : mergeGraphs(prev, initialGraphData)
    );
    if (firstLoadRef.current) firstLoadRef.current = false;
  }, [initialGraphData]);

  // If SSR didn't provide initial graph, fetch it on the client to
  // avoid Cloudflare Worker subrequest limits during SSR.
  useEffect(() => {
    const run = async () => {
      if (!seedArtist) return;
      if (initialGraphData && initialGraphData.nodes.length) return;
      try {
        setIsClientGraphLoading(true);
        const data = await buildGraphData(seedArtist, 2);
        setGraph(data);
        if (firstLoadRef.current) firstLoadRef.current = false;
      } catch {
        // keep default view on failure
      } finally {
        setIsClientGraphLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedArtist]);

  const hasSearchedFromUrl = !!seedArtist;
  const hasData = graph.nodes.length > 0;

  const [centerNodeName, setCenterNodeName] = useState<string | null>(
    seedArtist ?? null 
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    setCenterNodeName(focus || seedArtist || null);
  }, [seedArtist]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePanelArtist, setActivePanelArtist] = useState<string | null>(
    null
  );
  const [clientPanelData, setClientPanelData] = useState<PanelData | null>(
    null
  );

  useEffect(() => {
    if (
      panelOpen &&
      activePanelArtist &&
      activePanelArtist === seedArtist &&
      panelData
    ) {
      setClientPanelData(panelData);
    }
  }, [panelOpen, activePanelArtist, seedArtist, panelData]);

  const [isExpanding, setIsExpanding] = useState(false);
  const expandTokenRef = useRef(0);

  const setUrlFocus = useCallback((focus: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (focus && focus.trim()) url.searchParams.set('focus', focus);
    else url.searchParams.delete('focus');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const clearAllQueryParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { origin, pathname } = window.location;
    window.history.replaceState({}, '', `${origin}${pathname}`);
  }, []);

  const [resetSignal, setResetSignal] = useState(0);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const startNewSearch = useCallback(
    (artistName: string) => {
      // ALWAYS start a fresh graph when using the main search bar
      // or the random artist buttons. Only node clicks/panel actions extend.
      const trimmed = artistName?.trim();
      if (!trimmed) return;

      setPanelOpen(false);
      setActivePanelArtist(null);
      setClientPanelData(null);
      setGraph({ nodes: [], links: [] });
      firstLoadRef.current = true;
      setCenterNodeName(null);
      setUrlFocus(null);
      clearAllQueryParams();
      setResetSignal((s) => s + 1);

      startTransition(() => {
        router.replace(`/?q=${encodeURIComponent(trimmed)}`);
      });
    },
    [router, setUrlFocus, clearAllQueryParams]
  );

  const expandFrom = useCallback(
    async (artistName: string) => {
      setIsExpanding(true);
      const token = ++expandTokenRef.current;
      try {
        const incoming = await buildGraphData(artistName, 2);
        if (expandTokenRef.current !== token) return;
        setGraph((prev) => mergeGraphs(prev, incoming, { anchorName: artistName }));
        setCenterNodeName(artistName);
        setUrlFocus(artistName);
      } catch {
        /* noop */
      } finally {
        if (expandTokenRef.current === token) setIsExpanding(false);
      }
    },
    [setUrlFocus]
  );

  const onClearData = useCallback(() => {
    // Immediately return to default content without a route transition
    setGraph({ nodes: [], links: [] });
    setPanelOpen(false);
    setActivePanelArtist(null);
    setClientPanelData(null);
    firstLoadRef.current = true;
    setCenterNodeName(null);
    setUrlFocus(null);
    clearAllQueryParams();
    setResetSignal((s) => s + 1);
  }, [setUrlFocus, clearAllQueryParams]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (mode === 'map') {
        // Clicking the current center should just recenter, not expand.
        if (centerNodeName && node.name === centerNodeName) {
          setRecenterSignal((s) => s + 1);
          return;
        }
        expandFrom(node.name);
      } else {
        setPanelOpen(true);
        setActivePanelArtist(node.name);
        setClientPanelData(null);
        fetchPanelDataClient(node.name)
          .then((data) => setClientPanelData(data))
          .catch(() =>
            setClientPanelData({ artist: null, tracks: [], trackSource: null })
          );
      }
    },
    [mode, expandFrom, centerNodeName]
  );

  const handleExpandFromPanel = useCallback(
    (artistName: string) => {
      expandFrom(artistName);
    },
    [expandFrom]
  );

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setActivePanelArtist(null);
    setClientPanelData(null);
  }, []);

  const overlayMessage = isExpanding
    ? 'Mapping connections...'
    : isClientGraphLoading
    ? 'Building your music constellation...'
    : undefined;
  const showAnyOverlay = isExpanding || showOverlay || isClientGraphLoading;

  const showDefault = !hasSearchedFromUrl || !hasData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950/10 via-blue-900/10 to-indigo-950/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/20 via-blue-900/20 to-indigo-900/20" />

      <Header
        onSearch={startNewSearch}
        isLoading={isPending || showAnyOverlay}
        hasSearched={hasSearchedFromUrl}
        hasData={hasData}
        onClearData={onClearData}
        error={null}
        mode={mode}
        onModeChange={setMode}
        resetSignal={resetSignal}
        // Show recenter only when graph is visible
        showRecenter={hasSearchedFromUrl && hasData}
        canRecenter={!!centerNodeName}
        onRecenter={() => setRecenterSignal((s) => s + 1)}
      />

      <div
        className="fixed inset-0"
        style={{ paddingTop: showDefault ? '180px' : '0' }}
      >
        {showDefault ? (
          <DefaultContent
            onSearch={startNewSearch}
            randomArtists={randomArtists}
          />
        ) : (
          <div className="fixed inset-0 overflow-hidden">
            <MusicGraph
              data={graph}
              onNodeClick={handleNodeClick}
              selectedNode={null}
              centerNodeName={centerNodeName}
              recenterSignal={recenterSignal}
            />
          </div>
        )}
      </div>

      {/* Keep Legend + Mode toggle in their fixed positions */}
      {hasSearchedFromUrl && hasData && (
        <>
          <Legend />
          <ModeToggle mode={mode} onModeChange={setMode} />
        </>
      )}

      {panelOpen && (
        <ArtistPanel
          artistName={activePanelArtist}
          artist={clientPanelData?.artist ?? null}
          tracks={clientPanelData?.tracks ?? []}
          trackSource={clientPanelData?.trackSource ?? null}
          onClose={handleClosePanel}
          onExpand={handleExpandFromPanel}
        />
      )}

      {showAnyOverlay && <LoadingScreen message={overlayMessage} />}
    </div>
  );
}
