/** --- YAML
 * name: Sitemap
 * description: Dynamic sitemap.xml generation for SEO — lists all public pages per locale
 * --- */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://cres-ca.com';
const LOCALES = ['uk', 'ru', 'en'];

export default function sitemap(): MetadataRoute.Sitemap {
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

  return entries;
}
