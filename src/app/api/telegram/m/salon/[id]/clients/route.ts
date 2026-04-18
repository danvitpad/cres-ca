/** --- YAML
 * name: Mini App Salon Clients API
 * description: POST — admin/receptionist only. Returns salon clients list. Receptionist hides finance.
 *              Marketplace admin hides master mapping for privacy.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('telegram_id', result.user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: salon } = await admin
    .from('salons')
    .select('id, name, team_mode, owner_id')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let role: 'admin' | 'master' | 'receptionist' | null = null;
  if (salon.owner_id === profile.id) {
    role = 'admin';
  } else {
    const { data: m } = await admin
      .from('salon_members')
      .select('role, status')
      .eq('salon_id', salonId)
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();
    role = m?.status === 'active' ? (m.role as 'admin' | 'master' | 'receptionist') : null;
  }
  if (role !== 'admin' && role !== 'receptionist') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const isUnified = salon.team_mode === 'unified';
  const showFinance = role === 'admin' && isUnified;

  const { data: masters } = await admin
    .from('masters')
    .select('id, display_name')
    .eq('salon_id', salonId);
  const masterIds = (masters ?? []).map((m) => m.id);
  if (masterIds.length === 0) return NextResponse.json({ clients: [], role });

  const { data: clients } = await admin
    .from('clients')
    .select('id, full_name, phone, avatar_url, master_id, created_at')
    .in('master_id', masterIds)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (clients ?? []) as Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    master_id: string;
    created_at: string | null;
  }>;

  const masterMap = new Map((masters ?? []).map((m) => [m.id, m.display_name]));

  let financeByClient = new Map<string, { visits: number; spent: number }>();
  if (showFinance && rows.length > 0) {
    const { data: appts } = await admin
      .from('appointments')
      .select('client_id, price, status')
      .in('master_id', masterIds);
    const agg = new Map<string, { visits: number; spent: number }>();
    for (const a of (appts ?? []) as Array<{ client_id: string | null; price: number | null; status: string }>) {
      if (!a.client_id) continue;
      if (a.status !== 'completed' && a.status !== 'paid') continue;
      const cur = agg.get(a.client_id) ?? { visits: 0, spent: 0 };
      cur.visits += 1;
      cur.spent += Number(a.price ?? 0);
      agg.set(a.client_id, cur);
    }
    financeByClient = agg;
  }

  const normalized = rows.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    avatar_url: c.avatar_url,
    master_name: isUnified ? masterMap.get(c.master_id) ?? null : null,
    visits: showFinance ? (financeByClient.get(c.id)?.visits ?? 0) : null,
    spent: showFinance ? (financeByClient.get(c.id)?.spent ?? 0) : null,
  }));

  return NextResponse.json({
    role,
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    clients: normalized,
  });
}
