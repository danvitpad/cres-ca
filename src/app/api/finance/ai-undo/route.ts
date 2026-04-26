/** --- YAML
 * name: Finance AI Undo
 * description: POST { log_id } — восстанавливает запись из ai_actions_log.before_json
 *              в исходную таблицу и помечает log.reverted_at. Безграничный undo —
 *              мастер может откатить любое из недавних AI-действий когда захочет.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { log_id?: string } | null;
  const logId = body?.log_id;
  if (!logId) return NextResponse.json({ error: 'invalid_log' }, { status: 400 });

  const { data: master } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: log } = await admin.from('ai_actions_log').select('*').eq('id', logId).maybeSingle();
  if (!log) return NextResponse.json({ error: 'log_not_found' }, { status: 404 });
  const logRow = log as {
    id: string; master_id: string; action: string; table_name: string;
    row_id: string | null; before_json: Record<string, unknown> | null;
    reverted_at: string | null;
  };
  if (logRow.master_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (logRow.reverted_at) {
    return NextResponse.json({ error: 'already_reverted' }, { status: 409 });
  }
  if (logRow.action !== 'delete' || !logRow.before_json) {
    return NextResponse.json({ error: 'unsupported_action' }, { status: 400 });
  }

  const validTables = new Set(['payments', 'expenses', 'manual_incomes']);
  if (!validTables.has(logRow.table_name)) {
    return NextResponse.json({ error: 'invalid_table' }, { status: 400 });
  }

  // Restore: re-insert the original row. Conflict on PK is OK (already restored).
  const { error: insErr } = await admin.from(logRow.table_name).insert(logRow.before_json);
  if (insErr) {
    // PK conflict — row already exists. Treat as success (idempotent undo).
    if (!insErr.message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'restore_failed', detail: insErr.message }, { status: 500 });
    }
  }

  await admin.from('ai_actions_log').update({ reverted_at: new Date().toISOString() }).eq('id', logId);

  return NextResponse.json({ ok: true });
}
