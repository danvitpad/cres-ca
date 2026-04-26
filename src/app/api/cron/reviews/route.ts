/** --- YAML
 * name: Review Collection Cron
 * description: 2 hours after appointment ends, create a review-request notification for the client (skipped if already reviewed or already sent)
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickFullTemplate, renderFullTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

const DEFAULT_REVIEW_SUBJECT = '⭐ Оцените визит';
const DEFAULT_REVIEW_BODY =
  '{client_name}, как прошёл визит «{service_name}» у {master_name}? Оцените визит: https://cres.ca/review/{apt_id} [review:{apt_id}]';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const from = new Date(now.getTime() - 150 * 60 * 1000);
  const to = new Date(now.getTime() - 90 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, master_id, ends_at, clients(profile_id, full_name), services(name), masters(display_name, profiles:profiles!masters_profile_id_fkey(full_name))',
    )
    .eq('status', 'completed')
    .gte('ends_at', from.toISOString())
    .lte('ends_at', to.toISOString());

  if (!appointments?.length) return NextResponse.json({ created: 0 });

  const aptIds = appointments.map((a) => a.id);

  const { data: existingReviews } = await supabase
    .from('reviews')
    .select('appointment_id')
    .in('appointment_id', aptIds)
    .eq('target_type', 'master');
  const reviewedSet = new Set((existingReviews ?? []).map((r) => r.appointment_id));

  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('body')
    .like('body', '%[review:%');
  const notifiedSet = new Set<string>();
  (existingNotifs ?? []).forEach((n) => {
    const m = n.body?.match(/\[review:([0-9a-f-]{36})\]/i);
    if (m) notifiedSet.add(m[1]);
  });

  const profileIds = appointments
    .map((a) => (a.clients as unknown as { profile_id: string | null } | null)?.profile_id)
    .filter((x): x is string => !!x);
  const { data: prefs } = await supabase
    .from('notification_prefs')
    .select('profile_id, review_requests')
    .in('profile_id', profileIds);
  const prefMap = new Map((prefs ?? []).map((p) => [p.profile_id, p.review_requests !== false]));

  const masterIds = Array.from(new Set(appointments.map((a) => a.master_id)));
  const automationSettings = await loadAutomationSettings(supabase, masterIds);
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, subject, content, is_active')
    .eq('kind', 'review_request')
    .eq('is_active', true)
    .in('master_id', masterIds);
  const tplMap = new Map<string, typeof tplRows>();
  for (const row of tplRows ?? []) {
    const arr = tplMap.get(row.master_id) ?? [];
    arr.push(row);
    tplMap.set(row.master_id, arr);
  }

  let created = 0;
  for (const apt of appointments) {
    if (!isEnabled(automationSettings, apt.master_id, 'review_request')) continue;
    if (reviewedSet.has(apt.id) || notifiedSet.has(apt.id)) continue;

    const client = apt.clients as unknown as { profile_id: string | null; full_name: string | null } | null;
    if (!client?.profile_id) continue;
    if (prefMap.get(client.profile_id) === false) continue;

    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { display_name: string | null; profiles: { full_name: string | null } | null } | null;
    const masterName = master?.display_name ?? master?.profiles?.full_name ?? 'мастер';
    const serviceName = service?.name ?? 'визит';

    const tpl = pickFullTemplate(tplMap.get(apt.master_id), DEFAULT_REVIEW_BODY, DEFAULT_REVIEW_SUBJECT);
    const rendered = renderFullTemplate(tpl, {
      client_name: client.full_name ?? 'клиент',
      service_name: serviceName,
      master_name: masterName,
      apt_id: apt.id,
    });
    const finalBody = rendered.body.includes(`[review:${apt.id}]`) ? rendered.body : `${rendered.body} [review:${apt.id}]`;

    // Native TG rating — 5 inline buttons. Webhook handles `review:<apt_id>:<stars>`
    // and writes the score into the reviews table without a web round-trip.
    const inlineKeyboard = [[
      { text: '⭐', callback_data: `review:${apt.id}:1` },
      { text: '⭐⭐', callback_data: `review:${apt.id}:2` },
      { text: '⭐⭐⭐', callback_data: `review:${apt.id}:3` },
      { text: '⭐⭐⭐⭐', callback_data: `review:${apt.id}:4` },
      { text: '⭐⭐⭐⭐⭐', callback_data: `review:${apt.id}:5` },
    ]];

    await supabase.from('notifications').insert({
      profile_id: client.profile_id,
      channel: 'telegram',
      title: rendered.subject ?? DEFAULT_REVIEW_SUBJECT,
      body: finalBody,
      scheduled_for: now.toISOString(),
      data: {
        kind: 'review_request',
        appointment_id: apt.id,
        inline_keyboard: inlineKeyboard,
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
