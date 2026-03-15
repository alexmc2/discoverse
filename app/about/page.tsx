// app/about/page.tsx
import type { Metadata } from 'next';
import { AboutContent } from './about';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Discoverse | Interactive music discovery map',
  description:
    'Learn more about Discoverse, an interactive music discovery app that visualises artist connections using data from Last.fm and Spotify.',
};

export default function AboutPage() {
  return (
    <main className="h-screen overflow-y-auto sm:overflow-hidden bg-gradient-to-br from-sky-950/10 via-blue-900/10 to-indigo-950/10">
      <div className='p-4'>
        <Link
          href="/"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/20 bg-slate-900/70 px-4 py-1.5 text-sm font-medium text-slate-100 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/70"
          aria-label="Back to the music map"
        >
          <span className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100" />
          <span className="relative z-10 inline-flex items-center gap-2 text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back
          </span>
        </Link>
      </div>
      <div className="flex items-center justify-center px-4 py-8 sm:min-h-[calc(100vh-60px)]">
        <AboutContent />
      </div>
    </main>
  );
}
