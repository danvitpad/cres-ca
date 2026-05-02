/** --- YAML
 * name: Guild Member Remove
 * description: DELETE /api/guilds/[id]/members/[memberId] — owner удаляет
 *              мастера из гильдии. Owner себя удалить не может (нужно
 *              удалить гильдию целиком). Уведомление приходит исключённому.
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications/notify';

interface RouteContext { params: Promise<{ id: string; memberId: string }> }

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id: guildId, memberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: guild } = await supabase
    .from('guilds')
    .select('id, name, owner_master_id')
    .eq('id', guildId)
    .maybeSingle();
  if (!guild) return NextResponse.json({ error: 'guild_not_found' }, { status: 404 });

  const { data: myMaster } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!myMaster || (myMaster as { id: string }).id !== (guild as { owner_master_id: string }).owner_master_id) {
    return NextResponse.json({ error: 'only_owner_can_remove' }, { status: 403 });
  }
  if (memberId === (guild as { owner_master_id: string }).owner_master_id) {
    return NextResponse.json({ error: 'cannot_remove_self_delete_guild' }, { status: 400 });
  }

  // Узнаём profile_id для уведомления (до удаления)
  const { data: removed } = await supabase
    .from('masters')
    .select('profile_id')
    .eq('id', memberId)
    .maybeSingle();

  const { error } = await supabase
    .from('guild_members')
    .delete()
    .eq('guild_id', guildId)
    .eq('master_id', memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Уведомление исключённому
  try {
    const profileId = (removed as { profile_id: string } | null)?.profile_id;
    if (profileId) {
      await notifyUser(supabase, {
        profileId,
        title: 'Вас исключили из гильдии',
        body: `Гильдия: «${(guild as { name: string }).name}»`,
        data: { type: 'guild_removed', guild_id: guildId },
      });
    }
  } catch { /* не критично */ }

  return NextResponse.json({ ok: true });
}
