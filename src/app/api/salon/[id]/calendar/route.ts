/** --- YAML
 * name: Salon Team Calendar API
 * description: GET — admin/receptionist only. Returns all masters and appointments for a given day range
 *              across the salon. Used by the column-view team calendar at /salon/[id]/calendar.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: salonId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin' && role !== 'receptionist') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = toParam ? new Date(toParam) : new Date(from.getTime() + 86400000);

  const supabase = await createClient();

  const { data: salon } = await supabase
    .from('salons')
    .select('id, name, team_mode')
    .eq('id', salonId)
    .maybeSingle();
  if (!salon) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: masters } = await supabase
    .from('masters')
    .select('id, display_name, avatar_url, specialization')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('display_name');

  const masterList = masters ?? [];
  const masterIds = masterList.map((m) => m.id);

  let appointments: Array<{
    id: string;
    master_id: string;
    client_id: string | null;
    service_id: string | null;
    status: string;
    starts_at: string;
    ends_at: string;
    price: number | null;
    currency: string | null;
    notes: string | null;
    created_by_role: string | null;
    client_name: string | null;
    service_name: string | null;
  }> = [];

  if (masterIds.length > 0) {
    const { data } = await supabase
      .from('appointments')
      .select('id, master_id, client_id, service_id, status, starts_at, ends_at, price, currency, notes, created_by_role, clients(full_name), services(name)')
      .in('master_id', masterIds)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at');

    type Row = {
      id: string; master_id: string; client_id: string | null; service_id: string | null;
      status: string; starts_at: string; ends_at: string; price: number | null;
      currency: string | null; notes: string | null; created_by_role: string | null;
      clients: { full_name: string | null } | { full_name: string | null }[] | null;
      services: { name: string | null } | { name: string | null }[] | null;
    };

    appointments = ((data as Row[] | null) ?? []).map((r) => {
      const clientRow = Array.isArray(r.clients) ? r.clients[0] : r.clients;
      const serviceRow = Array.isArray(r.services) ? r.services[0] : r.services;
      return {
        id: r.id,
        master_id: r.master_id,
        client_id: r.client_id,
        service_id: r.service_id,
        status: r.status,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        price: r.price,
        currency: r.currency,
        notes: r.notes,
        created_by_role: r.created_by_role,
        client_name: clientRow?.full_name ?? null,
        service_name: serviceRow?.name ?? null,
      };
    });
  }

  return NextResponse.json({
    salon: { id: salon.id, name: salon.name, team_mode: salon.team_mode },
    role,
    masters: masterList,
    appointments,
    range: { from: from.toISOString(), to: to.toISOString() },
  });
}
