// app/robots.ts
import type { MetadataRoute } from 'next';

// Always fresh; avoid CF caching surprises
export const revalidate = 0;

export default function robots(): MetadataRoute.Robots {
  const base = 'https://discoverse.co.uk';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
