'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Palette } from 'lucide-react';
import { GENRE_COLOR_MAP } from '@/lib/genres';

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
            className="z-50 w-[22rem] rounded-lg bg-gray-900/95 backdrop-blur-md border border-gray-700 p-4 shadow-2xl"
            sideOffset={8}
            align="start"
          >
            <LegendContent />
            <Popover.Arrow className="fill-gray-900/95" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function LegendContent() {
  // Alphabetical order of all genres
  const items = useMemo(() => {
    return Object.entries(GENRE_COLOR_MAP).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, []);

  return (
    <div className="space-y-2">
      <h3 className="mb-1 text-sm font-semibold text-white">Genre Colors</h3>
      <div className="max-h-72 overflow-auto pr-1">
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          {items.map(([genre, color]) => (
            <div key={genre} className="flex items-center gap-2 min-w-0">
              <div
                className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-xs text-gray-300 capitalize truncate">
                {genre}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
