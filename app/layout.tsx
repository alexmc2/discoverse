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
  // Hardcode canonical site URL
  metadataBase: new URL('https://discoverse.co.uk'),
  title: 'Discoverse | Music Discovery',
  description:
    'See how artists connect through genres and influences in an interactive star map. Listen to top tracks.',
  keywords:
    'music, artists, visualisation, graph, network, last.fm, music discovery',
  authors: [{ name: 'Discoverse' }],
  openGraph: {
    title: 'Discoverse | Music Discovery',
    description:
      'See how artists connect through genres and influences in an interactive star map. Listen to top tracks.',
    type: 'website',
    siteName: 'Discoverse',
    locale: 'en_GB',
    url: 'https://discoverse.co.uk',
    images: [
      {
        // Use a single dynamic PNG for all platforms (no query params)
        url: '/og.png',
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
    // Point Twitter to the same dynamic PNG
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
  return (
    <html lang="en">
      <body className={`${inter.variable} ${interTight.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
