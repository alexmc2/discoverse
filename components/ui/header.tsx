// components/ui/header.tsx
'use client';

import { LocateFixed, AudioLines } from 'lucide-react';
import SearchBar from '@/components/search-bar';
import AboutButton from '@/components/ui/about-button';

interface HeaderProps {
  onSearch: (artistName: string) => void;
  isLoading: boolean;
  hasSearched: boolean;
  hasData: boolean;
  onClearData: () => void;
  error: string | null;
  mode: 'map' | 'info'; 
  onModeChange: (mode: 'map' | 'info') => void; 
  resetSignal?: number; // used to tell SearchBar to clear & collapse

  // control the recenter button under the search bar
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
      <div className="w-full sm:max-w-sm max-w-screen">
        <div className="flex items-center gap-2 sm:pb-3 pb-2">
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

            {/* Desktop reset moved next to search below */}
          </div>
        </div>

        {/* Search + reset
           - Mobile: Reset sits to the right of the input
           - Desktop: Reset Graph sits below the input */}
        <div className="sm:block">
          <div className="flex items-center gap-2">
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
                className="sm:hidden h-9 px-3 bg-slate-800 text-gray-200 rounded-md text-sm transition-all duration-300  hover:text-white hover:bg-slate-900 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {hasSearched && hasData && (
            <div className="hidden sm:block mt-3">
              <button
                onClick={onClearData}
                className="group relative h-9 px-4 rounded-md text-sm  bg-slate-800 text-gray-300 cursor-pointer overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span>
                <span className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white">
                  Reset Graph
                </span>
              </button>
            </div>
          )}
        </div>

        {/* About button */}
        <div className="hidden sm:flex mt-3">
          <AboutButton
            aria-label="Learn more about Discoverse"
            className="self-start"
          />
        </div>

        <div className="sm:hidden mt-3">
          <AboutButton aria-label="Learn more about Discoverse" />
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
