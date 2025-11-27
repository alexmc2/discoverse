// app/layout.tsx
import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const interTight = Inter_Tight({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://discoverse.co.uk'),
  title: 'Discoverse | Interactive Music Discovery Map',
  description:
    'Discoverse is an interactive music discovery app. Explore a visual map of artists, genres and influences, find similar artists, and listen to track previews using data from Last.fm and Spotify.',
  keywords:
    'music discovery app, music similar artists, artist map, interactive music map, last.fm, spotify, music visualisation, music graph, artist network',
  authors: [{ name: 'Discoverse' }],
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'Discoverse | Interactive Music Discovery Map',
    description:
      'Explore an interactive music discovery map that shows how artists connect through genres, influences and shared listeners. Powered by Last.fm and Spotify.',
    type: 'website',
    siteName: 'Discoverse',
    locale: 'en_GB',
    url: 'https://discoverse.co.uk',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Discoverse — interactive music discovery map',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discoverse | Interactive Music Discovery Map',
    description:
      'Interactive music discovery app and artist map with data from Last.fm and Spotify. Explore similar artists and genres on a visual graph.',
    images: ['/og.png'],
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Discoverse',
    url: 'https://discoverse.co.uk',
    description:
      'Interactive music discovery app that visualises artist connections on a map of genres and influences using data from Last.fm and Spotify.',
    applicationCategory: 'MusicApplication',
    operatingSystem: 'Web',
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body className={`${inter.variable} ${interTight.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
