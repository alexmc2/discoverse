'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
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
  centerNodeName?: string | null; // NEW: explicit center request
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

export default function MusicGraph({
  data,
  onNodeClick,
  onNodeHover,
  selectedNode,
  centerNodeName,
}: MusicGraphProps) {
  const graphRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map()).current;
  const [, forceUpdate] = useState({});
  const [isHoveringAnyNode, setIsHoveringAnyNode] = useState(false);

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (graphRef.current && data.nodes.length > 0) {
      graphRef.current.d3Force('charge').strength(-300);
      graphRef.current
        .d3Force('link')
        .distance((link: any) => 50 / (link.value || 1)); // eslint-disable-line @typescript-eslint/no-explicit-any
      graphRef.current.d3Force('center').strength(0.05);
      setTimeout(() => graphRef.current?.zoomToFit(400, 50), 500);
    }
  }, [data]);

  // Smoothly center on a specific node when requested
  useEffect(() => {
    if (!centerNodeName || !graphRef.current) return;
    const t = setTimeout(() => {
      const fg = graphRef.current;
      const node = data.nodes.find((n) => n.name === centerNodeName) as
        | ForceGraphNode
        | undefined;
      if (!node) return;
      if (node.x == null || node.y == null) {
        setTimeout(() => {
          const retry = data.nodes.find((n) => n.name === centerNodeName) as
            | ForceGraphNode
            | undefined;
          if (retry && retry.x != null && retry.y != null) {
            fg.centerAt(retry.x as number, retry.y as number, 1000);
            fg.zoom(2, 1000);
          }
        }, 300);
        return;
      }
      fg.centerAt(node.x as number, node.y as number, 1000);
      fg.zoom(2, 1000);
    }, 150);
    return () => clearTimeout(t);
  }, [centerNodeName, data.nodes]);

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
        ctx.shadowBlur = isSelected ? 30 : isHovered ? 20 : 15;
        ctx.fillStyle = nodeColor + '44';
        ctx.beginPath();
        ctx.arc(x, y, nodeSize * 1.5, 0, 2 * Math.PI);
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

      if (isHovered || isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
      }

      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isHovered || node.depth === 0 || globalScale > 1) {
        const textY = y + nodeSize + fontSize;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, textY);
      }
    },
    [hoveredNode, selectedNode, getNodeColor, imageCache, forceUpdate]
  );

  const linkCanvasObject = useCallback(
    (link: ForceGraphLink, ctx: CanvasRenderingContext2D) => {
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
      ctx.lineWidth = Math.max(0.5, link.value * 2);
      ctx.globalAlpha = 0.3 + link.value * 0.4;
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
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        backgroundColor="transparent"
        nodeRelSize={1}
        nodeId="id"
        nodeVal="size"
        linkSource="source"
        linkTarget="target"
        nodePointerAreaPaint={(
          node: ForceGraphNode,
          color: string,
          ctx: CanvasRenderingContext2D
        ) => {
          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const nodeSize = node.size || 10;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, nodeSize * 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.1}
        maxZoom={5}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
      />
    </div>
  );
}
