/** --- YAML
 * name: Salon Member API
 * description: PATCH — update commission_percent, rent_amount, status (active/suspended).
 *              DELETE — soft-delete (status='removed'). Admin-only.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

type PatchBody = {
  commission_percent?: number | null;
  rent_amount?: number | null;
  status?: 'active' | 'suspended';
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: salonId, memberId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const update: Record<string, unknown> = {};
  if (body.commission_percent !== undefined) update.commission_percent = body.commission_percent;
  if (body.rent_amount !== undefined) update.rent_amount = body.rent_amount;
  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
    }
    update.status = body.status;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('salon_members')
    .update(update)
    .eq('id', memberId)
    .eq('salon_id', salonId)
    .select('id, role, status, commission_percent, rent_amount')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: salonId, memberId } = await params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { error } = await supabase
    .from('salon_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('salon_id', salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
