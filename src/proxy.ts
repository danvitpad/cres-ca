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
  '/today', '/dashboard',
  '/calendar', '/clients', '/services', '/finance',
  '/inventory', '/marketing', '/settings',
  // Client-only
  '/feed', '/book', '/history', '/my-calendar', '/my-masters',
  '/wallet', '/notifications', '/account-settings', '/profile',
  // Shared
  '/map',
  // Onboarding wizard — пускаем только залогиненных, и только тех, кто
  // ещё не завершил онбординг (см. guard ниже в этом файле).
  '/onboarding',
];

// Финальные дашборды по ролям — попадание сюда впервые завершает онбординг
const dashboardPaths = ['/feed', '/calendar', '/today'];

// Onboarding-страницы (защищены, но без onboarding-guard'а — иначе будет цикл)
const onboardingPaths = ['/onboarding'];

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

export async function proxy(request: NextRequest) {
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
            // Принудительно ставим долгий maxAge на auth-cookie, иначе на iOS Safari/
            // Telegram WebView ITP может «подрезать» куки и пользователь незаметно
            // разлогинивается. Daniil: не разлогинивать на мобильном никогда.
            const isAuthCookie = name.startsWith('sb-') || name.includes('auth-token');
            response.cookies.set(name, value, {
              ...options,
              ...(isAuthCookie
                ? {
                    maxAge: 60 * 60 * 24 * 365, // 1 год
                    sameSite: options?.sameSite ?? 'lax',
                    secure: options?.secure ?? true,
                    path: options?.path ?? '/',
                  }
                : {}),
            });
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Blacklist check: if logged-in user is banned, redirect to /banned page (which reads reason
  // via RPC while session is still valid, then signs out client-side). Skip /banned itself to
  // avoid an infinite redirect loop.
  // Uses SECURITY DEFINER RPC because platform_blacklist RLS only grants SELECT to superadmins.
  const isBannedPage = strippedPath === '/banned' || strippedPath.startsWith('/banned/');
  if (user && !isBannedPage) {
    const { data: banned } = await supabase.rpc('is_profile_banned', { p_profile_id: user.id });
    if (banned === true) {
      return NextResponse.redirect(new URL('/banned', request.url));
    }
  }

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

  // Скрытый системный суперадмин (sa@cres-ca.system, без онбординга) —
  // только этот аккаунт автоматически тянем в /superadmin/*. Реальные
  // суперадмины (из SUPERADMIN_EMAILS) — это обычные мастера/клиенты,
  // у них своя нормальная работа, в /superadmin они заходят сами вручную.
  const synthSaEmail = (process.env.SA_INTERNAL_EMAIL ?? 'sa@cres-ca.system').trim().toLowerCase();
  if ((user.email ?? '').trim().toLowerCase() === synthSaEmail) {
    const isSuperadminPath = strippedPath.startsWith('/superadmin');
    if (!isSuperadminPath) {
      return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
    }
    return response;
  }

  // Onboarding gate: если юзер не дошёл до конца онбординга — гоним на нужный шаг.
  // /salon/*/dashboard — там salon_admin финиширует через create-business → редирект напрямую.
  const isOnboardingPath = onboardingPaths.some((p) => strippedPath.startsWith(p));
  const isSalonDashboard = /^\/salon\/[^/]+\/dashboard/.test(strippedPath);
  const { data: nextStep } = await supabase.rpc('get_next_onboarding_step', { p_user_id: user.id });

  if (isOnboardingPath) {
    // Если онбординг уже пройден — на /onboarding/* не пускаем, увозим на нужный
    // дашборд по роли. Это защита от «человек жмёт Назад в браузере и попадает
    // обратно в wizard, который для него закрыт».
    if (!nextStep) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      const target = profile?.role === 'client' ? '/feed' : '/calendar';
      return NextResponse.redirect(new URL(target, request.url));
    }
  } else {
    if (typeof nextStep === 'string' && nextStep && !pathname.endsWith(nextStep)) {
      return NextResponse.redirect(new URL(nextStep, request.url));
    }
    // Юзер впервые пришёл на дашборд (онбординг пройден целиком, но completed_at = NULL).
    // Помечаем — это и есть момент «регистрация завершена».
    if (!nextStep && (dashboardPaths.includes(strippedPath) || isSalonDashboard)) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', user.id)
        .is('onboarding_completed_at', null);
    }
  }

  return response;
}

export const config = {
  // Skip intl handling for: api routes, static assets, telegram mini-app,
  // and root-level pages (outside [locale]): public master (/m/*), /leaderboard,
  // /confirm, /consent, /invoice, /review. These render without locale prefix.
  matcher: [
    '/((?!api|_next|_vercel|telegram|m/|leaderboard|confirm|consent|invoice|review|sa-login|.*\\..*).*)',
  ],
};
