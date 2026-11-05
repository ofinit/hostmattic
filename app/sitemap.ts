import type { MetadataRoute } from 'next';

/**
 * The pages a search engine should know about.
 *
 * Only public ones. /client and /admin are behind authentication and must not
 * be listed - a sitemap is a published index, and advertising the location of
 * a console helps nobody but someone probing it. /checkout is excluded as a
 * transactional step with nothing to index.
 */

function baseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  return configured || 'https://hostmattic.com';
}

/** Paths that are genuinely public and worth indexing. */
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/products', priority: 0.9, changeFrequency: 'weekly' },

  { path: '/domains', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/domains/transfer', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/domains/new-gtlds', priority: 0.7, changeFrequency: 'monthly' },

  { path: '/hosting/shared-linux', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/hosting/shared-windows', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/hosting/wordpress', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/hosting/cloud', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/hosting/reseller', priority: 0.7, changeFrequency: 'monthly' },

  { path: '/servers/vps', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/servers/dedicated', priority: 0.7, changeFrequency: 'monthly' },

  { path: '/email/business', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/email/google-workspace', priority: 0.7, changeFrequency: 'monthly' },

  { path: '/security/ssl', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/security/sitelock', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/security/codeguard', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/security/acronis', priority: 0.6, changeFrequency: 'monthly' },

  { path: '/tools/website-builder', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/bundles/combo-plans', priority: 0.7, changeFrequency: 'monthly' },

  // Published policies. These are the pages a customer or a regulator looks
  // for, and the ones the /support/*.php redirects now land on.
  { path: '/contact', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/legal/refunds', priority: 0.4, changeFrequency: 'yearly' },

  // Sign-in and sign-up are linked from every page, so they will be crawled
  // anyway; listing them keeps the index tidy rather than leaving them to be
  // discovered as orphans.
  { path: '/login', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/register', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const lastModified = new Date();

  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
