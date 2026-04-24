/** --- YAML
 * name: Sitemap
 * description: Dynamic sitemap.xml — static locale pages + every public master /m/[slug].
 *              Masters are fetched from Supabase on each build / ISR revalidation.
 * --- */

import type { MetadataRoute } from 'next';
import { listPublicMasterSlugs } from '@/lib/marketplace/master-by-slug';

const BASE_URL = 'https://cres-ca.com';
const LOCALES = ['uk', 'ru', 'en'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicPages = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/register', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of publicPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries([
            ...LOCALES.map((l) => [l, `${BASE_URL}/${l}${page.path}`]),
            ['x-default', `${BASE_URL}/en${page.path}`],
          ]),
        },
      });
    }
  }

  // Public master profiles (marketplace) — not locale-prefixed, live under /m/[slug]
  try {
    const slugs = await listPublicMasterSlugs(5000);
    for (const { slug, updatedAt } of slugs) {
      entries.push({
        url: `${BASE_URL}/m/${slug}`,
        lastModified: updatedAt ? new Date(updatedAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error('[sitemap] failed to fetch master slugs:', (e as Error).message);
  }

  // /search entry for each locale
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE_URL}/${locale}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  return entries;
}
