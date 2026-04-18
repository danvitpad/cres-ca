/** --- YAML
 * name: AI Action Undo
 * description: Reverses a voice-AI action using the stored result payload. Currently supports client_created (delete client) and appointment_reschedule (restore old starts_at/ends_at).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RescheduleResult = { appointment_id?: string; from?: string; to?: string };
type ClientCreatedResult = { client_id?: string };

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: log, error } = await supabase
    .from('ai_actions_log')
    .select('id, master_id, action_type, result, status, source')
    .eq('id', id)
    .single();

  if (error || !log) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (log.status !== 'success') return NextResponse.json({ error: 'not_undoable' }, { status: 400 });
  if (log.source !== 'voice') return NextResponse.json({ error: 'not_undoable' }, { status: 400 });

  const result = (log.result ?? {}) as Record<string, unknown>;
  let undone = false;

  switch (log.action_type) {
    case 'client_created': {
      const r = result as ClientCreatedResult;
      if (!r.client_id) return NextResponse.json({ error: 'no_target' }, { status: 400 });
      const { count: apptCount } = await supabase
        .from('appointments').select('id', { count: 'exact', head: true })
        .eq('client_id', r.client_id);
      if ((apptCount ?? 0) > 0) return NextResponse.json({ error: 'client_has_appointments' }, { status: 409 });
      const { error: e } = await supabase
        .from('clients').delete().eq('id', r.client_id).eq('master_id', log.master_id);
      undone = !e;
      break;
    }
    case 'appointment_reschedule': {
      const r = result as RescheduleResult;
      if (!r.appointment_id || !r.from || !r.to) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
      const { data: appt } = await supabase
        .from('appointments').select('starts_at, ends_at').eq('id', r.appointment_id).single();
      if (!appt) return NextResponse.json({ error: 'appointment_missing' }, { status: 404 });
      const duration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
      const restoredStart = new Date(r.from);
      const restoredEnd = new Date(restoredStart.getTime() + duration);
      const { error: e } = await supabase
        .from('appointments')
        .update({ starts_at: restoredStart.toISOString(), ends_at: restoredEnd.toISOString() })
        .eq('id', r.appointment_id)
        .eq('master_id', log.master_id);
      undone = !e;
      break;
    }
    default:
      return NextResponse.json({ error: 'not_undoable' }, { status: 400 });
  }

  if (!undone) return NextResponse.json({ error: 'undo_failed' }, { status: 500 });

  await supabase
    .from('ai_actions_log')
    .update({ status: 'failed', error_message: 'undone_by_user' })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
