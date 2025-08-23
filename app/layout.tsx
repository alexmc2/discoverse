import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music Map | Explore Artist Connections",
  description: "Discover musical connections between artists in an interactive constellation map. Explore how your favorite artists relate through genres and influences.",
  keywords: "music, artists, visualization, graph, network, last.fm, music discovery",
  authors: [{ name: "Music Map" }],
  openGraph: {
    title: "Music Map | Explore Artist Connections",
    description: "Discover musical connections between artists in an interactive constellation map.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
