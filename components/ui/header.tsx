'use client';

import { Star } from 'lucide-react';
import SearchBar from '@/components/search-bar';

interface HeaderProps {
  onSearch: (artistName: string) => void;
  isLoading: boolean;
  hasSearched: boolean;
  hasData: boolean;
  onClearData: () => void;
  error: string | null;
  mode: 'map' | 'info'; // kept for future, not used here
  onModeChange: (mode: 'map' | 'info') => void; // kept for future, not used here
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
    <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-4 sm:pt-4 pt-3">
      {/* Left-aligned shared wrapper (controls width for title+button and search) */}
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 sm:pb-2 pb-3 ">
          <div className="sm:w-10 sm:h-10 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600">
            <Star className="sm:w-6 w-5 h-5 sm:h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Sound Stars</h1>
          {hasSearched && hasData && (
            <button
              onClick={onClearData}
              className="cursor-pointer ml-auto px-4 py-2 bg-slate-800 text-gray-200 rounded-md text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-slate-900"
            >
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset Graph</span>
            </button>
          )}
        </div>

        <SearchBar onSearch={onSearch} isLoading={isLoading} />

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}
      </div>
    </header>
  );
}
