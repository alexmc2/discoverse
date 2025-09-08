// app/favicon.png/route.tsx
import { ImageResponse } from 'next/og';

// Serve a PNG favicon that Google Search supports (PNG/ICO, not SVG)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #4f46e5 100%)',
          borderRadius: 12,
        }}
      >
        {/* Simple equalizer bars matching app/icon.svg */}
        <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <g stroke="white" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10v3" />
            <path d="M6 6v11" />
            <path d="M10 3v18" />
            <path d="M14 8v7" />
            <path d="M18 5v13" />
            <path d="M22 10v3" />
          </g>
        </svg>
      </div>
    ),
    {
      width: 64,
      height: 64,
      headers: {
        // Short cache to allow quick updates, but cacheable for browsers/bots
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
}

