import type { ImageLoaderProps } from 'next/image';

const normalizeSrc = (src: string) =>
  src.startsWith('/') ? src.slice(1) : src;

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
  if (!USE_CF_RESIZE) return src; // plain URL in dev/preview
  const params = [`width=${width}`];
  if (quality) params.push(`quality=${quality}`);
  return `/cdn-cgi/image/${params.join(',')}/${normalizeSrc(src)}`;
}
