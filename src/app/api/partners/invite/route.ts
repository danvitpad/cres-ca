/** --- YAML
 * name: Partner Invite API
 * description: Send partnership invite to another master by master_id (found via /api/partners/search).
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { partner_id, note } = await request.json() as { partner_id?: string; note?: string };
  if (!partner_id) return NextResponse.json({ error: 'partner_id required' }, { status: 400 });

  const { data: me } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Profile not set up' }, { status: 403 });

  if (me.id === partner_id) {
    return NextResponse.json({ error: 'Cannot partner with yourself' }, { status: 400 });
  }

  // Check target exists
  const { data: target } = await supabase.from('masters').select('id').eq('id', partner_id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Master not found' }, { status: 404 });

  // Does a partnership already exist (either direction)?
  const { data: existing } = await supabase
    .from('master_partnerships')
    .select('id, status, master_id')
    .or(`and(master_id.eq.${me.id},partner_id.eq.${partner_id}),and(master_id.eq.${partner_id},partner_id.eq.${me.id})`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: existing.status === 'active'
        ? 'Уже в партнёрстве'
        : existing.status === 'pending'
          ? 'Запрос уже отправлен'
          : 'Партнёрство ранее завершено',
    }, { status: 409 });
  }

  const { error } = await supabase.from('master_partnerships').insert({
    master_id: me.id,
    partner_id,
    status: 'pending',
    note: note?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
