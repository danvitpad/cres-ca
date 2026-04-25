/** --- YAML
 * name: Cadence Reminder Cron
 * description: Predictive rebooking — analyses last 10 visits per client-master pair, computes avg interval, most frequent service/day/time, and sends smart reminders before the window closes.
 * created: 2026-04-12
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickFullTemplate, renderFullTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

/* ─── Default smart template ─── */
const DEFAULT_CADENCE =
  '{client_name}, ваше любимое окно в {day_name} в {usual_time} скоро займут. Забронировать?';

/* ─── Fallback (old-style, if no service/day/time pattern found) ─── */
const FALLBACK_CADENCE =
  '{client_name}, обычно ты приходишь раз в ~{avg} дней. Прошло уже {days} — пора записаться?';

/* ─── Day names for RU locale ─── */
const DAY_NAMES_RU = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

/* ─── Helpers ─── */

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Returns the most frequent element in an array */
function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const freq = new Map<T, number>();
  let maxCount = 0;
  let maxVal: T = arr[0];
  for (const v of arr) {
    const c = (freq.get(v) ?? 0) + 1;
    freq.set(v, c);
    if (c > maxCount) { maxCount = c; maxVal = v; }
  }
  return maxVal;
}

/** Format hour:minute to "14:00" */
function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Snap minutes to nearest 30-min slot for readability */
function snap30(minutes: number): number {
  return Math.round(minutes / 30) * 30;
}

/* ─── Types for query results ─── */
interface CompletedAppointment {
  client_id: string;
  service_id: string;
  starts_at: string;
}

interface FutureAppointment {
  client_id: string;
  master_id: string;
}

interface RecentNotification {
  profile_id: string;
}

/* ═══════════════════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  /* ── 1. Load active clients with profile_id ── */
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, profile_id, master_id')
    .eq('is_active', true)
    .not('profile_id', 'is', null);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  const clientIds = clients.map((c) => c.id);
  const masterIds = Array.from(new Set(clients.map((c) => c.master_id)));
  const profileIds = clients.map((c) => c.profile_id!).filter(Boolean);

  /* ── 2. Load automation settings (master-level cadence toggle) ── */
  const automationSettings = await loadAutomationSettings(supabase, masterIds);

  /* ── 3. Load message templates ── */
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, subject, content, is_active')
    .eq('kind', 'cadence')
    .eq('is_active', true)
    .in('master_id', masterIds);
  const tplMap = new Map<string, typeof tplRows>();
  for (const row of tplRows ?? []) {
    const arr = tplMap.get(row.master_id) ?? [];
    arr.push(row);
    tplMap.set(row.master_id, arr);
  }

  /* ── 4. Load last 10 completed appointments per client (with service_id) ── */
  const { data: apts } = await supabase
    .from('appointments')
    .select('client_id, service_id, starts_at')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })
    .limit(clientIds.length * 10);

  /* Group by client, keep max 10 most recent, reverse to chronological */
  const byClient = new Map<string, CompletedAppointment[]>();
  for (const a of (apts ?? []) as CompletedAppointment[]) {
    const arr = byClient.get(a.client_id) ?? [];
    if (arr.length < 10) arr.push(a);
    byClient.set(a.client_id, arr);
  }
  // Reverse each to chronological order for interval calculation
  for (const [k, v] of byClient) {
    byClient.set(k, v.reverse());
  }

  /* ── 5. Load future appointments (to skip clients who already have one) ── */
  const { data: futureApts } = await supabase
    .from('appointments')
    .select('client_id, master_id')
    .in('client_id', clientIds)
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', now.toISOString());

  const hasFutureAppt = new Set<string>();
  for (const fa of (futureApts ?? []) as FutureAppointment[]) {
    hasFutureAppt.add(`${fa.client_id}:${fa.master_id}`);
  }

  /* ── 6. Load recent cadence notifications (last 7 days) to avoid spam ── */
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { data: recentNotifs } = await supabase
    .from('notifications')
    .select('profile_id')
    .in('profile_id', profileIds)
    .like('body', '%[cadence:%')
    .gte('created_at', sevenDaysAgo);

  const recentlyNotified = new Set<string>();
  for (const n of (recentNotifs ?? []) as RecentNotification[]) {
    recentlyNotified.add(n.profile_id);
  }

  /* ── 7. Process each client ── */
  const notifyRows: Array<{
    profile_id: string;
    channel: string;
    title: string;
    body: string;
    scheduled_for: string;
  }> = [];

  for (const c of clients) {
    // Skip if master has cadence disabled
    if (!isEnabled(automationSettings, c.master_id, 'cadence')) continue;

    const dates = byClient.get(c.id);
    if (!dates || dates.length < 2) continue;

    // Skip if already has future appointment with this master
    if (hasFutureAppt.has(`${c.id}:${c.master_id}`)) continue;

    // Skip if notified in last 7 days
    if (recentlyNotified.has(c.profile_id!)) continue;

    /* ── Calculate average interval ── */
    const timestamps = dates.map((d) => new Date(d.starts_at));
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i].getTime() - timestamps[i - 1].getTime()) / 86400000);
    }
    const avgInterval = Math.round(median(intervals));
    if (avgInterval <= 0) continue;

    /* ── Check if it's time to remind (avg_interval - 3 days buffer) ── */
    const lastVisit = timestamps[timestamps.length - 1];
    const daysSinceLast = (now.getTime() - lastVisit.getTime()) / 86400000;
    if (daysSinceLast < avgInterval - 3) continue;

    /* ── Analyse patterns ── */
    // Most frequent service
    const serviceIds = dates.map((d) => d.service_id).filter(Boolean);
    const topServiceId = mode(serviceIds);

    // Most common day of week
    const daysOfWeek = timestamps.map((d) => d.getDay());
    const topDay = mode(daysOfWeek);
    const dayName = topDay !== undefined ? DAY_NAMES_RU[topDay] : undefined;

    // Most common time (snapped to 30-min)
    const timeMinutes = timestamps.map((d) => snap30(d.getHours() * 60 + d.getMinutes()));
    const topTimeMin = mode(timeMinutes);
    const usualTime = topTimeMin !== undefined
      ? fmtTime(Math.floor(topTimeMin / 60), topTimeMin % 60)
      : undefined;

    /* ── Build message ── */
    const hasSmart = dayName && usualTime;
    const defaultTpl = hasSmart ? DEFAULT_CADENCE : FALLBACK_CADENCE;
    const tpl = pickFullTemplate(tplMap.get(c.master_id), defaultTpl, '⏰ Пора записаться');

    const ctxVars = {
      client_name: c.full_name ?? 'клиент',
      avg: avgInterval,
      days: Math.round(daysSinceLast),
      day_name: dayName ?? '',
      usual_time: usualTime ?? '',
      service_id: topServiceId ?? '',
    };
    const rendered = renderFullTemplate(tpl, ctxVars);

    const marker = `[cadence:${c.id}:${today}]`;

    notifyRows.push({
      profile_id: c.profile_id!,
      channel: 'telegram',
      title: rendered.subject ?? '⏰ Пора записаться',
      body: `${rendered.body} ${marker}`,
      scheduled_for: now.toISOString(),
    });
  }

  if (notifyRows.length > 0) {
    await supabase.from('notifications').insert(notifyRows);
  }

  return NextResponse.json({ ok: true, checked: clients.length, notified: notifyRows.length });
}
