/** --- YAML
 * name: Accept Salon Invite
 * description: POST — authenticated user accepts an invite. Creates salon_members row, marks invite as used,
 *              notifies the salon owner (in-app notification). Uses service_role for cross-RLS writes.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: invite } = await admin
    .from('salon_invites')
    .select('id, salon_id, role, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.used_at) return NextResponse.json({ error: 'already_used' }, { status: 410 });
  if (new Date(invite.expires_at).getTime() < Date.now())
    return NextResponse.json({ error: 'expired' }, { status: 410 });

  // If inviting a master, ensure the user has a masters row (create one if missing)
  let masterId: string | null = null;
  if (invite.role === 'master') {
    const { data: existingMaster } = await admin
      .from('masters')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (existingMaster) {
      masterId = existingMaster.id;
      // Link existing master to the salon if not already linked
      await admin
        .from('masters')
        .update({ salon_id: invite.salon_id, team_mode: 'unified' })
        .eq('id', existingMaster.id);
    } else {
      const { data: newMaster } = await admin
        .from('masters')
        .insert({
          profile_id: user.id,
          salon_id: invite.salon_id,
          team_mode: 'unified',
          is_active: true,
        })
        .select('id')
        .single();
      masterId = newMaster?.id ?? null;
    }
  }

  // Upsert salon_members row
  const { error: memberErr } = await admin
    .from('salon_members')
    .upsert(
      {
        salon_id: invite.salon_id,
        profile_id: user.id,
        master_id: masterId,
        role: invite.role,
        status: 'active',
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'salon_id,profile_id' },
    );

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  // Mark invite as used
  await admin
    .from('salon_invites')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  // Notify salon owner (in-app)
  const { data: salon } = await admin
    .from('salons')
    .select('owner_id, name')
    .eq('id', invite.salon_id)
    .maybeSingle();

  if (salon?.owner_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const now = new Date().toISOString();
    await admin.from('notifications').insert({
      profile_id: salon.owner_id,
      channel: 'in_app',
      status: 'sent',
      scheduled_for: now,
      sent_at: now,
      title: 'Новый участник команды',
      body: `${profile?.full_name ?? 'Пользователь'} присоединился к салону "${salon.name}" как ${invite.role === 'master' ? 'мастер' : 'администратор'}.`,
      data: {
        type: 'salon_member_joined',
        salon_id: invite.salon_id,
        profile_id: user.id,
        role: invite.role,
      },
    });
  }

  return NextResponse.json({ ok: true, salon_id: invite.salon_id, role: invite.role });
}
