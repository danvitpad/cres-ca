/** --- YAML
 * name: Auth Callback
 * description: OAuth + email-link return-to. Exchanges Supabase code for session,
 *              создаёт / обновляет profiles row, корректно обрабатывает signin vs
 *              signup для Google OAuth.
 *
 * Особенности Google-флоу:
 *   - DB-trigger handle_new_user() создаёт profiles row при первом INSERT в
 *     auth.users — но не знает выбранную роль (Google не передаёт metadata).
 *     Поэтому он всегда ставит role='client'. Мы ПЕРЕЗАПИСЫВАЕМ role здесь
 *     если в URL прилетел ?role=master|salon_admin.
 *   - Если режим mode=signin и пользователь только что зарегистрировался
 *     (created_at < 60 сек) — это значит «такого аккаунта не было». Удаляем
 *     auth.users + profile через service-role и редиректим на /login с ошибкой.
 *
 * updated: 2026-04-27
 * --- */

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type Role = 'client' | 'master' | 'salon_admin';

function isRole(r: string | null | undefined): r is Role {
  return r === 'client' || r === 'master' || r === 'salon_admin';
}

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  // Сначала читаем намерение пользователя из cookie (надёжно — куки идут через
  // весь OAuth-цикл независимо от URL-параметров, которые могут потеряться).
  // Fallback на URL-параметры если кука не выставлена (старая версия JS).
  const cookieStore = await cookies();
  const intentCookie = cookieStore.get('cres_oauth_intent')?.value;
  let cookieRole: Role | null = null;
  let cookieMode: 'signin' | 'signup' | null = null;
  if (intentCookie) {
    try {
      const parsed = JSON.parse(intentCookie) as { role?: string; mode?: string };
      if (isRole(parsed.role)) cookieRole = parsed.role;
      if (parsed.mode === 'signin' || parsed.mode === 'signup') cookieMode = parsed.mode;
    } catch { /* malformed cookie — ignore */ }
  }
  const oauthRole: Role | null = cookieRole ?? (isRole(searchParams.get('role')) ? (searchParams.get('role') as Role) : null);
  // Дефолт = signin (строгий): если ни кука, ни URL не указали — считаем что
  // это вход (нельзя молча регистрировать при ошибке).
  const mode: 'signin' | 'signup' =
    cookieMode ?? (searchParams.get('mode') === 'signup' ? 'signup' : 'signin');

  // Хелпер: всегда чистим cres_oauth_intent чтобы при следующем входе
  // не сработала старая кука. Возвращает редирект с set-cookie.
  function redirectAndClear(url: string) {
    const res = NextResponse.redirect(url);
    res.cookies.set('cres_oauth_intent', '', { path: '/', maxAge: 0 });
    return res;
  }

  if (!code) {
    return redirectAndClear(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectAndClear(`${origin}/login?error=auth`);

  if (next) return redirectAndClear(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectAndClear(`${origin}/login?error=auth`);

  // Считаем что аккаунт «только что создан» если ему меньше 60 секунд.
  // Это значит trigger handle_new_user сработал прямо сейчас.
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const justCreated = !!createdAt && Date.now() - createdAt.getTime() < 60_000;

  // Режим «Войти»: если только что создался — пользователь имел в виду логин,
  // а такого аккаунта нет. Удаляем созданное (admin) и шлём с ошибкой.
  if (mode === 'signin' && justCreated) {
    try {
      await supabase.auth.signOut();
      const admin = adminDb();
      // Удаление auth.users каскадно дропнет profiles + всё связанное по FK.
      await admin.auth.admin.deleteUser(user.id);
    } catch {/* noop — даже если не получилось, сессию мы уже погасили */}
    const params = new URLSearchParams({ error: 'no_account', mode: 'signup' });
    if (oauthRole) params.set('role', oauthRole);
    return redirectAndClear(`${origin}/login?${params.toString()}`);
  }

  // Найдём профиль. Если он есть и при этом помечен на удаление — восстановим.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, role, deleted_at, full_name')
    .eq('id', user.id)
    .maybeSingle();

  let role: Role;
  if (existingProfile) {
    if (existingProfile.deleted_at) {
      await supabase.from('profiles').update({ deleted_at: null }).eq('id', user.id);
    }
    // Если запрос пришёл с явной ролью И аккаунт только что создан — это
    // первый Google-signup, перезаписываем дефолт client → нужная роль.
    if (justCreated && oauthRole && existingProfile.role !== oauthRole) {
      await supabase.from('profiles').update({ role: oauthRole }).eq('id', user.id);
      role = oauthRole;
      // Триггер не создал master row для не-client ролей (т.к. role был client).
      // Создаём вручную (и salon для admin) если ещё нет.
      if (oauthRole === 'master' || oauthRole === 'salon_admin') {
        const admin = adminDb();
        const { data: existingMaster } = await admin.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
        if (!existingMaster) {
          let salonId: string | null = null;
          if (oauthRole === 'salon_admin') {
            const { data: salon } = await admin.from('salons').insert({
              owner_id: user.id,
              name: existingProfile.full_name || 'Мой салон',
            }).select('id').single();
            salonId = salon?.id ?? null;
          }
          await admin.from('masters').insert({ profile_id: user.id, salon_id: salonId });
        }
      }
    } else {
      role = (existingProfile.role as Role) || 'client';
    }
  } else {
    // Профиля нет (не должно случаться, но на всякий случай).
    role = oauthRole ?? 'client';
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      (typeof md.full_name === 'string' && md.full_name) ||
      (typeof md.name === 'string' && md.name) ||
      user.email?.split('@')[0] ||
      'Пользователь';
    await supabase.from('profiles').insert({
      id: user.id,
      role,
      full_name: fullName,
      email: user.email ?? null,
      avatar_url: typeof md.avatar_url === 'string' ? md.avatar_url : null,
    });
  }

  // Маршрутизация по роли
  if (role === 'client') {
    return redirectAndClear(`${origin}/feed`);
  }
  if (role === 'salon_admin') {
    const { data: salon } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();
    if (salon?.id) return redirectAndClear(`${origin}/salon/${salon.id}/dashboard`);
    return redirectAndClear(`${origin}/onboarding/account-type`);
  }
  // master
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle();
  if (master?.id) return redirectAndClear(`${origin}/calendar`);
  return redirectAndClear(`${origin}/onboarding/account-type`);
}
