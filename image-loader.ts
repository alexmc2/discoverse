// image-loader.ts
import type { ImageLoaderProps } from 'next/image';

const normalizeSrc = (src: string) =>
  src.startsWith('/') ? src.slice(1) : src;

function isAbsoluteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

function withSizingParams(src: string, width: number, quality?: number): string {
  if (/^data:/i.test(src)) return src;

  const qPart = quality ? `&q=${quality}` : '';

  if (isAbsoluteUrl(src)) {
    try {
      const url = new URL(src);
      url.searchParams.set('w', String(width));
      if (quality) url.searchParams.set('q', String(quality));
      return url.toString();
    } catch {
      return `${src}${src.includes('?') ? '&' : '?'}w=${width}${qPart}`;
    }
  }

  const hashIndex = src.indexOf('#');
  const path = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : '';
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}w=${width}${qPart}${hash}`;
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
  // If CF resizing is disabled or src is already absolute, request
  // the image directly but include width/quality so Next's loader
  // contract is satisfied.
  if (!USE_CF_RESIZE || isAbsoluteUrl(src)) {
    return withSizingParams(src, width, quality);
  }

  const params = [`width=${width}`];
  if (quality) params.push(`quality=${quality}`);
  return `/cdn-cgi/image/${params.join(',')}/${normalizeSrc(src)}`;
}
