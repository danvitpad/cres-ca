import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    // Modern formats — ~30% smaller than JPEG at same quality
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images at the edge for 30 days
    minimumCacheTTL: 2592000,
    // Trim default breakpoints — miniapp targets mobile, big desktop images unused
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256, 384],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // React Compiler — auto-memoizes components (Next.js 16 stable)
  reactCompiler: true,
  // Cache Components — TODO: enable after Suspense boundaries audit on /consent/[token]
  // and /[locale]/user-flow + similar pages. Requires every uncached data access
  // (cookies, DB queries) to be wrapped in <Suspense>. Plan as separate refactor.
  // cacheComponents: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react', 'motion', 'framer-motion',
      'date-fns', 'recharts', '@phosphor-icons/react',
      '@base-ui/react', 'sonner',
    ],
    // Inline CSS critical path
    optimizeCss: true,
    // Better first-paint scrolling behaviour
    scrollRestoration: true,
  },
  // Static asset cache headers (Vercel edge + browser)
  async headers() {
    return [
      {
        // Fonts served from /public/fonts/* — immutable, cache forever
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public icons
        source: '/:file(.+\\.(?:png|jpg|jpeg|webp|avif|svg|ico))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // Публичные страницы мастеров /m/{handle} — кешируем 60 секунд на edge,
        // плюс SWR на 1 час. Это значит:
        //  - первый клиент после обновления страницы мастера ждёт SSR
        //  - следующие 60 секунд страница отдаётся мгновенно из edge-кеша
        //  - после этого фоном пересобираем (stale-while-revalidate)
        // Изменения мастера видны клиентам в худшем случае через 60 сек —
        // приемлемо для публичной витрины. Для ускорения ощутимо сильно
        // если страница популярна.
        source: '/m/:handle',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
      {
        // То же для салонов
        source: '/s/:id',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
