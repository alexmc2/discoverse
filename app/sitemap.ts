// app/sitemap.ts
import type { MetadataRoute } from 'next';

// Ensure CF/edge does not cache this route
export const revalidate = 0;

// Keep the sitemap minimal and always fresh with correct Content-Type.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = new URL('https://discoverse.co.uk');
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
  }> = [
    {
      path: '/',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      path: '/about',
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  return staticRoutes.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, base).toString(),
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
