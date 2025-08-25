// components/music-graph.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D, {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from 'react-force-graph-2d';
import { GraphNode, GraphLink } from '@/lib/lastfm';

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceGraphLink extends Omit<GraphLink, 'source' | 'target'> {
  source: ForceGraphNode | string;
  target: ForceGraphNode | string;
}

interface MusicGraphProps {
  data: { nodes: GraphNode[]; links: GraphLink[] };
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  selectedNode?: string | null;
  centerNodeName?: string | null;
}

const genreColors: Record<string, string> = {
  rock: '#FF6B6B',
  pop: '#4ECDC4',
  electronic: '#45B7D1',
  'hip hop': '#FFA07A',
  jazz: '#98D8C8',
  classical: '#F7DC6F',
  metal: '#BB8FCE',
  indie: '#85C1E2',
  folk: '#F8B739',
  blues: '#5DADE2',
  country: '#F1948A',
  alternative: '#58D68D',
  unknown: '#95A5A6',
};

// Lighten a hex color toward white by `strength` (0..1)
const lightenHex = (hex: string, strength = 0.45): string => {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * strength);
  const lg = Math.round(g + (255 - g) * strength);
  const lb = Math.round(b + (255 - b) * strength);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
};


type RFNode = NodeObject<ForceGraphNode>;
type RFLink = LinkObject<ForceGraphNode, ForceGraphLink>;

