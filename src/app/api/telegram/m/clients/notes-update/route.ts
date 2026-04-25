/** --- YAML
 * name: Mini App — Update Client Note (raw)
 * description: Replace client.notes with given string. Used by Mini App for inline edit/delete/add of single entries (UI computes the new joined string).
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { initData?: string; client_id?: string; notes?: string | null }
    | null;
  if (!body?.initData || !body?.client_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(body.initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'not_master' }, { status: 403 });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: owner } = await admin.from('clients').select('master_id').eq('id', body.client_id).maybeSingle();
  if (!owner || owner.master_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const value = (body.notes ?? '').trim();
  const { error } = await admin.from('clients').update({ notes: value.length ? value : null }).eq('id', body.client_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
