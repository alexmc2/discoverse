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

function mergeGraphs(base: GraphData, incoming: GraphData): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const linkKey = (l: GraphLink) => `${l.source}→${l.target}`;
  for (const n of base.nodes) nodeMap.set(n.id, n);
  const linksMap = new Map<string, GraphLink>();
  for (const l of base.links) linksMap.set(linkKey(l), l);
  for (const n of incoming.nodes) {
    const prev = nodeMap.get(n.id);
    nodeMap.set(
      n.id,
      prev
        ? {
            ...prev,
            image: prev.image || n.image,
            tags: prev.tags?.length ? prev.tags : n.tags,
            size: Math.max(prev.size ?? 6, n.size ?? 6),
            group: prev.group || n.group,
            depth: Math.min(prev.depth ?? 99, n.depth ?? 99),
          }
        : n
    );
  }
  for (const l of incoming.links) linksMap.set(linkKey(l), l);
  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linksMap.values()),
  };
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
        const trimmed = artistName?.trim();
        if (trimmed) router.replace(`/?q=${encodeURIComponent(trimmed)}`);
        else router.replace(`/`);
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
        setGraph((prev) => mergeGraphs(prev, incoming));
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
    setGraph({ nodes: [], links: [] });
    setPanelOpen(false);
    setActivePanelArtist(null);
    setClientPanelData(null);
    firstLoadRef.current = true;
    setCenterNodeName(null);
    setUrlFocus(null);
    clearAllQueryParams();
    setResetSignal((s) => s + 1);

    startTransition(() => {
      router.replace('/');
    });
  }, [router, setUrlFocus, clearAllQueryParams]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (mode === 'map') {
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
    [mode, expandFrom]
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
        // NEW — pass recenter controls to place the button under the search
        showRecenter={hasSearchedFromUrl}
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
