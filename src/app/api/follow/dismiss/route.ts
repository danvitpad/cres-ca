/** --- YAML
 * name: Follow Dismiss
 * description: POST — скрывает карточку "X подписался на вас" (× кнопка) для текущей стороны.
 *              Подписка второй стороны остаётся активной — мы только прячем UI-карточку.
 *              Body: { side: 'client' | 'master', masterId?: string, clientProfileId?: string }.
 *              client side → нужен masterId (виновник). master side → clientProfileId.
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

interface Body {
  side: 'client' | 'master';
  masterId?: string;
  clientProfileId?: string;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const adm = admin();

  if (body.side === 'client') {
    if (!body.masterId) return NextResponse.json({ error: 'master_id_required' }, { status: 400 });
    const { error } = await adm
      .from('client_master_links')
      .update({ client_dismissed_back_request: true })
      .eq('profile_id', userId)
      .eq('master_id', body.masterId);
    if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.side === 'master') {
    if (!body.clientProfileId) return NextResponse.json({ error: 'client_profile_id_required' }, { status: 400 });
    const { data: master } = await adm
      .from('masters')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();
    if (!master) return NextResponse.json({ error: 'not_a_master' }, { status: 403 });
    const { error } = await adm
      .from('client_master_links')
      .update({ master_dismissed_back_request: true })
      .eq('profile_id', body.clientProfileId)
      .eq('master_id', master.id);
    if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_side' }, { status: 400 });
}
