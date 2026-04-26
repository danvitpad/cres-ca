/** --- YAML
 * name: Finance AI Action — Execute
 * description: POST { table, row_id, action: 'delete', user_question? } — выполняет
 *              подтверждённое мастером удаление, предварительно сохранив before_json
 *              в ai_actions_log. Возвращает log_id для возможного отката.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

type DeleteScope = 'payments' | 'expenses' | 'manual_incomes';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    table?: string;
    row_id?: string;
    action?: string;
    user_question?: string;
    ai_response?: string;
  } | null;

  const table = body?.table;
  const rowId = body?.row_id;
  if (!body || (table !== 'payments' && table !== 'expenses' && table !== 'manual_incomes')) {
    return NextResponse.json({ error: 'invalid_table' }, { status: 400 });
  }
  if (!rowId) return NextResponse.json({ error: 'invalid_row' }, { status: 400 });
  if (body.action !== 'delete') return NextResponse.json({ error: 'unsupported_action' }, { status: 400 });

  const { data: master } = await supabase.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Use admin to read the full row (guaranteed snapshot) then delete it.
  // Auth was already validated; we double-check master_id ownership below.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const validTable = table as DeleteScope;
  const { data: snapshot } = await admin.from(validTable).select('*').eq('id', rowId).maybeSingle();
  if (!snapshot) return NextResponse.json({ error: 'row_not_found' }, { status: 404 });

  const owner = (snapshot as { master_id?: string }).master_id;
  if (!owner || owner !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Log first (before_json), then delete. If delete fails — log row stays as a no-op
  // (action='delete', reverted_at IS NULL, but row still exists). UI reads
  // before_json+after_json deltas; an action with row still present == no-op.
  const { data: logRow, error: logErr } = await admin.from('ai_actions_log').insert({
    master_id: master.id,
    scope: 'finance',
    action: 'delete',
    table_name: validTable,
    row_id: rowId,
    before_json: snapshot,
    after_json: null,
    user_question: body.user_question ?? null,
    ai_response: body.ai_response ?? null,
  }).select('id').single();

  if (logErr || !logRow) {
    return NextResponse.json({ error: 'log_failed', detail: logErr?.message }, { status: 500 });
  }

  const { error: delErr } = await admin.from(validTable).delete().eq('id', rowId);
  if (delErr) {
    // Drop the log row so we don't leave a phantom action behind
    await admin.from('ai_actions_log').delete().eq('id', logRow.id);
    return NextResponse.json({ error: 'delete_failed', detail: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    log_id: logRow.id,
    summary: `Удалено: ${describeRow(validTable, snapshot as Record<string, unknown>)}`,
  });
}

function describeRow(table: DeleteScope, row: Record<string, unknown>): string {
  const amount = Number(row.amount ?? 0);
  if (table === 'payments') {
    const date = (row.created_at as string | null)?.slice(0, 10) ?? '';
    return `платёж ${amount.toLocaleString('ru-RU')} ₴ от ${date}`;
  }
  if (table === 'expenses') {
    return `расход ${amount.toLocaleString('ru-RU')} ₴ (${row.category || '—'}) от ${row.date}`;
  }
  return `доход ${amount.toLocaleString('ru-RU')} ₴ от ${row.date}`;
}
