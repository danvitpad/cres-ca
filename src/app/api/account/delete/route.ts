/** --- YAML
 * name: Delete Account API
 * description: Phase 2.6 — soft-delete. Marks profiles.deleted_at and signs out. A 30-day cron (api/cron/account-purge) performs the hard delete. User can restore by logging in within 30 days.
 * created: 2026-04-17
 * updated: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { confirmation, password } = body as { confirmation?: string; password?: string };
    if (confirmation !== 'УДАЛИТЬ') {
      return NextResponse.json({ error: 'Введите "УДАЛИТЬ" для подтверждения' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Введите текущий пароль' }, { status: 400 });
    }

    // Re-verify password by attempting a sign-in with the same credentials.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const verify = await admin.auth.signInWithPassword({ email: user.email!, password });
    if (verify.error) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 403 });
    }

    // Soft-delete: set deleted_at. Cron /api/cron/account-purge hard-deletes after 30 days.
    const { error: softErr } = await admin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id);
    if (softErr) {
      console.error('[delete-account] soft-delete failed:', softErr);
      return NextResponse.json({ error: softErr.message }, { status: 500 });
    }

    await supabase.auth.signOut();
    return NextResponse.json({ ok: true, deleted_at: new Date().toISOString() });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
