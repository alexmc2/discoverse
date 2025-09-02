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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://discoverse.co.uk'
  ),
  title: 'Discoverse | Music Discovery',
  description:
    'See how artists connect through genres and influences in an interactive star map. Listen to top tracks.',
  keywords:
    'music, artists, visualisation, graph, network, last.fm, music discovery',
  authors: [{ name: 'Music Map' }],
  openGraph: {
    title: 'Discoverse | Music Discovery',
    description:
      'See how artists connect through genres and influences in an interactive star map. Listen to top tracks.',
    type: 'website',
    siteName: 'Discoverse',
    locale: 'en_GB',
    images: [
      {
        url: '/opengraph-image?v=1',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Discoverse — Music Discovery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discoverse | Music Discovery',
    description:
      'See how artists connect through genres and influences in an interactive star map. Listen to top tracks.',
    images: ['/twitter-image?v=1'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${interTight.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
