// next.config.mjs
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

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
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      // Allow Next.js inline hydration and HMR/dev scripts
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://static.cloudflareinsights.com`,
      // Images from self (CF resize) + Spotify + Last.fm + data URIs
      "img-src 'self' https://i.scdn.co https://lastfm.freetls.fastly.net https://lastfm-img2.akamaized.net data:",
      // Audio previews from Spotify and iTunes
      "media-src 'self' https://*.scdn.co https://*.spotifycdn.com https://audio-ssl.itunes.apple.com",
      // App/API calls (fetch/XHR)
      "connect-src 'self' https://ws.audioscrobbler.com https://accounts.spotify.com https://api.spotify.com https://itunes.apple.com https://cloudflareinsights.com",
      // Styles (Tailwind inline)
      "style-src 'self' 'unsafe-inline'",
      // Fonts
      "font-src 'self' data:",
      // Disallow embedding
      "frame-ancestors 'none'",
      // Upgrade any http to https in browsers
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      // Explicit no-cache for metadata routes important for SEO
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