export default function MusicGraph({
  data,
  onNodeClick,
  onNodeHover,
  selectedNode,
  centerNodeName,
}: MusicGraphProps) {
  // IMPORTANT: use the exact generics react-force-graph-2d expects
  const graphRef = useRef<ForceGraphMethods<RFNode, RFLink> | undefined>(
    undefined
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map()).current;
  const [, forceUpdate] = useState({});
  const [isHoveringAnyNode, setIsHoveringAnyNode] = useState(false);

  // --- Kinetic pan state (inertia) ---
  const kineticRef = useRef<{
    raf: number | null;
    active: boolean;
    vx: number;
    vy: number;
    lastPts: Array<{ x: number; y: number; t: number }>;
  }>({ raf: null, active: false, vx: 0, vy: 0, lastPts: [] });

  const stopKinetic = () => {
    const k = kineticRef.current;
    if (k.raf) cancelAnimationFrame(k.raf);
    k.raf = null;
    k.active = false;
    k.vx = 0;
    k.vy = 0;
    k.lastPts = [];
  };

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (graphRef.current && data.nodes.length > 0) {
      const charge = graphRef.current.d3Force('charge') as
        | { strength: (n: number) => void }
        | undefined;
      charge?.strength(-300);

      const linkForce = graphRef.current.d3Force('link') as
        | { distance: (fn: (l: ForceGraphLink) => number) => void }
        | undefined;
      linkForce?.distance((link) => 50 / (link.value || 1));

      const center = graphRef.current.d3Force('center') as
        | { strength: (n: number) => void }
        | undefined;
      center?.strength(0.05);

      setTimeout(() => graphRef.current?.zoomToFit(400, 50), 500);
    }
  }, [data]);

  useEffect(() => {
    if (!centerNodeName || !graphRef.current) return;
    const t = setTimeout(() => {
      const fg = graphRef.current!;
      const node = data.nodes.find((n) => n.name === centerNodeName) as
        | ForceGraphNode
        | undefined;
      if (!node) return;

      const centerAndZoom = (n: ForceGraphNode) => {
        fg.centerAt((n.x as number) ?? 0, (n.y as number) ?? 0, 1000);
        fg.zoom(2, 1000);
      };

      if (node.x == null || node.y == null) {
        setTimeout(() => {
          const retry = data.nodes.find((n) => n.name === centerNodeName) as
            | ForceGraphNode
            | undefined;
          if (retry && retry.x != null && retry.y != null) centerAndZoom(retry);
        }, 300);
        return;
      }
      centerAndZoom(node);
    }, 150);
    return () => clearTimeout(t);
  }, [centerNodeName, data.nodes]);

  // --- Kinetic pan listeners & fling loop ---
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    // The 2D instance exposes .canvas(), but it isn't typed in defs
    const canvas = (
      fg as unknown as { canvas?: () => HTMLCanvasElement | null }
    ).canvas?.();
    const el: HTMLElement | null = canvas || containerRef.current;
    if (!el) return;

    const k = kineticRef.current;

    const onPointerDown: EventListener = () => {
      stopKinetic();
      k.lastPts = [];
    };

    const onPointerMove: EventListener = (ev: Event) => {
      let x = 0;
      let y = 0;
      const now = performance.now();

      if ('touches' in ev && (ev as TouchEvent).touches.length) {
        const t = (ev as TouchEvent).touches[0];
        x = t.clientX;
        y = t.clientY;
      } else if ('clientX' in (ev as PointerEvent)) {
        const p = ev as PointerEvent;
        x = p.clientX;
        y = p.clientY;
      }

      k.lastPts.push({ x, y, t: now });
      const cutoff = now - 120;
      while (k.lastPts.length && k.lastPts[0].t < cutoff) k.lastPts.shift();
    };

    const onPointerUp: EventListener = () => {
      if (k.lastPts.length < 2 || !graphRef.current) return;

      const a = k.lastPts[0];
      const b = k.lastPts[k.lastPts.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const vxPx = (b.x - a.x) / dt; // px/ms
      const vyPx = (b.y - a.y) / dt; // px/ms

      const speed = Math.hypot(vxPx, vyPx);
      if (speed < 0.05) {
        k.lastPts = [];
        return;
      }

      const screenCenterX = dimensions.width / 2;
      const screenCenterY = dimensions.height / 2;

      const centerA = fg.screen2GraphCoords(screenCenterX, screenCenterY);
      const centerAXp = fg.screen2GraphCoords(
        screenCenterX + 1,
        screenCenterY + 1
      );

      const pxToGraphX = centerAXp.x - centerA.x;
      const pxToGraphY = centerAXp.y - centerA.y;

      k.vx = -vxPx * pxToGraphX; // world moves opposite the drag
      k.vy = -vyPx * pxToGraphY;
      k.active = true;

      let cx = centerA.x;
      let cy = centerA.y;
      let lastTime = performance.now();

      const friction = 0.94; // lower => longer glide
      const stopSpeed = 0.0005;

      const tick = () => {
        if (!k.active) return;

        const now = performance.now();
        const dms = now - lastTime;
        lastTime = now;

        cx += k.vx * dms;
        cy += k.vy * dms;

        fg.centerAt(cx, cy, 0);

        k.vx *= friction;
        k.vy *= friction;

        if (Math.hypot(k.vx, k.vy) < stopSpeed) {
          stopKinetic();
          return;
        }
        k.raf = requestAnimationFrame(tick);
      };

      k.raf = requestAnimationFrame(tick);
      k.lastPts = [];
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    el.addEventListener('touchmove', onPointerMove, { passive: true });
    el.addEventListener('touchend', onPointerUp, { passive: true });
    window.addEventListener('blur', stopKinetic);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove', onPointerMove);
      el.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('blur', stopKinetic);
      stopKinetic();
    };
  }, [dimensions.width, dimensions.height]);

  const getNodeColor = useCallback((node: GraphNode) => {
    const genre = node.group?.toLowerCase() || 'unknown';
    for (const [key, color] of Object.entries(genreColors)) {
      if (genre.includes(key)) return color;
    }
    return genreColors.unknown;
  }, []);

  const nodeCanvasObject = useCallback(
    (
      node: ForceGraphNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const label = node.name;
      const nodeSize = node.size || 10;
      const fontSize = Math.max(12 / globalScale, nodeSize / 3);
      const nodeColor = getNodeColor(node);
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;

      if (isHovered || isSelected || node.depth === 0) {
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = isSelected ? 12 : isHovered ? 6 : 4; // softer shadow
        ctx.fillStyle = nodeColor + '22'; // dimmer halo (alpha ↓)
        ctx.beginPath();
        ctx.arc(x, y, nodeSize * 1.2, 0, 2 * Math.PI); // smaller halo radius
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
      ctx.fill();

      if (
        node.image &&
        node.image.startsWith('http') &&
        (isHovered || node.depth === 0 || globalScale > 1.5)
      ) {
        let img = imageCache.get(node.id);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = node.image;
          imageCache.set(node.id, img);
          img.onload = () => {
            forceUpdate({});
          };
        }
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, nodeSize - 1, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(
            img,
            x - nodeSize,
            y - nodeSize,
            nodeSize * 2,
            nodeSize * 2
          );
          ctx.restore();
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      // Ring uses node color; on hover we brighten it; on select we keep a thicker white ring
      const ringColor = isSelected
        ? '#fff'
        : isHovered
        ? lightenHex(nodeColor, 0.45)
        : nodeColor;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (node.depth === 0 || globalScale > 1) {
        const textY = y + nodeSize + fontSize;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, textY);
      }
    },
    [hoveredNode, selectedNode, getNodeColor, imageCache, forceUpdate]
  );

  const linkCanvasObject = useCallback(
    (link: RFLink, ctx: CanvasRenderingContext2D) => {
      const start = link.source as ForceGraphNode;
      const end = link.target as ForceGraphNode;
      if (!start || !end) return;

      const startX = start.x ?? 0;
      const startY = start.y ?? 0;
      const endX = end.x ?? 0;
      const endY = end.y ?? 0;
      if (
        !Number.isFinite(startX) ||
        !Number.isFinite(startY) ||
        !Number.isFinite(endX) ||
        !Number.isFinite(endY)
      )
        return;

      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, '#0284c733');
      gradient.addColorStop(0.5, '#2563eb33');
      gradient.addColorStop(1, '#4f46e533');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(0.5, ((link.value as number) ?? 1) * 2);
      ctx.globalAlpha = 0.3 + ((link.value as number) ?? 1) * 0.4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      onNodeClick?.(node as GraphNode);
    },
    [onNodeClick]
  );

  const handleNodeHover = useCallback(
    (node: ForceGraphNode | null) => {
      setHoveredNode(node?.id || null);
      setIsHoveringAnyNode(!!node);
      onNodeHover?.(node as GraphNode | null);
    },
    [onNodeHover]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gradient-to-br from-sky-950/10 via-blue-900/10 to-indigo-950/10"
      style={{ cursor: isHoveringAnyNode ? 'pointer' : 'default' }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`,
        }}
      />

      <ForceGraph2D
        ref={graphRef}
        graphData={data as unknown as { nodes: RFNode[]; links: RFLink[] }}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={
          nodeCanvasObject as unknown as (
            node: RFNode,
            ctx: CanvasRenderingContext2D,
            globalScale: number
          ) => void
        }
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick as unknown as (node: RFNode) => void}
        onNodeHover={
          handleNodeHover as unknown as (node?: RFNode | null) => void
        }
        backgroundColor="transparent"
        nodeRelSize={1}
        nodeId="id"
        nodeVal="size"
        linkSource="source"
        linkTarget="target"
        nodePointerAreaPaint={(
          node: RFNode,
          color: string,
          ctx: CanvasRenderingContext2D
        ) => {
          const n = node as unknown as ForceGraphNode;
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const nodeSize = n.size || 10;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, nodeSize * 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        minZoom={0.1}
        maxZoom={5}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
        nodeLabel={() => ''} // disable built-in tooltip
      />
    </div>
  );
}
