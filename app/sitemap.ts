// app/sitemap.ts
import type { MetadataRoute } from 'next';

// Ensure CF/edge does not cache this route
export const revalidate = 0;

// Keep the sitemap minimal and always fresh with correct Content-Type.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = new URL('https://discoverse.co.uk');
  const now = new Date();
  return [
    {
      url: new URL('/', base).toString(),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
