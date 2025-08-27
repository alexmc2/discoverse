// components/default-content.tsx
'use client';

import React from 'react';
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
  randomArtists: string[];
};

export default function DefaultContent({
  onSearch,
  randomArtists,
}: DefaultContentProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center sm:px-6 px-4 -mt-20 sm:-mt-20 md:-mt-64">
        <div className="relative mx-auto h-32 w-32 sm:h-40 sm:w-40">
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
          interactive star map. Listen to top tracks. 
        </p>

        <div className="flex flex-wrap gap-2 justify-center min-h-[44px]">
          {randomArtists.map((artist) => (
            <button
              key={artist}
              onClick={() => onSearch(artist)}
              className="cursor-pointer px-4 py-2 bg-gray-800/50 text-gray-300 rounded-full text-sm transition-all duration-300 border border-sky-900/70 hover:text-white hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
            >
              {artist}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
