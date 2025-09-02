// app/robots.ts
import type { MetadataRoute } from 'next';

// Hardcode canonical domain for production robots
const BASE = 'https://discoverse.co.uk';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
