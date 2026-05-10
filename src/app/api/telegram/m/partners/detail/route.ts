/** --- YAML
 * name: Mini App — Master Partner Detail
 * description: Single partnership detail with the "other" master expanded plus
 *   contact info (phone/email/dob) and referral stats — how many clients came
 *   via partnership.promo_code and how much profit they brought (sum of
 *   completed appointments price).
 *   Multi-step SELECTs (no PostgREST embedded join) — embedded version returned
 *   null for `target` / `initiator` even when JOIN works in raw SQL.
 * created: 2026-04-25
 * updated: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

interface PartnerProfile {
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
}

interface PartnerMaster {
  id: string;
  specialization: string | null;
  vertical: string | null;
  bio: string | null;
  team_mode: string | null;
  salon_id: string | null;
  profile: PartnerProfile | null;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { partnership_id?: string } | null;
  if (!body?.partnership_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // 1) Сама строка партнёрства — простой select без embedded join.
  const { data: row } = await admin
    .from('master_partnerships')
    .select('id, master_id, partner_id, status, initiated_at, accepted_at, ended_at, note, contract_terms, commission_percent, promo_code, cross_promotion')
    .eq('id', body.partnership_id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.master_id !== master.id && row.partner_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const youInitiated = row.master_id === master.id;
  const partnerMasterId = youInitiated ? row.partner_id : row.master_id;

  // 2) Сам мастер-партнёр.
  const { data: partnerRow } = await admin
    .from('masters')
    .select('id, specialization, vertical, bio, team_mode, salon_id, profile_id')
    .eq('id', partnerMasterId)
    .maybeSingle<{
      id: string; specialization: string | null; vertical: string | null;
      bio: string | null; team_mode: string | null; salon_id: string | null;
      profile_id: string;
    }>();

  // 3) Профиль партнёра — телефон, email, dob, slug, username.
  let profile: PartnerProfile | null = null;
  if (partnerRow?.profile_id) {
    const { data: prof } = await admin
      .from('profiles')
      .select('full_name, avatar_url, slug, username, phone, email, date_of_birth')
      .eq('id', partnerRow.profile_id)
      .maybeSingle<PartnerProfile>();
    profile = prof ?? null;
  }

  const partner: PartnerMaster | null = partnerRow ? {
    id: partnerRow.id,
    specialization: partnerRow.specialization,
    vertical: partnerRow.vertical,
    bio: partnerRow.bio,
    team_mode: partnerRow.team_mode,
    salon_id: partnerRow.salon_id,
    profile,
  } : null;

  // 4) Statistics: сколько клиентов пришло от партнёра + сумма их завершённых
  //    визитов. Связка через promo_code партнёрства (если задан) — клиенты
  //    использующие этот код считаются "приведёнными".
  let clientsCount = 0;
  let completedCount = 0;
  let totalProfit = 0;

  if (row.promo_code && master.id) {
    try {
      // Колонка appointments.promo_code может отсутствовать в схеме — try/catch
      // безопасно даст 0 stats вместо ошибки. Когда добавится — заработает.
      const { data: viaPromo } = await admin
        .from('appointments')
        .select('client_id, price, status')
        .eq('master_id', master.id)
        .eq('promo_code', row.promo_code);

      type AptRow = { client_id: string | null; price: number | null; status: string | null };
      const apts = (viaPromo ?? []) as AptRow[];
      const uniqueClients = new Set<string>();
      for (const a of apts) {
        if (a.client_id) uniqueClients.add(a.client_id);
        if (a.status === 'completed') {
          completedCount++;
          totalProfit += Number(a.price ?? 0);
        }
      }
      clientsCount = uniqueClients.size;
    } catch {
      // promo_code column not present yet — silently 0
    }
  }

  return NextResponse.json({
    partnership: {
      id: row.id,
      master_id: row.master_id,
      partner_id: row.partner_id,
      status: row.status,
      initiated_at: row.initiated_at,
      accepted_at: row.accepted_at,
      ended_at: row.ended_at,
      note: row.note,
      contract_terms: row.contract_terms,
      commission_percent: row.commission_percent,
      promo_code: row.promo_code,
      cross_promotion: row.cross_promotion,
      partner,
      youInitiated,
      stats: {
        clients_referred: clientsCount,
        appointments_completed: completedCount,
        total_profit: Math.round(totalProfit),
      },
    },
  });
}
