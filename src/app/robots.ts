/** --- YAML
 * name: Robots.txt
 * description: Dynamic robots.txt. Allows indexing of public pages, blocks API/superadmin/auth routes.
 * created: 2026-04-24
 * --- */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/superadmin/',
          '/login',
          '/register',
          '/confirm',
          '/consent',
          '/invoice/',
          '/telegram/',
          '/payments/return',
          '/banned',
        ],
      },
      // AI crawlers — explicitly allow (so CRES-CA content can be cited in ChatGPT / Perplexity / AI Overviews)
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
    ],
    sitemap: 'https://cres-ca.com/sitemap.xml',
  };
}
