/** --- YAML
 * name: Telegram Master Client Detail API
 * description: Full client card data (info/visits/files) + save note + voice-created appointment markers from ai_actions_log (Phase 8.2).
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

async function resolveMaster(tgId: number) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', tgId).maybeSingle();
  if (!profile) return { admin, master: null };
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  return { admin, master };
}

export async function POST(request: Request) {
  const { initData, client_id, save_note } = await request.json().catch(() => ({}));
  if (!initData || !client_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const { admin, master } = await resolveMaster(result.user.id);
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Save note mode
  if (typeof save_note === 'string') {
    // Verify ownership first
    const { data: owner } = await admin
      .from('clients')
      .select('master_id')
      .eq('id', client_id)
      .maybeSingle();
    if (!owner || owner.master_id !== master.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { error } = await admin.from('clients').update({ notes: save_note }).eq('id', client_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Read mode
  const { data: client } = await admin
    .from('clients')
    .select(
      'id, full_name, phone, email, date_of_birth, notes, allergies, contraindications, has_health_alert, behavior_indicators, total_visits, total_spent, avg_check, last_visit_at',
    )
    .eq('id', client_id)
    .eq('master_id', master.id)
    .maybeSingle();

  if (!client) return NextResponse.json({ client: null, visits: [], files: [] });

  const [{ data: visits }, { data: files }] = await Promise.all([
    admin
      .from('appointments')
      .select('id, starts_at, status, price, service:services(name)')
      .eq('client_id', client_id)
      .eq('master_id', master.id)
      .order('starts_at', { ascending: false })
      .limit(20),
    admin
      .from('client_files')
      .select('id, file_url, file_type, description, is_before_photo, created_at')
      .eq('client_id', client_id)
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const visitIds = (visits ?? []).map((v) => v.id);
  let voiceActions: Record<string, { transcript: string | null; action: string }> = {};
  if (visitIds.length > 0) {
    const { data: logs } = await admin
      .from('ai_actions_log')
      .select('related_appointment_id, input_text, action_type')
      .eq('master_id', master.id)
      .eq('source', 'voice')
      .in('related_appointment_id', visitIds);
    voiceActions = Object.fromEntries(
      (logs ?? [])
        .filter((l) => l.related_appointment_id)
        .map((l) => [l.related_appointment_id as string, { transcript: l.input_text, action: l.action_type }]),
    );
  }

  return NextResponse.json({ client, visits: visits ?? [], files: files ?? [], voiceActions });
}
