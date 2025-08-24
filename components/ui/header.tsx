'use client';

import { Music2 } from 'lucide-react';
import SearchBar from '@/components/search-bar';

interface HeaderProps {
  onSearch: (artistName: string) => void;
  isLoading: boolean;
  hasSearched: boolean;
  hasData: boolean;
  onClearData: () => void;
  error: string | null;
}

export default function Header({
  onSearch,
  isLoading,
  hasSearched,
  hasData,
  onClearData,
  error,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 p-6 sm:pt-6 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600">
          <Music2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Music Map</h1>
        </div>
      </div>

      <SearchBar onSearch={onSearch} isLoading={isLoading} />

      {hasSearched && hasData && (
        <button
          onClick={onClearData}
          className="mt-4 px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30"
        >
          Clear Graph
        </button>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-center">
          {error}
        </div>
      )}
    </header>
  );
}