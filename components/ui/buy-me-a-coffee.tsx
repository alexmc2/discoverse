// components/ui/buy-me-a-coffee.tsx
'use client';

import { Coffee } from 'lucide-react';

export default function BuyMeACoffee({
  panelOpen = false,
}: {
  panelOpen?: boolean;
}) {
  // Public URL can be customized via env at build time
  const href =
    process.env.NEXT_PUBLIC_BMAC_URL || 'https://buymeacoffee.com/alexmc2';

  // Hide on small screens when the right-side panel is open to avoid overlap.
  // Keep visible on sm+ (panel doesn't cover the entire screen there).
  const hiddenOnMobile = panelOpen ? 'hidden sm:block' : '';

  return (
    <div
      className={`fixed z-40 right-3 sm:right-4 bottom-3 sm:bottom-4 ${hiddenOnMobile}`}
      role="complementary"
      aria-label="Support the project"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer inline-flex items-center gap-2 sm:gap-1.5 rounded-full border border-indigo-400/30 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/30 hover:brightness-110 active:brightness-95 transition-all px-3 py-2 sm:px-2.5 sm:py-1.5 sm:text-xs"
      >
        <Coffee className="w-5 h-5 sm:w-4 sm:h-4" aria-hidden="true" />
        <span className="text-sm font-semibold hidden sm:inline">
          Buy me a coffee
        </span>
      </a>
    </div>
  );
}
