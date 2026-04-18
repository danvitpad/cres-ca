/** --- YAML
 * name: Salon Clients API
 * description: GET — lists salon clients, filtered/gated by role. Admin sees all (unified full,
 *              marketplace aggregate). Receptionist sees all but without finance metrics. Master
 *              sees only their own clients.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  master_id: string;
  visibility: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: masters } = await supabase
    .from('masters')
    .select('id, display_name, profile_id')
    .eq('salon_id', salonId)
    .eq('is_active', true);
  const masterList = masters ?? [];
  const masterIds = masterList.map((m) => m.id);
  const ownMaster = masterList.find((m) => m.profile_id === user.id);

  const isUnified = salon.team_mode === 'unified';
  const showFinance = role === 'admin';
  const isMaster = role === 'master';

  let query = supabase
    .from('clients')
    .select('id, full_name, phone, email, date_of_birth, master_id, visibility, created_at')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (isMaster) {
    if (!ownMaster) return NextResponse.json({ clients: [], role, salon });
    query = query.eq('master_id', ownMaster.id);
  } else if (masterIds.length === 0) {
    return NextResponse.json({ clients: [], role, salon });
  } else {
    query = query.in('master_id', masterIds);
  }

  const { data: clientsData } = await query;
  const clients = (clientsData ?? []) as ClientRow[];

  let finance: Map<string, { visits: number; spent: number }> | null = null;
  if (showFinance && clients.length > 0) {
    const ids = clients.map((c) => c.id);
    const { data: appts } = await supabase
      .from('appointments')
      .select('client_id, price, status')
      .in('client_id', ids);
    finance = new Map();
    for (const a of (appts ?? []) as Array<{ client_id: string | null; price: number | null; status: string }>) {
      if (!a.client_id) continue;
      const row = finance.get(a.client_id) ?? { visits: 0, spent: 0 };
      row.visits += 1;
      if (a.status === 'completed' || a.status === 'paid') {
        row.spent += Number(a.price ?? 0);
      }
      finance.set(a.client_id, row);
    }
  }

  const masterMap = new Map(masterList.map((m) => [m.id, m.display_name]));

  const payload = clients.map((c) => {
    const base: Record<string, unknown> = {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      date_of_birth: c.date_of_birth,
      created_at: c.created_at,
    };

    if (!isUnified && role === 'admin') {
      // Marketplace admin: hide master mapping
    } else {
      base.master_id = c.master_id;
      base.master_name = masterMap.get(c.master_id) ?? null;
    }

    if (showFinance && finance) {
      const f = finance.get(c.id);
      base.visits = f?.visits ?? 0;
      base.spent = f?.spent ?? 0;
    }

    return base;
  });

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    role,
    masters: isMaster ? [] : masterList.map((m) => ({ id: m.id, display_name: m.display_name })),
    clients: payload,
  });
}
