'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphNode, GraphLink } from '@/lib/lastfm';

interface MusicGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  selectedNode?: string | null;
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
  unknown: '#95A5A6'
};

export default function MusicGraph({ data, onNodeClick, onNodeHover, selectedNode }: MusicGraphProps) {
  const graphRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 120
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (graphRef.current && data.nodes.length > 0) {
      graphRef.current.d3Force('charge').strength(-300);
      graphRef.current.d3Force('link').distance((link: any) => 50 / (link.value || 1)); // eslint-disable-line @typescript-eslint/no-explicit-any
      graphRef.current.d3Force('center').strength(0.05);
      
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [data]);

  const getNodeColor = useCallback((node: GraphNode) => {
    const genre = node.group?.toLowerCase() || 'unknown';
    
    for (const [key, color] of Object.entries(genreColors)) {
      if (genre.includes(key)) return color;
    }
    
    return genreColors.unknown;
  }, []);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const label = node.name;
    const nodeSize = node.size || 10;
    const fontSize = Math.max(12 / globalScale, nodeSize / 3);
    const nodeColor = getNodeColor(node);
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    
    // Draw glow effect
    if (isHovered || isSelected || node.depth === 0) {
      ctx.shadowColor = nodeColor;
      ctx.shadowBlur = isSelected ? 30 : isHovered ? 20 : 15;
      ctx.fillStyle = nodeColor + '44';
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize * 1.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    // Draw node
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw border for selected/hovered
    if (isHovered || isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    }
    
    // Draw label
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text background for readability
    if (isHovered || node.depth === 0 || globalScale > 1) {
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        node.x - textWidth / 2 - 2,
        node.y + nodeSize + 3,
        textWidth + 4,
        fontSize + 4
      );
      
      ctx.fillStyle = '#fff';
      ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
    }
  }, [hoveredNode, selectedNode, getNodeColor]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const start = link.source;
    const end = link.target;
    
    if (!start || !end) return;
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || 
        !Number.isFinite(end.x) || !Number.isFinite(end.y)) return;
    
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const startColor = getNodeColor(start);
    const endColor = getNodeColor(end);
    
    gradient.addColorStop(0, startColor + '33');
    gradient.addColorStop(1, endColor + '33');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(0.5, link.value * 2);
    ctx.globalAlpha = 0.3 + link.value * 0.4;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
  }, [getNodeColor]);

  const handleNodeClick = useCallback((node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (onNodeClick) {
      onNodeClick(node as GraphNode);
    }
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setHoveredNode(node?.id || null);
    if (onNodeHover) {
      onNodeHover(node as GraphNode | null);
    }
  }, [onNodeHover]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`
      }} />
      
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
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.1}
        maxZoom={5}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
      />
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white/70 text-sm">
        <div>Scroll to zoom • Drag to pan • Click artist to explore</div>
      </div>
    </div>
  );
}