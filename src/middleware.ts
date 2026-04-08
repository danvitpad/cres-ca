import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { locales, defaultLocale } from '@/lib/i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

// Route groups that require authentication
const protectedPatterns = [
  '/calendar', '/clients', '/services', '/finance',
  '/inventory', '/marketing', '/settings',
  '/book', '/history', '/masters', '/map', '/profile',
];

function isProtectedPath(pathname: string): boolean {
  // Strip locale prefix if present
  const segments = pathname.split('/').filter(Boolean);
  const pathWithoutLocale = locales.includes(segments[0] as (typeof locales)[number])
    ? '/' + segments.slice(1).join('/')
    : pathname;
  return protectedPatterns.some((p) => pathWithoutLocale.startsWith(p));
}

export async function middleware(request: NextRequest) {
  // Run intl middleware first (sets locale cookie, rewrites)
  const response = intlMiddleware(request);

  // Only check auth for protected routes
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return response;
  }

  // Create Supabase client in middleware context
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
