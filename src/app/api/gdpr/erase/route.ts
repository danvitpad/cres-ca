/** --- YAML
 * name: GDPR Right to Erasure
 * description: Мастер инициирует soft delete клиента (deleted_at=now). Через 30 дней cron purge-clients выполнит hard delete.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const clientId = body?.client_id;
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .single();
  if (!master) return NextResponse.json({ error: 'Not a master' }, { status: 403 });

  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('master_id', master.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scheduled_purge_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
}
