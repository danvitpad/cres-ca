/** --- YAML
 * name: Guild Invite
 * description: POST /api/guilds/[id]/invite — owner приглашает мастера в
 *              гильдию по invite_code или master_id. Создаёт запись в
 *              guild_members со status='invited' + посылает уведомление.
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteContext) {
  const { id: guildId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const inviteCode = (body.invite_code as string | undefined)?.trim();
  const masterId = (body.master_id as string | undefined)?.trim();

  if (!inviteCode && !masterId) {
    return NextResponse.json({ error: 'invite_code_or_master_id_required' }, { status: 400 });
  }

  // Проверяю что я owner гильдии
  const { data: guild } = await supabase
    .from('guilds')
    .select('id, name, owner_master_id')
    .eq('id', guildId)
    .maybeSingle();
  if (!guild) return NextResponse.json({ error: 'guild_not_found' }, { status: 404 });

  const { data: myMaster } = await supabase
    .from('masters')
    .select('id, display_name')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!myMaster || (myMaster as { id: string }).id !== (guild as { owner_master_id: string }).owner_master_id) {
    return NextResponse.json({ error: 'only_owner_can_invite' }, { status: 403 });
  }

  // Найти мастера для приглашения
  type MasterTarget = { id: string; profile_id: string; display_name: string | null };
  let target: MasterTarget | null = null;
  if (masterId) {
    const { data } = await supabase
      .from('masters')
      .select('id, profile_id, display_name')
      .eq('id', masterId)
      .maybeSingle();
    target = data as MasterTarget | null;
  } else if (inviteCode) {
    const { data } = await supabase
      .from('masters')
      .select('id, profile_id, display_name')
      .eq('invite_code', inviteCode.toLowerCase())
      .maybeSingle();
    target = data as MasterTarget | null;
  }
  if (!target) return NextResponse.json({ error: 'master_not_found' }, { status: 404 });
  if (target.id === (myMaster as { id: string }).id) {
    return NextResponse.json({ error: 'cannot_invite_self' }, { status: 400 });
  }

  // Проверяем что не уже в гильдии
  const { data: existing } = await supabase
    .from('guild_members')
    .select('status')
    .eq('guild_id', guildId)
    .eq('master_id', target.id)
    .maybeSingle();

  if (existing) {
    const status = (existing as { status: string }).status;
    if (status === 'active') return NextResponse.json({ error: 'already_member' }, { status: 409 });
    if (status === 'invited') return NextResponse.json({ error: 'already_invited' }, { status: 409 });
    // Если 'declined' или 'left' — обновим обратно на 'invited'
    const { error } = await supabase
      .from('guild_members')
      .update({ status: 'invited', invited_at: new Date().toISOString(), invited_by: (myMaster as { id: string }).id, accepted_at: null })
      .eq('guild_id', guildId)
      .eq('master_id', target.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('guild_members')
      .insert({
        guild_id: guildId,
        master_id: target.id,
        role: 'member',
        status: 'invited',
        invited_by: (myMaster as { id: string }).id,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Уведомление мастеру
  try {
    await notifyUser(supabase, {
      profileId: target.profile_id,
      title: 'Приглашение в гильдию',
      body: `${(myMaster as { display_name: string | null }).display_name ?? 'Мастер'} приглашает в гильдию «${(guild as { name: string }).name}»`,
      data: { type: 'guild_invite', guild_id: guildId, guild_name: (guild as { name: string }).name },
      deepLinkPath: '/telegram/m/guilds',
      deepLinkLabel: 'Открыть приглашение',
    });
  } catch { /* не критично */ }

  return NextResponse.json({ ok: true, master_id: target.id, master_name: target.display_name });
}
