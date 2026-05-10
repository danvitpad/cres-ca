/** --- YAML
 * name: Mini App — End Partnership
 * description: Sets master_partnerships.status='ended' + ended_at=now(). Only
 *              master_id or partner_id of the row can end it.
 * created: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { partnership_id?: string } | null;
  if (!body?.partnership_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle<{ id: string }>();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: row } = await admin
    .from('master_partnerships')
    .select('master_id, partner_id, status')
    .eq('id', body.partnership_id)
    .maybeSingle<{ master_id: string; partner_id: string; status: string }>();

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.master_id !== master.id && row.partner_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (row.status === 'ended') return NextResponse.json({ ok: true });

  const { error } = await admin
    .from('master_partnerships')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', body.partnership_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
