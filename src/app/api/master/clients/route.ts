/** --- YAML
 * name: Master Clients API
 * description: POST {full_name, phone, email, date_of_birth, notes} — мастер
 *              вручную добавляет клиента. Если по телефону/почте найден
 *              существующий профиль — линкуем (profile_id = найденный),
 *              сохраняем salon_id из masters.salon_id, шлём клиенту
 *              уведомление «Команда X добавила вас в свои контакты».
 *              Иначе — создаём «локальный» клиентский контакт (profile_id NULL).
 * created: 2026-04-29
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyUser } from '@/lib/notifications/notify';
import { resolveUserId } from '@/lib/auth/resolve-user';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface Body {
  /** Если задан — добавляем уже существующий профиль из системы (search → +). */
  profile_id?: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  notes?: string | null;
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  return digits.length >= 9 ? digits : null;
}

function normalizeEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  return t.includes('@') ? t : null;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = admin();

  const { data: master } = await supabase
    .from('masters')
    .select('id, salon_id, display_name, profile_id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const adm = admin();

  // Mode 1: profile_id передан напрямую (search → + flow).
  if (body.profile_id) {
    const { data: profile } = await adm
      .from('profiles')
      .select('id, full_name, phone, email, date_of_birth')
      .eq('id', body.profile_id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

    const { data: existing } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('master_id', master.id)
      .maybeSingle();

    let clientId: string;
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: inserted, error } = await adm
        .from('clients')
        .insert({
          master_id: master.id,
          salon_id: master.salon_id ?? null,
          profile_id: profile.id,
          full_name: profile.full_name || 'Клиент',
          phone: profile.phone ?? null,
          email: profile.email ?? null,
          date_of_birth: profile.date_of_birth ?? null,
        })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
      clientId = inserted.id;
    }

    // Notify client
    if (profile.id !== userId) {
      await notifyUser(adm, {
        profileId: profile.id,
        title: 'Вас добавили в контакты',
        body: `${master.display_name || 'Мастер'} добавил вас в свои контакты`,
        data: {
          type: 'added_to_contacts',
          master_id: master.id,
          action_url: `/m/${master.id}`,
        },
        deepLinkPath: `/telegram/search/${master.id}`,
        deepLinkLabel: 'Открыть мастера',
      });
    }

    return NextResponse.json({ id: clientId, linked: true });
  }

  // Mode 2: ручное добавление (full_name + опц. phone/email).
  const fullName = (body.full_name ?? '').trim();
  if (!fullName) return NextResponse.json({ error: 'full_name_required' }, { status: 400 });

  const phoneNorm = normalizePhone(body.phone);
  const emailNorm = normalizeEmail(body.email);

  // Auto-link: ищем профиль по телефону или почте.
  let linkedProfileId: string | null = null;
  if (phoneNorm || emailNorm) {
    let q = adm.from('profiles').select('id, phone, email');
    if (phoneNorm && emailNorm) {
      q = q.or(`phone.eq.${phoneNorm},email.eq.${emailNorm}`);
    } else if (phoneNorm) {
      q = q.eq('phone', phoneNorm);
    } else if (emailNorm) {
      q = q.eq('email', emailNorm);
    }
    const { data: matches } = await q.limit(5);
    const candidate = (matches ?? []).find((p) => {
      const phMatch = phoneNorm && p.phone && normalizePhone(p.phone) === phoneNorm;
      const emMatch = emailNorm && p.email && p.email.toLowerCase() === emailNorm;
      return phMatch || emMatch;
    });
    if (candidate) linkedProfileId = candidate.id;
  }

  // Если linked — используем upsert (партиальный uniq на profile_id+master_id).
  // Иначе — обычный insert.
  const insertPayload = {
    master_id: master.id,
    salon_id: master.salon_id ?? null,
    profile_id: linkedProfileId,
    full_name: fullName,
    phone: phoneNorm ?? body.phone?.trim() ?? null,
    email: emailNorm ?? body.email?.trim() ?? null,
    date_of_birth: body.date_of_birth || null,
    notes: body.notes?.trim() || null,
  };

  let clientId: string | null = null;
  if (linkedProfileId) {
    const { data: existing } = await adm
      .from('clients')
      .select('id')
      .eq('profile_id', linkedProfileId)
      .eq('master_id', master.id)
      .maybeSingle();
    if (existing) {
      clientId = existing.id;
      // Не перезаписываем — мастер мог сам отредактировать.
    } else {
      const { data: inserted, error } = await adm
        .from('clients')
        .insert(insertPayload)
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
      clientId = inserted.id;
    }

    // Уведомляем клиента: «Мастер X добавил вас в свои контакты».
    if (linkedProfileId !== userId) {
      await notifyUser(adm, {
        profileId: linkedProfileId,
        title: 'Вас добавили в контакты',
        body: `${master.display_name || 'Мастер'} добавил вас в свои контакты`,
        data: {
          type: 'added_to_contacts',
          master_id: master.id,
          action_url: `/m/${master.id}`,
        },
        deepLinkPath: `/telegram/search/${master.id}`,
        deepLinkLabel: 'Открыть мастера',
      });
    }
  } else {
    const { data: inserted, error } = await adm
      .from('clients')
      .insert(insertPayload)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    clientId = inserted.id;
  }

  return NextResponse.json({
    id: clientId,
    linked: Boolean(linkedProfileId),
  });
}
