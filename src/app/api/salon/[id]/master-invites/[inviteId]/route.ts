/** --- YAML
 * name: Salon → Master Invite (admin cancel)
 * description: DELETE /api/salon/[id]/master-invites/[inviteId] — admin marks invite cancelled.
 *              Only admin/owner of the salon. Only pending invites can be cancelled.
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';

interface RouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId, inviteId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from('master_team_invites')
    .select('id, status, salon_id')
    .eq('id', inviteId)
    .maybeSingle();
  const inviteRow = invite as { id: string; status: string; salon_id: string } | null;
  if (!inviteRow || inviteRow.salon_id !== salonId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (inviteRow.status !== 'pending') {
    return NextResponse.json({ error: 'already_decided' }, { status: 409 });
  }

  const { error } = await supabase
    .from('master_team_invites')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
