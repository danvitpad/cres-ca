/** --- YAML
 * name: Salon Payout PATCH API
 * description: PATCH — admin-only. Transitions a single payout through statuses (draft → confirmed → paid).
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; payoutId: string }> },
) {
  const { id: salonId, payoutId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !['draft', 'confirmed', 'paid'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === 'confirmed') {
    update.confirmed_at = new Date().toISOString();
    update.confirmed_by = user?.id ?? null;
  }
  if (body.status === 'paid') {
    update.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('master_payouts')
    .update(update)
    .eq('id', payoutId)
    .eq('salon_id', salonId)
    .select('id, status, confirmed_at, paid_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
