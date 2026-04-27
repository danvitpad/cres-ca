/** --- YAML
 * name: Salon → Master Invites (admin side)
 * description:
 *   GET  /api/salon/[id]/master-invites — list invites sent by salon admin to masters.
 *   POST /api/salon/[id]/master-invites — body { master_id, message? }. Creates pending invite.
 *   Admin/owner only. Master must not already be active member of this salon.
 *   Master gets a notification on insert (best-effort).
 * created: 2026-04-26
 * --- */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserRole } from '@/lib/team/roles';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('master_team_invites')
    .select(`
      id, status, message, created_at, decided_at, expires_at,
      master:masters!master_team_invites_master_id_fkey(
        id, display_name, specialization, avatar_url, invite_code, rating, total_reviews,
        profile:profiles!masters_profile_id_fkey(full_name, avatar_url)
      )
    `)
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: salonId } = await ctx.params;
  const role = await getCurrentUserRole(salonId);
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { master_id?: string; message?: string }
    | null;
  if (!body?.master_id) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Master must exist
  const { data: master } = await supabase
    .from('masters')
    .select('id, profile_id, display_name')
    .eq('id', body.master_id)
    .maybeSingle();
  if (!master) {
    return NextResponse.json({ error: 'master_not_found' }, { status: 404 });
  }
  const masterRow = master as { id: string; profile_id: string | null; display_name: string | null };
  if (!masterRow.profile_id) {
    return NextResponse.json({ error: 'master_has_no_profile' }, { status: 400 });
  }

  // Already active member? — block.
  const { data: alreadyMember } = await supabase
    .from('salon_members')
    .select('id')
    .eq('salon_id', salonId)
    .eq('profile_id', masterRow.profile_id)
    .eq('status', 'active')
    .maybeSingle();
  if (alreadyMember) {
    return NextResponse.json({ error: 'already_member' }, { status: 409 });
  }

  // Insert (unique partial index will block duplicate pending invites).
  const { data: invite, error: insertErr } = await supabase
    .from('master_team_invites')
    .insert({
      salon_id: salonId,
      master_id: masterRow.id,
      invited_by: user.id,
      message: body.message?.trim() || null,
    })
    .select('id')
    .single();

  if (insertErr || !invite) {
    if (insertErr?.code === '23505') {
      return NextResponse.json({ error: 'already_invited' }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr?.message ?? 'insert_failed' }, { status: 500 });
  }
  const inviteRow = invite as { id: string };

  // Best-effort notification to the master.
  try {
    const { data: salon } = await supabase
      .from('salons')
      .select('name')
      .eq('id', salonId)
      .maybeSingle();
    const salonName = (salon as { name: string } | null)?.name ?? 'команда';
    await notifyUser(supabase, {
      profileId: masterRow.profile_id,
      title: `Тебя приглашают в ${salonName}`,
      body: body.message?.trim() || 'Открой приложение чтобы принять или отклонить.',
      data: { type: 'salon_invite', salon_id: salonId, invite_id: inviteRow.id, master_id: masterRow.id },
      deepLinkPath: '/telegram/m/invites',
      deepLinkLabel: 'Открыть приглашение',
    });
  } catch { /* ignore */ }

  return NextResponse.json({ invite_id: inviteRow.id });
}
