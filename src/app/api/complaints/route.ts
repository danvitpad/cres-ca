/** --- YAML
 * name: Complaints API (POST submit + GET list-mine)
 * description: POST — клиент создаёт жалобу на мастера / запись. Уведомление
 *              летит в @crescasuperadmin_bot. GET — клиент видит свои жалобы
 *              (для ленты «мои обращения»).
 * created: 2026-04-30
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifySuperadmin } from '@/lib/notifications/superadmin-notify';

const REASON_LABELS: Record<string, string> = {
  no_show: 'Мастер не пришёл',
  rude: 'Хамство / неуважение',
  wrong_service: 'Сделал не ту услугу',
  dirty: 'Антисанитария / грязь',
  overpriced: 'Завышенная цена',
  other: 'Другое',
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    master_id?: string;
    appointment_id?: string;
    reason_code?: string;
    description?: string;
  } | null;

  if (!body?.master_id || !body?.reason_code || !body?.description?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!Object.keys(REASON_LABELS).includes(body.reason_code)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400 });
  }
  if (body.description.trim().length < 10) {
    return NextResponse.json({ error: 'description_too_short' }, { status: 400 });
  }
  if (body.description.length > 2000) {
    return NextResponse.json({ error: 'description_too_long' }, { status: 400 });
  }

  // Защита от спама: не более 5 жалоб от одного reporter за последние 24 часа.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('complaints')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', user.id)
    .gte('created_at', cutoff);
  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'rate_limited', message: 'Слишком много жалоб за последние 24 часа.' }, { status: 429 });
  }

  const { data: row, error } = await supabase
    .from('complaints')
    .insert({
      reporter_id: user.id,
      master_id: body.master_id,
      appointment_id: body.appointment_id ?? null,
      reason_code: body.reason_code,
      description: body.description.trim(),
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Telegram-уведомление в @crescasuperadmin_bot — best-effort.
  try {
    const [{ data: reporter }, { data: master }] = await Promise.all([
      supabase.from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle(),
      supabase.from('masters').select('id, profile_id, profiles:profiles!masters_profile_id_fkey(full_name, email, phone)').eq('id', body.master_id).maybeSingle(),
    ]);
    const masterRow = master as { profiles?: { full_name?: string; email?: string; phone?: string } } | null;
    const reporterRow = reporter as { full_name?: string; email?: string; phone?: string } | null;
    const text = [
      '🚨 <b>Новая жалоба</b>',
      '',
      `<b>От:</b> ${reporterRow?.full_name ?? '—'} · ${reporterRow?.email ?? ''}${reporterRow?.phone ? ' · ' + reporterRow.phone : ''}`,
      `<b>На мастера:</b> ${masterRow?.profiles?.full_name ?? '—'}${masterRow?.profiles?.phone ? ' · ' + masterRow.profiles.phone : ''}`,
      `<b>Причина:</b> ${REASON_LABELS[body.reason_code] ?? body.reason_code}`,
      ...(body.appointment_id ? [`<b>Запись:</b> ${body.appointment_id.slice(0, 8)}…`] : []),
      '',
      `<i>${body.description.trim().replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</i>`,
    ].join('\n');
    await notifySuperadmin(text);
  } catch {
    // best-effort — жалоба создалась, уведомление не критично
  }

  return NextResponse.json({ ok: true, id: row?.id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('complaints')
    .select('id, master_id, appointment_id, reason_code, description, status, created_at, closed_at')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaints: data ?? [] });
}
