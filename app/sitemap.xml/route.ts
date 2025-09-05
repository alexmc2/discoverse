// app/sitemap.xml/route.ts
// Serve a minimal, explicit XML sitemap with correct headers.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildXml(): string {
  const base = 'https://discoverse.co.uk';
  const lastmod = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url>\n` +
    `    <loc>${base}/</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n` +
    `    <priority>1.0</priority>\n` +
    `  </url>\n` +
    `</urlset>`;
}

const headers = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function GET() {
  return new Response(buildXml(), { status: 200, headers });
}

export async function HEAD() {
  return new Response(null, { status: 200, headers });
}

