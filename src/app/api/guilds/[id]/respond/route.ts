/** --- YAML
 * name: Guild Invite Response (accept / decline / leave)
 * description: POST /api/guilds/[id]/respond { action: 'accept' | 'decline' | 'leave' }.
 *              Меняет status в guild_members. Уведомляет owner'а гильдии.
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
  const action = body.action as string | undefined;
  if (!action || !['accept', 'decline', 'leave'].includes(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id, display_name')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 400 });

  const masterId = (master as { id: string }).id;

  // Проверяю текущее membership
  const { data: membership } = await supabase
    .from('guild_members')
    .select('status, role')
    .eq('guild_id', guildId)
    .eq('master_id', masterId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'not_invited' }, { status: 404 });

  const m = membership as { status: string; role: string };

  // Owner не может leave (нужно сначала передать гильдию или удалить её)
  if (action === 'leave' && m.role === 'owner') {
    return NextResponse.json({ error: 'owner_cannot_leave_delete_guild_instead' }, { status: 400 });
  }

  let newStatus: string;
  if (action === 'accept') {
    if (m.status !== 'invited') return NextResponse.json({ error: 'not_invited' }, { status: 400 });
    newStatus = 'active';
  } else if (action === 'decline') {
    if (m.status !== 'invited') return NextResponse.json({ error: 'not_invited' }, { status: 400 });
    newStatus = 'declined';
  } else {
    if (m.status !== 'active') return NextResponse.json({ error: 'not_active_member' }, { status: 400 });
    newStatus = 'left';
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (action === 'accept') update.accepted_at = new Date().toISOString();

  const { error } = await supabase
    .from('guild_members')
    .update(update)
    .eq('guild_id', guildId)
    .eq('master_id', masterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Уведомляем owner'а
  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('name, owner_master_id')
      .eq('id', guildId)
      .maybeSingle();
    if (guild) {
      const { data: ownerMaster } = await supabase
        .from('masters')
        .select('profile_id')
        .eq('id', (guild as { owner_master_id: string }).owner_master_id)
        .maybeSingle();
      const ownerProfileId = (ownerMaster as { profile_id: string } | null)?.profile_id;
      if (ownerProfileId) {
        const myName = (master as { display_name: string | null }).display_name ?? 'Мастер';
        const guildName = (guild as { name: string }).name;
        const verb = action === 'accept' ? 'принял' : action === 'decline' ? 'отклонил' : 'покинул';
        await notifyUser(supabase, {
          profileId: ownerProfileId,
          title: `${myName} ${verb} приглашение в гильдию`,
          body: `Гильдия: «${guildName}»`,
          data: { type: 'guild_response', guild_id: guildId, action },
        });
      }
    }
  } catch { /* не критично */ }

  return NextResponse.json({ ok: true, new_status: newStatus });
}
