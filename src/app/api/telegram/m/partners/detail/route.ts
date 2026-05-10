/** --- YAML
 * name: Mini App — Master Partner Detail
 * description: Single partnership detail with the "other" master expanded plus
 *   contact info (phone/email/dob/username) and referral stats — how many clients
 *   came via partnership.promo_code and how much profit they brought.
 *   Uses PostgREST embedded join with explicit FK names (same pattern as list API).
 *   Earlier two-step fetch lost the profile data; embedded join works reliably
 *   when FKs are disambiguated.
 * created: 2026-04-25
 * updated: 2026-05-10
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

interface RowSide {
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

  // Embedded join — обе стороны партнёрства одним запросом, через явные FK имена
  // (тот же паттерн что в list API, проверенный). Раньше тут был двухступенчатый
  // запрос — он терял профиль партнёра в некоторых случаях.
  const { data: row } = await admin
    .from('master_partnerships')
    .select(`
      id, master_id, partner_id, status, initiated_at, accepted_at, ended_at,
      note, contract_terms, commission_percent, promo_code, cross_promotion,
      initiator:masters!master_partnerships_master_id_fkey(
        id, specialization, vertical, bio, team_mode, salon_id,
        profile:profiles!masters_profile_id_fkey(
          full_name, avatar_url, slug, username, phone, email, date_of_birth
        )
      ),
      target:masters!master_partnerships_partner_id_fkey(
        id, specialization, vertical, bio, team_mode, salon_id,
        profile:profiles!masters_profile_id_fkey(
          full_name, avatar_url, slug, username, phone, email, date_of_birth
        )
      )
    `)
    .eq('id', body.partnership_id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.master_id !== master.id && row.partner_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const youInitiated = row.master_id === master.id;
  const otherSide = (youInitiated ? row.target : row.initiator) as unknown as RowSide | null;

  const partner: PartnerMaster | null = otherSide ? {
    id: otherSide.id,
    specialization: otherSide.specialization,
    vertical: otherSide.vertical,
    bio: otherSide.bio,
    team_mode: otherSide.team_mode,
    salon_id: otherSide.salon_id,
    profile: otherSide.profile,
  } : null;

  // Statistics: клиенты пришедшие через promo_code партнёрства + завершённые визиты + выручка.
  let clientsCount = 0;
  let completedCount = 0;
  let totalProfit = 0;

  if (row.promo_code && master.id) {
    try {
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
      // promo_code column might not exist — silently 0
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
