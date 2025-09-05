// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// 301 redirect www → apex to consolidate canonical host for SEO
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, '');
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|assets|favicon\\.|icon\\.|opengraph-image|twitter-image|robots\\.txt|sitemap\\.xml).*)',
  ],
};
