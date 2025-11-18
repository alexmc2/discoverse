// app/sitemap.ts
import { POPULAR_ARTISTS_POOL } from '@/lib/popular-artists';
import type { MetadataRoute } from 'next';

// Ensure CF/edge does not cache this route
export const revalidate = 0;

const POPULAR_SEARCH_SITEMAP_LIMIT = 50; // keep sitemap lean with a capped query list

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

  const popularSearchRoutes: MetadataRoute.Sitemap = Array.from(
    new Set(POPULAR_ARTISTS_POOL),
  )
    .slice(0, POPULAR_SEARCH_SITEMAP_LIMIT)
    .map((artist) => {
      const searchUrl = new URL('/', base);
      searchUrl.searchParams.set('q', artist);
      return {
        url: searchUrl.toString(),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      };
    });

  return [
    ...staticRoutes.map(({ path, changeFrequency, priority }) => ({
      url: new URL(path, base).toString(),
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...popularSearchRoutes,
  ];
}
