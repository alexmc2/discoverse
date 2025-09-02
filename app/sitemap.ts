// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://discoverse.co.uk';
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

