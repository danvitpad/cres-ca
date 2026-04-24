/** --- YAML
 * name: Rebook dismiss API
 * description: Master rejects a pending rebook suggestion. No TG message is sent.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = admin();
  const { data: s } = await db
    .from('rebook_suggestions')
    .select('id, master_id, status, masters:master_id!rebook_suggestions_master_id_fkey(profile_id)')
    .eq('id', id)
    .maybeSingle();

  type Loaded = { id: string; master_id: string; status: string; masters: { profile_id: string } | null };
  const row = s as unknown as Loaded | null;
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.masters?.profile_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (row.status !== 'pending_master') return NextResponse.json({ error: 'wrong_state' }, { status: 400 });

  await db.from('rebook_suggestions').update({ status: 'dismissed_master' }).eq('id', row.id);
  return NextResponse.json({ ok: true });
}
