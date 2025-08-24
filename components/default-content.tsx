'use client';

import { Music2 } from 'lucide-react';

interface DefaultContentProps {
  onSearch: (artistName: string) => void;
}

export default function DefaultContent({ onSearch }: DefaultContentProps) {
  const suggestedArtists = [
    'The Beatles',
    'Radiohead',
    'Kendrick Lamar',
    'Taylor Swift',
    'Pink Floyd',
  ];

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center px-6 -mt-16 sm:-mt-20 md:-mt-24">
        <div className="w-32 h-32 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-50 animate-pulse-glow bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600" />
          <div className="relative w-full h-full rounded-full flex items-center justify-center bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600">
            <Music2 className="w-16 h-16 text-white" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-4">
          Discover Musical Connections
        </h2>
        <p className="text-gray-400 max-w-md mx-auto mb-8">
          See how artists connect through genres and influences in an
          interactive constellation.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          {suggestedArtists.map((artist) => (
            <button
              key={artist}
              onClick={() => onSearch(artist)}
              className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-full text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
            >
              {artist}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
