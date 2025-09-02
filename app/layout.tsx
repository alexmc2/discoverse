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
  title: 'Discoverse | Explore Artist Connections',
  description:
    'Discover musical connections between artists in an interactive star map. Explore how your favorite artists relate through genres and influences.',
  keywords:
    'music, artists, visualisation, graph, network, last.fm, music discovery',
  authors: [{ name: 'Music Map' }],
  openGraph: {
    title: 'Discoverse | Explore Artist Connections',
    description:
      'Discover musical connections between artists in an interactive star map.',
    type: 'website',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discoverse | Explore Artist Connections',
    description:
      'See how artists connect through genres and influences in an interactive star map.',
    images: ['/twitter-image'],
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
