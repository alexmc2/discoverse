'use client';

import { Music2 } from 'lucide-react';
import SearchBar from '@/components/search-bar';
import { useId } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface HeaderProps {
  onSearch: (artistName: string) => void;
  isLoading: boolean;
  hasSearched: boolean;
  hasData: boolean;
  onClearData: () => void;
  error: string | null;
  mode: 'map' | 'info';
  onModeChange: (mode: 'map' | 'info') => void;
}

export default function Header({
  onSearch,
  isLoading,
  hasSearched,
  hasData,
  onClearData,
  error,
  mode,
  onModeChange,
}: HeaderProps) {
  const toggleId = useId();

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
        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={onClearData}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm transition-all duration-300 border border-gray-700 hover:text-white hover:bg-gradient-to-r hover:from-sky-900/30 hover:via-blue-900/30 hover:to-indigo-900/30 w-fit cursor-pointer"
          >
            Clear Graph
          </button>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mt-1 ">
            {/* <span className="text-xs text-gray-400">Mode:</span> */}
            <TooltipProvider>
              <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden ">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-pressed={mode === 'info'}
                      onClick={() => onModeChange('info')}
                      className={`px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        mode === 'info'
                          ? 'text-white bg-gray-800'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      Info mode
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-gray-800 text-white border border-gray-700">
                    <p>Clicking the artist image will open the info panel</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      id={toggleId}
                      aria-pressed={mode === 'map'}
                      onClick={() => onModeChange('map')}
                      className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-800 cursor-pointer ${
                        mode === 'map'
                          ? 'text-white bg-gray-900'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      Map mode
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-gray-900 text-white border border-gray-700">
                    <p>
                      Clicking the artist image will map the artist&apos;s
                      connections
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-center">
          {error}
        </div>
      )}
    </header>
  );
}
