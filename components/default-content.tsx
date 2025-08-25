// components/default-content.tsx
'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import of Lottie Player to prevent SSR issues
const Player = dynamic(
  () =>
    import('@lottiefiles/react-lottie-player').then((mod) => ({
      default: mod.Player,
    })),
  { ssr: false }
);

type DefaultContentProps = {
  onSearch: (artistName: string) => void;
};

export default function DefaultContent({ onSearch }: DefaultContentProps) {
  const [randomArtists, setRandomArtists] = useState<string[]>([]);

  useEffect(() => {
    // Fetch random artists from the API
    fetch('/api/random-artists')
      .then((res) => res.json())
      .then((data) => {
        if (data.artists && data.artists.length > 0) {
          setRandomArtists(data.artists);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch random artists:', err);
      });
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      {/* keep your original offsets so the text doesn't move */}
      <div className="text-center sm:px-6 px-4 -mt-12 sm:-mt-20 md:-mt-64">
        {/* original icon slot size (doesn't change layout height) */}
        <div className="relative mx-auto h-32 w-32 sm:h-40 sm:w-40">
          {/* single Lottie, absolutely centered; scales up to 400px */}
          <Player
            autoplay
            loop
            src="/lotties/sound.json"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: 'clamp(300px, 60vw, 400px)',
              height: 'clamp(300px, 60vw, 400px)',
            }}
            aria-label="Soundwaves animation"
          />
        </div>

        <h2 className="text-3xl font-bold text-white mb-4">
          Discover Musical Connections
        </h2>

        <p className="text-gray-400 max-w-md mx-auto mb-8">
          See how artists connect through genres and influences in an
          interactive constellation.
        </p>

        <div className="flex flex-wrap gap-2 justify-center min-h-[44px]">
          {/* Random artist buttons */}
          {randomArtists.map((artist) => (
            <button
              key={artist}
              onClick={() => onSearch(artist)}
              className="cursor-pointer px-4 py-2 bg-gray-800/50 text-gray-300 rounded-full text-sm transition-all duration-300 border border-sky-800 hover:text-white hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
            >
              {artist}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
