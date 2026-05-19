/** --- YAML
 * name: Profile API (GET + PATCH)
 * description: GET → читает profile по userId (cookie или initData), отдаёт
 *              full_name + first_name + last_name + phone + email + date_of_birth +
 *              avatar_url + bio + slug.
 *              PATCH {fullName?, firstName?, lastName?, dateOfBirth?, bio?, slug?,
 *              avatarUrl?, phone?, email?, password?} — обновляет профиль.
 *              Email/password можно менять только cookie-сессией.
 *              Для Mini App клиенты передают X-TG-Init-Data header.
 * updated: 2026-05-18 (+ GET + first_name/last_name/date_of_birth)
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  const userId = cookieUser?.id ?? await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await admin()
    .from('profiles')
    .select('full_name, first_name, last_name, phone, avatar_url, date_of_birth, bio, slug, role')
    .eq('id', userId)
    .maybeSingle();

  const p = (data ?? null) as {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    date_of_birth: string | null;
    bio: string | null;
    slug: string | null;
    role: string | null;
  } | null;

  return NextResponse.json({
    id: userId,
    email: cookieUser?.email ?? null,
    full_name: p?.full_name ?? null,
    first_name: p?.first_name ?? null,
    last_name: p?.last_name ?? null,
    phone: p?.phone ?? null,
    avatar_url: p?.avatar_url ?? null,
    date_of_birth: p?.date_of_birth ?? null,
    bio: p?.bio ?? null,
    slug: p?.slug ?? null,
    role: p?.role ?? 'client',
  });
}

export async function PATCH(req: Request) {
  // Сначала пробуем cookie session — она нужна для password/email update'ов
  const supabase = await createClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();

  // Если cookie нет — пробуем TG initData (Mini App юзер)
  const userId = cookieUser?.id ?? await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Тело можем прочитать только один раз — resolveUserId clone'ит, мы напрямую
  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    bio?: string;
    slug?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    password?: string;
  };

  // Password change — только для cookie-сессии (требует supabase.auth.updateUser)
  let passwordChanged = false;
  if (typeof body.password === 'string' && body.password.length > 0) {
    if (!cookieUser) {
      return NextResponse.json({ error: 'password_change_requires_login' }, { status: 401 });
    }
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
    }
    const { error: pwErr } = await supabase.auth.updateUser({ password: body.password });
    if (pwErr) {
      return NextResponse.json({ error: 'password_update_failed', detail: pwErr.message }, { status: 400 });
    }
    passwordChanged = true;
  }

  const update: Record<string, unknown> = {};
  if (typeof body.fullName === 'string') update.full_name = body.fullName.trim() || null;
  if (typeof body.firstName === 'string') update.first_name = body.firstName.trim() || null;
  if (typeof body.lastName === 'string') update.last_name = body.lastName.trim() || null;
  if (typeof body.dateOfBirth === 'string') {
    const d = body.dateOfBirth.trim();
    update.date_of_birth = d ? d : null;
  }
  if (typeof body.bio === 'string') update.bio = body.bio.slice(0, 280);
  if (typeof body.avatarUrl === 'string') update.avatar_url = body.avatarUrl;

  if (typeof body.phone === 'string') {
    const raw = body.phone.replace(/\D/g, '');
    if (raw === '') {
      update.phone = null;
    } else {
      const normalized = raw.startsWith('380') ? `+${raw}` : raw.length === 9 ? `+380${raw}` : `+${raw}`;
      if (!/^\+\d{10,15}$/.test(normalized)) {
        return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
      }
      update.phone = normalized;
    }
  }

  // Email change — поддерживаем оба auth-режима (cookie + initData).
  // Cookie-сессия: supabase.auth.updateUser({ email }) — отправит подтверждение
  // на новый email. Mini App без cookie: admin.auth.admin.updateUserById,
  // обновляет email без подтверждения (доверяем initData как auth-источнику).
  if (typeof body.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (email && email !== cookieUser?.email) {
      if (cookieUser) {
        const { error: authErr } = await supabase.auth.updateUser({ email });
        if (authErr) {
          return NextResponse.json({ error: 'email_update_failed', detail: authErr.message }, { status: 400 });
        }
      } else {
        // Mini App initData auth — admin update без email-confirmation
        const adm = admin();
        const { error: adminErr } = await adm.auth.admin.updateUserById(userId, { email });
        if (adminErr) {
          return NextResponse.json({ error: 'email_update_failed', detail: adminErr.message }, { status: 400 });
        }
      }
      update.email = email;
    }
  }

  // Для slug-проверки и финального UPDATE используем admin client — он работает
  // и с cookie, и с TG-источником (нам важен только userId, который мы уже резолвнули).
  const db = admin();

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (slug === '') {
      update.slug = null;
    } else {
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
      }
      const { data: clash } = await db
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .neq('id', userId)
        .maybeSingle();
      if (clash) return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
      update.slug = slug;
    }
  }

  if (Object.keys(update).length === 0) {
    if (passwordChanged) {
      return NextResponse.json({ ok: true, updated: ['password'] });
    }
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { error } = await db.from('profiles').update(update).eq('id', userId);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });

  const updated = Object.keys(update);
  if (passwordChanged) updated.push('password');
  return NextResponse.json({ ok: true, updated });
}
