/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
