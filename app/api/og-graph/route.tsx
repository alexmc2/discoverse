// app/api/og-graph/route.tsx
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Note: Avoid edge runtime for OpenNext Cloudflare bundle.
// Default to nodejs_compat (Workers) by omitting `runtime = 'edge'`.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'Explore Artist Graphs';

  const size = { width: 1200, height: 1200 } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(900px 900px at 40% 30%, #0ea5e966, transparent 60%), radial-gradient(800px 800px at 70% 70%, #3730a366, transparent 60%), linear-gradient(135deg, #0b1220 0%, #0b1020 100%)',
          color: 'white',
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          position: 'relative',
        }}
      >
        {/* faint grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          <svg width="120" height="120" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="64" height="64" fill="url(#gg)" />
            <g transform="translate(14,14) scale(1.5)" stroke="white" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10v3" />
              <path d="M6 6v11" />
              <path d="M10 3v18" />
              <path d="M14 8v7" />
              <path d="M18 5v13" />
              <path d="M22 10v3" />
            </g>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 80, fontWeight: 800 }}>Discoverse</div>
            <div style={{ fontSize: 32, opacity: 0.9 }}>{title}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
