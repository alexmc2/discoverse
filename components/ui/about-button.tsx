// components/ui/about-button.tsx
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type AboutButtonProps = {
  className?: string;
  'aria-label'?: string;
};

export default function AboutButton({ className, ...props }: AboutButtonProps) {
  return (
    <Link
      href="/about"
      className={cn(
        'group relative inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900/70 text-white text-sm font-semibold shadow-lg backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/70',
        className
      )}
      {...props}
    >
      <span className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100" />
      <span className="relative z-10 text-base leading-none text-slate-200 font-serif">i</span>
    </Link>
  );
}
