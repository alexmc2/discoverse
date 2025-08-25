'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Palette } from 'lucide-react';

// Tailwind v3 500-scale colors
// High-contrast Tailwind mapping (varied weights to avoid lookalikes)
const genreColors: Record<string, string> = {
  rock: '#ef4444',       // red-500
  pop: '#f59e0b',        // amber-500
  electronic: '#84cc16', // lime-500
  'hip hop': '#16a34a',  // green-600 (darker than lime)
  jazz: '#2dd4bf',       // teal-400 (pulled left of cyan for separation)
  classical: '#0284c7',  // sky-600 (darker than teal/cyan family)
  metal: '#3b82f6',      // blue-500
  indie: '#4f46e5',      // indigo-600 (deeper than blue)
  folk: '#7c3aed',       // violet-600
  blues: '#c084fc',      // purple-400 (lighter than violet so they don’t merge)
  country: '#e879f9',    // fuchsia-400
  alternative: '#f43f5e',// rose-500
  unknown: '#71717a',    // zinc-500
};


export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed sm:left-4 left-2 sm:bottom-7 bottom-9 z-40 mb-8">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 backdrop-blur-md px-3 py-1.5 text-sm text-white transition-colors hover:text-white hover:bg-gray-800/50 cursor-pointer"
            aria-label="Show genre color legend"
          >
            <Palette className="h-3.5 w-3.5" />
            Legend
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 w-64 rounded-lg bg-gray-900/95 backdrop-blur-md border border-gray-700 p-4 shadow-2xl"
            sideOffset={8}
            align="start"
          >
            <div className="space-y-1">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Genre Colors
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(genreColors).map(([genre, color]) => (
                  <div key={genre} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-gray-300 capitalize">
                      {genre}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Popover.Arrow className="fill-gray-900/95" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
