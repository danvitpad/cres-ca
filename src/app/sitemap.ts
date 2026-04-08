/** --- YAML
 * name: Sitemap
 * description: Dynamic sitemap.xml generation for SEO — lists all public pages per locale
 * --- */

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://cres-ca.com';
const LOCALES = ['uk', 'ru', 'en'];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/masters', '/map'];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: page === '' ? 1.0 : 0.7,
      });
    }
  }

  return entries;
}
