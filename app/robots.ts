import type { MetadataRoute } from 'next';

/**
 * Crawler rules.
 *
 * robots.txt is a request, not a control: it keeps well-behaved crawlers out
 * of pages that are pointless or private to index, and nothing more. It is NOT
 * a security measure - /client and /admin are protected by middleware, and
 * naming them here only tells a reader where to look. They are listed anyway
 * because the alternative is having authenticated consoles and transactional
 * steps indexed, and the middleware is what actually guards them.
 */

function baseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  return configured || 'https://hostmattic.com';
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Authenticated. Guarded by middleware; excluded here so they are
          // not indexed and served as search results to people who cannot
          // open them.
          '/client/',
          '/admin/',

          // Every API route. None of them is a page, several are
          // authenticated, and an indexed JSON endpoint is only ever noise.
          '/api/',

          // Transactional steps with nothing to index, and which would be
          // meaningless to a visitor arriving cold from a search result.
          '/checkout',
          '/checkout/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
