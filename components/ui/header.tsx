// components/ui/header.tsx
'use client';

import { LocateFixed, AudioLines } from 'lucide-react';
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
  resetSignal?: number; // used to tell SearchBar to clear & collapse

  // NEW — control the recenter button under the search bar
  showRecenter?: boolean;
  canRecenter?: boolean;
  onRecenter?: () => void;
}

export default function Header({
  onSearch,
  isLoading,
  hasSearched,
  hasData,
  onClearData,
  error,
  resetSignal,
  showRecenter = false,
  canRecenter = false,
  onRecenter,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-4 sm:pt-4 pt-3">
      {/* Left-aligned wrapper controls title, search, and recenter placement */}
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 sm:pb-2 pb-3">
          <div className="sm:w-10 sm:h-10 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600">
            <AudioLines className="sm:w-6 w-5 h-5 sm:h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            <span className="text-white font-bold">Discover</span>
            <span className="text-white font-light">se</span>
          </h1>

          {/* Right side of title row */}
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile: recenter aligned with title */}
            {showRecenter && (
              <button
                onClick={onRecenter}
                disabled={!canRecenter}
                aria-label="Re-centre on current artist"
                title="Re-centre on current artist"
                className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 text-white shadow-md hover:brightness-110 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LocateFixed className="h-4 w-4" />
                <span className="sr-only">Re-centre on current artist</span>
              </button>
            )}

            {/* Desktop: keep reset button in title row */}
            {hasSearched && hasData && (
              <button
                onClick={onClearData}
                className="hidden sm:inline-flex cursor-pointer px-4 py-2 bg-slate-800 text-gray-200 rounded-md text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-slate-900"
              >
                Reset Graph
              </button>
            )}
          </div>
        </div>

        {/* Search + mobile reset (mobile only shows the inline reset) */}
        <div className="flex items-center gap-2 sm:block">
          <div className="flex-1">
            <SearchBar
              onSearch={onSearch}
              isLoading={isLoading}
              resetSignal={resetSignal}
            />
          </div>
          {hasSearched && hasData && (
            <button
              onClick={onClearData}
              className="sm:hidden h-10 px-3 bg-slate-800 text-gray-200 rounded-md text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-slate-900 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Desktop: Recenter at top-right of the screen with gradient styling */}
      {showRecenter && (
        <div className="hidden sm:flex absolute right-3 sm:right-4 top-3 sm:top-4">
          <button
            onClick={onRecenter}
            disabled={!canRecenter}
            aria-label="Re-centre on current artist"
            title="Re-centre on current artist"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 text-white shadow-md hover:brightness-110 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LocateFixed className="h-5 w-5" />
            <span className="sr-only">Re-centre on current artist</span>
          </button>
        </div>
      )}
    </header>
  );
}
