// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Use Cloudflare Images (custom loader file at project root)
    loader: 'custom',
    loaderFile: './image-loader.ts',

    // Still keep these so dev and any non-CF paths behave nicely
    remotePatterns: [
      // Spotify
      { protocol: 'https', hostname: 'i.scdn.co' },
      // Last.fm (two CDNs commonly used)
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
      { protocol: 'https', hostname: 'lastfm-img2.akamaized.net' },
    ],
  },
};

export default nextConfig;
