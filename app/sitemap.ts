// app/sitemap.ts
import type { MetadataRoute } from 'next';

// Hardcode canonical domain for production sitemap
const BASE = 'https://discoverse.co.uk';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
