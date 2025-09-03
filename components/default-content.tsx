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
              className="group relative h-9 px-4 rounded-md text-sm  bg-slate-800 text-gray-300 cursor-pointer overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span>
              <span className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white">
                {artist}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
