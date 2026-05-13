/** --- YAML
 * name: Mini App — Partner Search
 * description: Поиск мастеров для приглашения в партнёры. Auth через initData.
 *              Multi-token AND по name/slug/specialization/city. Исключает себя и
 *              уже существующие партнёрства.
 * created: 2026-05-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { q?: string } | null;
  const q = body?.q?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: me } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!me) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: matches } = await admin
    .from('masters')
    .select(`
      id, specialization, city,
      profile:profiles!masters_profile_id_fkey(full_name, avatar_url, slug)
    `)
    .eq('is_active', true)
    .neq('id', me.id)
    .limit(80);

  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = ((matches as any[]) || []).filter((m) => {
    const haystack = [m.profile?.full_name, m.profile?.slug, m.specialization, m.city]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });

  const ids = filtered.map((m) => m.id as string);
  if (ids.length === 0) return NextResponse.json({ results: [] });

  const { data: existing } = await admin
    .from('master_partnerships')
    .select('master_id, partner_id')
    .or(`master_id.eq.${me.id},partner_id.eq.${me.id}`)
    .in('status', ['pending', 'active']);

  const taken = new Set<string>();
  for (const r of existing || []) {
    taken.add(r.master_id === me.id ? r.partner_id : r.master_id);
  }

  const results = filtered
    .filter((m) => !taken.has(m.id))
    .map((m) => ({
      id: m.id as string,
      full_name: m.profile?.full_name as string | null,
      avatar_url: m.profile?.avatar_url as string | null,
      slug: m.profile?.slug as string | null,
      specialization: m.specialization as string | null,
      city: m.city as string | null,
    }))
    .slice(0, 10);

  return NextResponse.json({ results });
}
