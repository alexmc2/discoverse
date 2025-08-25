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
  title: 'Music Map | Explore Artist Connections',
  description:
    'Discover musical connections between artists in an interactive constellation map. Explore how your favorite artists relate through genres and influences.',
  keywords:
    'music, artists, visualization, graph, network, last.fm, music discovery',
  authors: [{ name: 'Music Map' }],
  openGraph: {
    title: 'Music Map | Explore Artist Connections',
    description:
      'Discover musical connections between artists in an interactive constellation map.',
    type: 'website',
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
