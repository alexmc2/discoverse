# 🎵 Discoverse - Interactive Music Discovery Platform

Discoverse is an interactive music discovery platform that visualises artist connections in an explorable star map. Discover new music through the relationships between your favorite artists using data from Last.fm and Spotify.

![Discoverse Demo](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

## ✨ Features

### 🎯 Interactive Music Graph

- **Dynamic Force Graph**: Explore artist connections with a physics-based visualization
- **Two Interaction Modes**:
  - 🗺️ **Map Mode**: Click nodes to expand and discover new connections
  - ℹ️ **Info Mode**: Click nodes to view detailed artist information
- **Smart Graph Building**: Multi-depth exploration with intelligent connection filtering
- **Visual Clustering**: Artists grouped by genre with color-coded nodes

### 🎵 Rich Music Data

- **Artist Information**: Comprehensive profiles with bio, stats, and genre tags
- **Track Previews**: 30-second audio previews from Spotify with iTunes fallback
- **High-Quality Images**: Artist photos from Spotify API
- **Real-time Search**: Instant artist search with smart filtering
- **Smart Recommendations**: Curated random artist suggestions for discovery

### 🎨 Beautiful Interface

- **Glassmorphism Design**: Modern, translucent UI elements
- **Responsive Layout**: Optimized for desktop and mobile devices
- **Smooth Animations**: Framer Motion powered transitions
- **Loading States**: Elegant loading animations with Lottie
- **Accessibility First**: Full keyboard navigation and screen reader support

### ⚡ Performance Optimized

- **Server-Side Rendering**: Next.js 15 App Router with React Server Components
- **Smart Caching**: Intelligent data caching with revalidation strategies
- **Image Optimization**: Next.js Image component with remote pattern matching
- **Code Splitting**: Dynamic imports for optimal bundle sizes
- **Turbopack**: Lightning-fast development builds

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- npm, yarn, pnpm, or bun package manager
- Last.fm API key (free)
- Spotify API credentials (optional but recommended)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/sound-stars.git
cd sound-stars
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# Required: Last.fm API Key
NEXT_PUBLIC_LASTFM_API_KEY=your_lastfm_api_key_here

# Optional: Spotify API Credentials (for enhanced features)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Optional: Production site URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

**Getting API Keys:**

- **Last.fm API**: Sign up at [Last.fm API](https://www.last.fm/api/account/create) (free)
- **Spotify API**: Create an app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (free)

4. **Start the development server**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 🏗️ Project Structure

```
sound-stars/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API routes
│   │   ├── lastfm/              # Last.fm proxy endpoints
│   │   ├── random-artists/      # Random artist suggestions
│   │   └── spotify/token/       # Spotify authentication
│   ├── globals.css              # Global styles and CSS variables
│   ├── layout.tsx               # Root layout with metadata
│   ├── loading.tsx              # Global loading component
│   └── page.tsx                 # Home page with SSR data fetching
├── components/                   # React components
│   ├── ui/                      # Reusable UI components
│   │   ├── header.tsx           # Navigation header
│   │   ├── legend.tsx           # Graph legend
│   │   ├── mode-toggle.tsx      # Interaction mode toggle
│   │   └── ...                  # More UI components
│   ├── artist-panel.tsx         # Artist detail sidebar
│   ├── default-content.tsx      # Landing page content
│   ├── loading-screen.tsx       # Loading overlay
│   ├── music-graph.tsx          # Force graph visualization
│   ├── music-map-app.tsx        # Main app component
│   └── search-bar.tsx           # Artist search input
├── lib/                         # Utility libraries and API clients
│   ├── server/                  # Server-only utilities
│   │   └── artists.ts           # Server-side data fetching
│   ├── genres.ts                # Genre classification
│   ├── lastfm.ts               # Last.fm API client
│   ├── spotify.ts              # Spotify API client
│   └── utils.ts                # Utility functions
├── public/                      # Static assets
│   └── lotties/                # Lottie animation files
├── components.json              # shadcn/ui configuration
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## 🔧 Configuration

### API Configuration

The app supports flexible API configuration:

- **Last.fm**: Required for artist data and connections
- **Spotify**: Optional, enhances with high-quality images and audio previews
- **iTunes**: Automatic fallback for audio previews when Spotify unavailable

### Image Optimization

Configured remote image patterns in `next.config.ts`:

- Last.fm CDN domains
- Spotify image CDN
- Automatic optimization and caching

### Environment Variables

| Variable                     | Required | Description                           |
| ---------------------------- | -------- | ------------------------------------- |
| `NEXT_PUBLIC_LASTFM_API_KEY` | Yes      | Last.fm API key for artist data       |
| `SPOTIFY_CLIENT_ID`          | No       | Spotify app client ID                 |
| `SPOTIFY_CLIENT_SECRET`      | No       | Spotify app client secret             |
| `NEXT_PUBLIC_SITE_URL`       | No       | Production site URL for absolute URLs |

## 🎯 Usage

### Basic Usage

1. **Search for an artist** using the search bar
2. **Explore connections** by clicking nodes in Map mode
3. **View artist details** by switching to Info mode and clicking nodes
4. **Listen to previews** in the artist panel
5. **Reset the graph** to start fresh exploration

### Advanced Features

- **Genre-based filtering**: Nodes are colored by primary genre
- **Connection strength**: Link thickness represents similarity strength
- **Node sizing**: Size indicates artist popularity and connections
- **Multi-depth expansion**: Discover artists up to 2 degrees of separation
- **Smart caching**: Previous searches are cached for faster navigation

## 🔨 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run dev:turbo    # Alternative Turbopack command

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking (if configured)
```

### Technology Stack

**Core Framework:**

- [Next.js 15](https://nextjs.org/) - React framework with App Router
- [React 19](https://react.dev/) - UI library with Server Components
- [TypeScript](https://www.typescriptlang.org/) - Type safety

**Styling & UI:**

- [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Radix UI](https://radix-ui.com/) - Headless UI primitives
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Lottie React](https://lottiefiles.com/web-player) - Lottie animations

**Data Visualization:**

- [react-force-graph-2d](https://github.com/vasturiano/react-force-graph-2d) - Interactive force-directed graphs
- [D3.js](https://d3js.org/) (via force-graph) - Data-driven visualizations

**APIs & Data:**

- [Last.fm API](https://www.last.fm/api) - Music metadata and artist connections
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) - High-quality images and audio
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) - Audio preview fallback

**Development Tools:**

- [ESLint 9](https://eslint.org/) - JavaScript/TypeScript linting
- [Turbopack](https://turbo.build/pack) - Fast bundler for development

### Code Organization

- **Server Components**: Used by default for better performance
- **Client Components**: Only when interactivity is required (`'use client'`)
- **API Routes**: Server-side endpoints for external API integration
- **Type Safety**: Comprehensive TypeScript types for all data structures
- **Component Architecture**: Modular, reusable components with shadcn/ui patterns

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - automatic builds on push

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Other Platforms

The app supports deployment on any Node.js hosting platform:

- **Netlify**: Configure build command and environment variables
- **Railway**: Connect repository and set environment variables
- **DigitalOcean App Platform**: Use the Node.js app template
- **Self-hosted**: Use `npm run build && npm run start`

### Environment Setup for Production

Ensure these environment variables are set:

```env
NEXT_PUBLIC_LASTFM_API_KEY=your_key
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Setup for Development

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the installation steps above
4. Make your changes
5. Run tests and linting: `npm run lint`
6. Commit your changes: `git commit -m 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Open a Pull Request

### Contribution Guidelines

- **Code Style**: Follow existing TypeScript and React patterns
- **Components**: Use shadcn/ui patterns for new UI components
- **Accessibility**: Ensure all components are keyboard and screen reader accessible
- **Performance**: Consider Server vs Client components for optimal performance
- **Type Safety**: Add comprehensive TypeScript types for new features

### Areas for Contribution

- 🎨 **UI/UX Improvements**: Better animations, responsive design
- 🎵 **Music Features**: Additional streaming service integrations
- 📊 **Visualizations**: New graph layouts, filtering options
- 🔍 **Search**: Enhanced search capabilities and suggestions
- 🚀 **Performance**: Optimization and caching improvements
- 🧪 **Testing**: Unit tests, integration tests, accessibility tests

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Last.fm** for providing comprehensive music data and artist connections
- **Spotify** for high-quality artist images and audio previews
- **shadcn/ui** for the beautiful component library and design system
- **Radix UI** for accessible headless components
- **The React community** for incredible tools and libraries

## 📞 Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/your-username/sound-stars/issues)
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/your-username/sound-stars/discussions)
- **Documentation**: Check the [Wiki](https://github.com/your-username/sound-stars/wiki) for detailed guides

---

**Built with ❤️ by [Your Name](https://github.com/your-username)**

_Discover music like never before with Discoverse_ ⭐
