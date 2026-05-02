/** --- YAML
 * name: Guild Details + Update + Delete
 * description: GET — детали гильдии + список членов с инфой о мастерах.
 *              PATCH — обновить name/description/city/is_public (только owner).
 *              DELETE — удалить гильдию (только owner).
 * created: 2026-05-02
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: guild } = await supabase
    .from('guilds')
    .select('id, name, description, city, is_public, owner_master_id, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!guild) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: members } = await supabase
    .from('guild_members')
    .select('master_id, role, status, invited_at, accepted_at')
    .eq('guild_id', id);

  const memberIds = (members ?? []).map((m) => (m as { master_id: string }).master_id);
  const { data: masters } = memberIds.length
    ? await supabase
        .from('masters')
        .select('id, slug, display_name, specialization, avatar_url, city, profile:profiles!masters_profile_id_fkey(full_name)')
        .in('id', memberIds)
    : { data: [] as unknown[] };

  const masterById = new Map<string, {
    id: string; slug: string | null; display_name: string | null;
    specialization: string | null; avatar_url: string | null; city: string | null;
    full_name: string | null;
  }>();
  for (const raw of (masters ?? []) as Array<Record<string, unknown>>) {
    const profile = Array.isArray(raw.profile) ? (raw.profile[0] as Record<string, unknown>) : (raw.profile as Record<string, unknown> | null);
    masterById.set(raw.id as string, {
      id: raw.id as string,
      slug: (raw.slug as string | null) ?? null,
      display_name: (raw.display_name as string | null) ?? null,
      specialization: (raw.specialization as string | null) ?? null,
      avatar_url: (raw.avatar_url as string | null) ?? null,
      city: (raw.city as string | null) ?? null,
      full_name: (profile?.full_name as string | null) ?? null,
    });
  }

  const enrichedMembers = (members ?? []).map((raw) => {
    const m = raw as { master_id: string; role: string; status: string; invited_at: string; accepted_at: string | null };
    const master = masterById.get(m.master_id);
    return {
      master_id: m.master_id,
      role: m.role,
      status: m.status,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      slug: master?.slug ?? null,
      name: master?.display_name || master?.full_name || 'Мастер',
      specialization: master?.specialization ?? null,
      avatar_url: master?.avatar_url ?? null,
      city: master?.city ?? null,
    };
  });

  return NextResponse.json({ guild, members: enrichedMembers });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 80);
  if ('description' in body) update.description = (body.description as string | null)?.toString().trim() || null;
  if ('city' in body) update.city = (body.city as string | null)?.toString().trim() || null;
  if ('is_public' in body) update.is_public = !!body.is_public;

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from('guilds').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('guilds').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
