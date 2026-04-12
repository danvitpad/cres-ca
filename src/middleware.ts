import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { locales, defaultLocale } from '@/lib/i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

// Routes that require authentication (any role)
const protectedPatterns = [
  // Dashboard (master/salon)
  '/calendar', '/clients', '/services', '/finance',
  '/inventory', '/marketing', '/settings',
  // Client-only
  '/feed', '/book', '/history', '/my-calendar', '/my-masters',
  '/wallet', '/notifications', '/account-settings', '/profile',
  // Shared
  '/map',
];

function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  return locales.includes(segments[0] as (typeof locales)[number])
    ? '/' + segments.slice(1).join('/')
    : pathname;
}

function isProtectedPath(pathname: string): boolean {
  const p = stripLocale(pathname);
  return protectedPatterns.some((pat) => p === pat || p.startsWith(pat + '/'));
}

export async function middleware(request: NextRequest) {
  // Run intl middleware first (sets locale cookie, rewrites)
  const response = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const strippedPath = stripLocale(pathname);
  const isRoot = strippedPath === '' || strippedPath === '/';
  const isProtected = isProtectedPath(pathname);

  // OAuth fallback: if Supabase dropped a ?code= on the root (because Site URL
  // points at the apex instead of /api/auth/callback), forward to the callback
  // route so the session is exchanged server-side and the user lands on /feed.
  const oauthCode = request.nextUrl.searchParams.get('code');
  if (isRoot && oauthCode) {
    const cb = new URL('/api/auth/callback', request.url);
    cb.searchParams.set('code', oauthCode);
    return NextResponse.redirect(cb);
  }

  // Skip DB calls entirely if not root and not protected
  if (!isRoot && !isProtected) {
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

  // Root: if logged in, route to role-appropriate home
  if (isRoot) {
    if (!user) return response;
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (!profile) return response;
    const target = profile.role === 'client' ? '/feed' : '/calendar';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Protected: require session
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
