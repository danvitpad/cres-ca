/** --- YAML
 * name: Partner Search API
 * description: Search for masters by name, handle, specialization or city to send
 *              partnership invite. Раньше фильтровало только по name/slug — теперь
 *              мастер может написать «косметолог Киев» и найти косметолога в Киеве.
 *              Multi-token AND: каждое слово должно встретиться в name/slug/spec/city.
 *              Excludes self and existing partners.
 * created: 2026-04-17
 * updated: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data: me } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  // Find active masters; будем матчить multi-token AND по
  // (full_name | slug | specialization | city). Загружаем шире и фильтруем
  // в JS, потому что full_name живёт в смежной таблице profiles.
  const { data: matches } = await supabase
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
  const filtered = ((matches as any[]) || []).filter(m => {
    const haystack = [
      m.profile?.full_name,
      m.profile?.slug,
      m.specialization,
      m.city,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });

  // Exclude existing partnerships
  const ids = filtered.map(m => m.id);
  if (ids.length === 0) return NextResponse.json({ results: [] });

  const { data: existing } = await supabase
    .from('master_partnerships')
    .select('master_id, partner_id')
    .or(`master_id.eq.${me.id},partner_id.eq.${me.id}`)
    .in('status', ['pending', 'active']);

  const taken = new Set<string>();
  for (const r of existing || []) {
    taken.add(r.master_id === me.id ? r.partner_id : r.master_id);
  }

  const results = filtered
    .filter(m => !taken.has(m.id))
    .map(m => ({
      id: m.id,
      full_name: m.profile?.full_name,
      avatar_url: m.profile?.avatar_url,
      slug: m.profile?.slug,
      specialization: m.specialization,
      city: m.city,
    }))
    .slice(0, 10);

  return NextResponse.json({ results });
}
