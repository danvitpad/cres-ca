/** --- YAML
 * name: Telegram Master Patch API
 * description: PATCH полей masters (specialization, headline, bio, address,
 *              workplace_name, city) + profile.first_name/last_name. Используется
 *              inline-редактором публичной страницы в Mini App. Принимает
 *              initData → resolveUserId → service-role update.
 * created: 2026-05-07
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

type Body = {
  // master fields
  specialization?: string | null;
  headline?: string | null;
  bio?: string | null;
  address?: string | null;
  /** Geo-coords — пишутся вместе с address когда мастер выбирает точку на карте. */
  latitude?: number | null;
  longitude?: number | null;
  workplace_name?: string | null;
  city?: string | null;
  /** JSON {mon: {open,close,closed?}, tue: {...}, ...}. Если поле передано —
   *  пишется целиком, без слияния (мастер всегда отправляет полную неделю). */
  working_hours?: Record<string, { open?: string; close?: string; closed?: boolean } | null> | null;
  /** Публичный slug в URL /m/{slug}. Валидация: 3-32 символа, латиница/цифры/
   *  точка/дефис/подчёркивание. Уникальность проверяется в БД (UNIQUE). */
  slug?: string;
  // profile fields
  first_name?: string;
  last_name?: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const masterUpdate: Record<string, unknown> = {};
  const profileUpdate: Record<string, string | null> = {};

  for (const k of ['specialization', 'headline', 'bio', 'address', 'workplace_name', 'city'] as const) {
    if (k in body) {
      const v = body[k];
      masterUpdate[k] = typeof v === 'string' ? v.trim() || null : null;
    }
  }
  // Coords: принимаем NULL чтобы можно было обнулить, или number
  for (const k of ['latitude', 'longitude'] as const) {
    if (k in body) {
      const v = body[k];
      masterUpdate[k] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
  }
  if ('working_hours' in body) {
    masterUpdate.working_hours = body.working_hours ?? null;
  }
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (slug && !SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
    }
    masterUpdate.slug = slug || null;
  }
  if (typeof body.first_name === 'string' || typeof body.last_name === 'string') {
    const fn = (body.first_name ?? '').trim();
    const ln = (body.last_name ?? '').trim();
    profileUpdate.first_name = fn || null;
    profileUpdate.last_name = ln || null;
    profileUpdate.full_name = [fn, ln].filter(Boolean).join(' ') || null;
  }

  if (Object.keys(masterUpdate).length === 0 && Object.keys(profileUpdate).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (Object.keys(masterUpdate).length > 0) {
    const { error } = await admin.from('masters').update(masterUpdate).eq('profile_id', userId);
    if (error) {
      return NextResponse.json({ error: 'master_update_failed', detail: error.message }, { status: 500 });
    }
  }
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
    if (error) {
      return NextResponse.json({ error: 'profile_update_failed', detail: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
