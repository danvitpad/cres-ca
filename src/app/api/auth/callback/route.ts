/** --- YAML
 * name: Auth Callback
 * description: OAuth + email-link return-to. Exchanges Supabase code for session,
 *              создаёт profiles row если первый вход (нужен role из URL — клиент /
 *              master / salon_admin), и роутит в нужное место по роли. Через
 *              Google email уже верифицирован провайдером — OTP-код не нужен.
 * updated: 2026-04-27
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type Role = 'client' | 'master' | 'salon_admin';

function readRole(searchParams: URLSearchParams): Role | null {
  const r = searchParams.get('role');
  if (r === 'client' || r === 'master' || r === 'salon_admin') return r;
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const oauthRole = readRole(searchParams);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth`);

  // Найдём существующий профиль. Если нет — создаём с ролью из OAuth-параметра
  // (или 'client' по умолчанию). Email через Google уже верифицирован
  // (auth.users.email_confirmed_at заполнен) — никаких OTP не нужно.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, role, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  let role: Role;
  if (existingProfile) {
    role = (existingProfile.role as Role) || 'client';
    if (existingProfile.deleted_at) {
      await supabase.from('profiles').update({ deleted_at: null }).eq('id', user.id);
    }
  } else {
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
