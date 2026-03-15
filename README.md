# Discoverse

Discover new music through the relationships between your favorite artists. Discoverse is an interactive music discovery app that visualises artist connections in an interactive music map.

Start with an artist you already know, then explore similar artists on a force-directed map. Click on any artist image to open info panel that contains bios and track previews where available. The app is built with Next.js and TypeScript, and uses the Last.fm, Spotify, and iTunes APIs for data.

Live site: `https://discoverse.co.uk`

## Overview

- Next.js 15 application built with React, TypeScript, and Tailwind CSS
- Last.fm provides related artists and core artist metadata
- Spotify provides artist images, profile links, and top tracks
- iTunes is used as a fallback source for track previews
- Deployed to Cloudflare Workers using OpenNext

## Key Functionality

- Explore related artists on a force-directed graph
- Switch between map mode and info mode depending on whether you want to expand the graph or inspect an artist
- Open an artist panel with biography, tags, stats, and preview tracks
- Load seeded artists from a precomputed JSON cache for the default experience
- Cache repeat searches in Cloudflare KV so later lookups are much faster

## Architecture Notes

- [`app/page.tsx`](./app/page.tsx) resolves the initial search state and hydrates the app from either the default artist bootstrap or the shared search cache.
- [`lib/server/artists.ts`](./lib/server/artists.ts) aggregates artist data, loads the seeded cache, and handles server-side bootstrap logic.
- [`app/api/search-cache/route.ts`](./app/api/search-cache/route.ts) stores normalised graph and panel payloads in Cloudflare KV with a fixed TTL.
- [`components/music-map-app.tsx`](./components/music-map-app.tsx) manages the client-side search flow, graph expansion, panel loading, and cache persistence.

## Technical Focus

- Combining multiple third-party APIs into a single user-facing search experience
- Balancing fast default loads with live data for non-seeded searches
- Designing around rate limits, partial failures, and unreliable preview availability
- Keeping cached search results outside the build pipeline through Cloudflare KV

## Testing

- Jest with Next.js test configuration and Testing Library
- Test coverage includes API routes, shared library code, and component behaviour
- Current tests cover areas such as cache routes, Spotify and Last.fm helpers, random artist selection, and the search bar

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Lottie for animations
- Visualisation: `react-force-graph-2d`
- Runtime and deployment: OpenNext, Cloudflare Workers, Cloudflare KV
- Tooling: ESLint, Jest, Testing Library
