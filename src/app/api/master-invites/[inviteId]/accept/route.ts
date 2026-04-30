/** --- YAML
 * name: Master Team Invite — accept
 * description: POST /api/master-invites/[inviteId]/accept — calls RPC accept_master_team_invite.
 *              Atomically creates salon_members row (or activates existing) and marks invite
 *              accepted. Notifies salon owner.
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { inviteId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Fetch invite to enable post-accept notification (need salon_id, master display name).
  const { data: invite } = await supabase
    .from('master_team_invites')
    .select(`
      id, salon_id, master_id,
      master:masters!master_team_invites_master_id_fkey(display_name),
      salon:salons!master_team_invites_salon_id_fkey(name, owner_id)
    `)
    .eq('id', inviteId)
    .maybeSingle();

  const { data: memberId, error } = await supabase.rpc('accept_master_team_invite', {
    p_invite_id: inviteId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fan out salon catalog (only if salon is in unified team_mode — RPC checks)
  if (invite?.master_id && invite?.salon_id) {
    await supabase.rpc('fanout_salon_catalog_to_new_master', {
      p_master_id: invite.master_id,
      p_salon_id: invite.salon_id,
    });
  }

  // Best-effort notification to the salon owner.
  type MasterField = { display_name: string | null };
  type SalonField = { name: string | null; owner_id: string | null };
  const inviteRow = invite as
    | { master: MasterField | MasterField[] | null; salon: SalonField | SalonField[] | null; salon_id: string }
    | null;
  if (inviteRow) {
    const masterObj = Array.isArray(inviteRow.master) ? inviteRow.master[0] : inviteRow.master;
    const salonObj = Array.isArray(inviteRow.salon) ? inviteRow.salon[0] : inviteRow.salon;
    if (salonObj?.owner_id) {
      await notifyUser(supabase, {
        profileId: salonObj.owner_id,
        title: `${masterObj?.display_name || 'Мастер'} принял приглашение`,
        body: `Теперь в команде «${salonObj.name ?? 'салон'}».`,
        data: { type: 'salon_invite_accepted', salon_id: inviteRow.salon_id, invite_id: inviteId },
        deepLinkPath: `/telegram/m/salon/${inviteRow.salon_id}/team`,
        deepLinkLabel: 'Открыть команду',
      });
    }
  }

  return NextResponse.json({ ok: true, member_id: memberId });
}
