/** --- YAML
 * name: Account Purge Cron
 * description: Phase 2.6 — daily cron. Hard-deletes auth.users (cascades to profiles + everything FK-linked) for accounts where profiles.deleted_at is older than 30 days.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await admin
    .from('profiles')
    .select('id, email, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const p of pending ?? []) {
    const { error: delErr } = await admin.auth.admin.deleteUser(p.id);
    if (delErr) {
      console.error('[account-purge] failed', p.id, delErr);
      results.push({ id: p.id, ok: false, error: delErr.message });
    } else {
      results.push({ id: p.id, ok: true });
    }
  }

  return NextResponse.json({ ok: true, purged: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
}
