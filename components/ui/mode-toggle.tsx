'use client';

import { useId } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

export type Mode = 'map' | 'info';

export default function ModeToggle({
  mode,
  onModeChange,
  className = '',
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  className?: string;
}) {
  const toggleId = useId();

  return (
    <div
      className={`fixed sm:left-4 left-2 sm:bottom-4 bottom-2 z-40 ${className}`}
      role="region"
      aria-label="Mode toggle"
    >
      <TooltipProvider>
        <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden bg-gray-900/60 backdrop-blur-md">
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
              <p>Click artist image to open the info panel</p>
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
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                Map mode
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-900 text-white border border-gray-700">
              <p>Click artist image to map connections</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Mobile-only helper text since tooltips don't work well on touch devices */}
        <div className="mt-1 sm:hidden text-xs leading-snug text-gray-400">
          {mode === 'map' ? (
            <p>Click artist image to map connections</p>
          ) : (
            <p>Click artist image to open the info panel</p>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
