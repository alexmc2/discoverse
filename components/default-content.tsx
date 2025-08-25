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

const FALLBACK_ARTISTS = [
  'The Beatles',
  'Radiohead',
  'Daft Punk',
  'Taylor Swift',
  'Pink Floyd',
] as const;

export default function DefaultContent({ onSearch }: DefaultContentProps) {
  const [randomArtist, setRandomArtist] = useState<string>('');

  useEffect(() => {
    // Pick a random artist for the button
    const randomIndex = Math.floor(Math.random() * FALLBACK_ARTISTS.length);
    setRandomArtist(FALLBACK_ARTISTS[randomIndex]);
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      {/* keep your original offsets so the text doesn't move */}
      <div className="text-center px-6 -mt-16 sm:-mt-20 md:-mt-68">
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
          {/* Random artist button */}
          {randomArtist && (
            <button
              onClick={() => onSearch(randomArtist)}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 
                         text-white font-semibold rounded-lg
                         hover:from-sky-500 hover:via-blue-500 hover:to-indigo-500
                         transition-all duration-200 transform hover:scale-105 
                         shadow-lg hover:shadow-xl"
            >
              Try {randomArtist}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
