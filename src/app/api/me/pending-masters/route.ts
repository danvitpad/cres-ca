/** --- YAML
 * name: Pending Masters (client side)
 * description: GET — мастера, которые подписались на меня, но я ещё на них не подписан.
 *              Используется в /telegram/profile/my-masters (секция "Новые подписчики").
 *              Скрываем те, где client_dismissed_back_request=true.
 * created: 2026-05-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adm = admin();
  const { data: links } = await adm
    .from('client_master_links')
    .select('master_id, master_followed_back_at')
    .eq('profile_id', userId)
    .eq('master_follows_back', true)
    .eq('client_follows', false)
    .eq('client_dismissed_back_request', false)
    .order('master_followed_back_at', { ascending: false });

  const rows = (links ?? []) as Array<{ master_id: string; master_followed_back_at: string | null }>;
  if (rows.length === 0) return NextResponse.json({ masters: [] });

  const { data: masterRows } = await adm
    .from('masters')
    .select('id, specialization, rating, city, display_name, avatar_url, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(name)')
    .in('id', rows.map((r) => r.master_id));

  type Row = {
    id: string;
    specialization: string | null;
    rating: number | null;
    city: string | null;
    display_name: string | null;
    avatar_url: string | null;
    profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
    salon: { name: string | null } | { name: string | null }[] | null;
  };

  const masters = ((masterRows ?? []) as Row[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
    const s = Array.isArray(m.salon) ? m.salon[0] ?? null : m.salon;
    return {
      id: m.id,
      name: m.display_name ?? p?.full_name ?? 'Мастер',
      avatar: m.avatar_url ?? p?.avatar_url ?? null,
      city: m.city,
      rating: m.rating,
      specialization: m.specialization,
      salonName: s?.name ?? null,
    };
  });

  return NextResponse.json({ masters });
}
