/** --- YAML
 * name: Guilds API (list + create)
 * description: GET — список гильдий где я owner или active member.
 *              POST — создать новую гильдию (я автоматически становлюсь owner
 *              + active member через DB trigger).
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Найти мой master_id
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ guilds: [] });

  const masterId = (master as { id: string }).id;

  // Все мои membership'ы (включая invited/active)
  const { data: memberships } = await supabase
    .from('guild_members')
    .select('guild_id, role, status')
    .eq('master_id', masterId);

  const guildIds = (memberships ?? []).map((m) => (m as { guild_id: string }).guild_id);
  if (guildIds.length === 0) return NextResponse.json({ guilds: [] });

  const { data: guilds } = await supabase
    .from('guilds')
    .select('id, name, description, city, is_public, owner_master_id, created_at')
    .in('id', guildIds);

  // Для каждой гильдии — count active members
  const { data: counts } = await supabase
    .from('guild_members')
    .select('guild_id')
    .in('guild_id', guildIds)
    .eq('status', 'active');
  const countByGuild = new Map<string, number>();
  for (const r of (counts ?? []) as Array<{ guild_id: string }>) {
    countByGuild.set(r.guild_id, (countByGuild.get(r.guild_id) ?? 0) + 1);
  }

  const membershipByGuild = new Map<string, { role: string; status: string }>();
  for (const m of (memberships ?? []) as Array<{ guild_id: string; role: string; status: string }>) {
    membershipByGuild.set(m.guild_id, { role: m.role, status: m.status });
  }

  const result = (guilds ?? []).map((g) => {
    const row = g as { id: string; name: string; description: string | null; city: string | null; is_public: boolean; owner_master_id: string; created_at: string };
    const membership = membershipByGuild.get(row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      city: row.city,
      is_public: row.is_public,
      is_owner: row.owner_master_id === masterId,
      my_status: membership?.status ?? null,
      my_role: membership?.role ?? null,
      members_count: countByGuild.get(row.id) ?? 0,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ guilds: result });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: 'name_too_long' }, { status: 400 });

  const description = (body.description as string | undefined)?.trim() || null;
  const city = (body.city as string | undefined)?.trim() || null;
  const isPublic = body.is_public !== false;

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 400 });

  const { data: guild, error } = await supabase
    .from('guilds')
    .insert({
      owner_master_id: (master as { id: string }).id,
      created_by: user.id,
      name,
      description,
      city,
      is_public: isPublic,
    })
    .select('id, name')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, guild });
}
