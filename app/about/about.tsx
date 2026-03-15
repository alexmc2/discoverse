// app/about/about-content.tsx
'use client';

import dynamic from 'next/dynamic';

const Player = dynamic(
  () =>
    import('@lottiefiles/react-lottie-player').then((mod) => ({
      default: mod.Player,
    })),
  { ssr: false }
);

export function AboutContent() {
  return (
    <div className="max-w-3xl w-full text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold text-slate-100 mb-6">
        About Discoverse
      </h1>

      <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-slate-400 mb-6">
        Interactive music discovery map
      </p>

      <p className="mb-4 text-base sm:text-lg text-slate-300/90">
        Discoverse is an interactive music discovery platform that visualises
        artist connections in an explorable music map. Discover new music
        through the relationships between your favorite artists.
      </p>

      <p className="mb-4 text-base sm:text-lg text-slate-300/90">
        Start with an artist you already know, then explore similar artists on a
        force-directed map. Click on any artist image to open info panel that
        contains bios and track previews where available. The app is built
        with Next.js and TypeScript, and uses the Last.fm, Spotify, and iTunes
        APIs for data.
      </p>
      <p className="text-base sm:text-lg text-slate-300/90">
        I&apos;m Alex McGarry, a full-stack developer focused on Next.js, React,
        TypeScript, and PostgreSQL. I&apos;m currently open to frontend,
        backend, or full-stack roles, and Discoverse is a good example of the
        kind of interactive, user-focused products I enjoy building. Visit{' '}
        <a
          href="https://amcgarry.co.uk"
          target="_blank"
          rel="noopener"
          className="text-sky-400 hover:text-sky-500"
        >
          amcgarry.co.uk
        </a>{' '}
        to see more of my work and get in touch.
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

      <p className="text-xs text-slate-500 mt-4">
        Landing page image: &quot;Daft Punk in 2013&quot; by Sony Music
        Entertainment{' '}
        <a
          href="https://commons.wikimedia.org/w/index.php?curid=144852275"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-sky-400 underline underline-offset-2"
        >
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}
