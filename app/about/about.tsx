// app/about/about-content.tsx
'use client';

import dynamic from 'next/dynamic';

// Reuse the same Lottie setup as the homepage
const Player = dynamic(
  () =>
    import('@lottiefiles/react-lottie-player').then((mod) => ({
      default: mod.Player,
    })),
  { ssr: false }
);

export function AboutContent() {
  return (
    <div className="max-w-5xl w-full text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold text-slate-100 mb-4">
        About Discoverse
      </h1>

      <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-slate-400 mb-6">
        Interactive music discovery map
      </p>

      <p className="mb-4 text-base sm:text-lg text-slate-300/90">
        Discoverse is an interactive music discovery platform that visualises
        artist connections in an explorable star map. Discover new music through
        the relationships between your favorite artists using data from Last.fm
        and Spotify.
      </p>

      <p className="mb-4 text-sm sm:text-lg text-slate-300/90">
        Start with an artist you already know, then explore similar artists on a
        force-directed map. Click on any artist image to open info panel that
        contains bios, tags and track previews where available. The app is built
        with Next.js and TypeScript, leveraging the Last.fm and Spotify APIs for
        data.
      </p>
      <p className=" text-sm sm:text-lg text-slate-300/90">
        Are you looking for a Next.js developer to build your next web
        application? I&apos;m currently available for freelance projects. Visit
        my website at{' '}
        <a
          href="https://amcgarry.co.uk"
          target="_blank"
          rel="noopener"
          className="text-sky-400 hover:text-sky-500"
        >
          amcgarry.co.uk{' '}
        </a>
        to see my portfolio and get in touch.
      </p>
      <div className="relative mx-auto h-32 w-32 sm:h-40 sm:w-40 mb-6">
        <Player
          autoplay
          loop
          src="/lotties/sound.json"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 'clamp(220px, 50vw, 320px)',
            height: 'clamp(220px, 50vw, 320px)',
          }}
          aria-label="Soundwaves animation"
        />
      </div>
    </div>
  );
}
