import type { ImageLoaderProps } from 'next/image';

const normalizeSrc = (src: string) =>
  src.startsWith('/') ? src.slice(1) : src;

function isAbsoluteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

// Turn CF resizing on only if explicitly enabled and supported by the host.
// workers.dev does not support the "/cdn-cgi/image" endpoint for remote origins.
const BASE_USE_CF =
  process.env.NEXT_PUBLIC_USE_CF_RESIZE === '1' &&
  process.env.NODE_ENV === 'production';

function isWorkersDevHost(): boolean {
  try {
    if (typeof window !== 'undefined') {
      return /\.workers\.dev$/i.test(window.location.hostname);
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || '';
    return /\.workers\.dev/i.test(site);
  } catch {
    return false;
  }
}

const USE_CF_RESIZE = BASE_USE_CF && !isWorkersDevHost();

export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  // If CF resizing is disabled or the src is a remote absolute URL,
  // return the original source. Many third‑party hosts (e.g., Spotify)
  // work better when requested directly rather than proxied via
  // /cdn-cgi/image unless the zone explicitly enables Remote Fetching.
  if (!USE_CF_RESIZE || isAbsoluteUrl(src)) return src;
  const params = [`width=${width}`];
  if (quality) params.push(`quality=${quality}`);
  return `/cdn-cgi/image/${params.join(',')}/${normalizeSrc(src)}`;
}
