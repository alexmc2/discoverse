// app/twitter-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background:
            'radial-gradient(1200px 600px at 20% 20%, #0ea5e980, transparent 60%), radial-gradient(1000px 600px at 80% 80%, #3730a380, transparent 60%), linear-gradient(135deg, #0b1220 0%, #0b1020 100%)',
          color: 'white',
          // top right bottom left to match /og.png
          padding: '48px 88px 48px 56px',
          fontFamily:
            'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: 980 }}>
          <svg
            width="112"
            height="112"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="64" height="64" rx="12" ry="12" fill="url(#g2)" />
            <g
              transform="translate(14,14) scale(1.5)"
              stroke="white"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 10v3" />
              <path d="M6 6v11" />
              <path d="M10 3v18" />
              <path d="M14 8v7" />
              <path d="M18 5v13" />
              <path d="M22 10v3" />
            </g>
          </svg>
          <div
            style={{ display: 'flex', flexDirection: 'column', maxWidth: 800 }}
          >
            <div style={{ fontSize: 64, fontWeight: 800 }}>Discoverse</div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>
              Discover similar artists and listen to top tracks.
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      },
    }
  );
}
