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
import { NextResponse } from 'next/server';

type Role = 'client' | 'master' | 'salon_admin';

function readRole(searchParams: URLSearchParams): Role | null {
  const r = searchParams.get('role');
  if (r === 'client' || r === 'master' || r === 'salon_admin') return r;
  return null;
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
  const oauthRole = readRole(searchParams);
  // Дефолт = signin (строгий): если в URL не приходит явное mode=signup, считаем
  // что это вход. Защищает от старого кеша JS, который не передавал параметр —
  // пользователь не должен молча зарегистрироваться при попытке логина.
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth`);

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
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
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
    return NextResponse.redirect(`${origin}/feed`);
  }
  if (role === 'salon_admin') {
    const { data: salon } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();
    if (salon?.id) return NextResponse.redirect(`${origin}/salon/${salon.id}/dashboard`);
    return NextResponse.redirect(`${origin}/onboarding/account-type`);
  }
  // master
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle();
  if (master?.id) return NextResponse.redirect(`${origin}/calendar`);
  return NextResponse.redirect(`${origin}/onboarding/account-type`);
}
