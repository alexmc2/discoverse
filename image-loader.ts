import type { ImageLoaderProps } from 'next/image';

const normalizeSrc = (src: string) =>
  src.startsWith('/') ? src.slice(1) : src;

// Turn CF resizing on only if explicitly enabled
const USE_CF_RESIZE =
  process.env.NEXT_PUBLIC_USE_CF_RESIZE === '1' &&
  process.env.NODE_ENV === 'production';

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
