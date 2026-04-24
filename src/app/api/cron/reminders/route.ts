/** --- YAML
 * name: Appointment Reminder Cron
 * description: Preferences-driven appointment reminders. For every upcoming appointment in the next 30 days,
 *              computes which offsets (from notification_preferences per-profile) fall within this cron tick,
 *              and queues notifications for both client and master. Dedups via notifications.data.appointment_id+offset.
 *              Also handles master pre-visit brief (30 min before) and auto-release of unconfirmed bookings at 2h.
 * created: 2026-04-13
 * updated: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderTemplate, pickTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

interface TemplateRow {
  master_id: string;
  kind: string;
  content: string;
  is_active: boolean;
}

const DEFAULT_OFFSETS = [1440, 120]; // 24h + 2h (fallback when prefs row is missing)
const WINDOW_MINUTES = 10;            // tolerance ±10 min (cron runs every 15 min → single fire per offset)

const DEFAULT_24H = '📅 {client_name}, завтра в {time} у вас {service_name}. Подтвердите приход: {confirm_url} — {master_name}';
const DEFAULT_2H = '⏰ {client_name}, через 2 часа в {time} — {service_name}. Не опаздывайте!';
const DEFAULT_GENERIC = '🔔 {client_name}, напоминаем: {service_name} {date} в {time}. {master_name}';

function formatOffset(min: number): string {
  if (min >= 1440) {
    const d = Math.floor(min / 1440);
    return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}`;
  }
  if (min >= 60) {
    const h = Math.floor(min / 60);
    return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`;
  }
  return `${min} мин`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  let created = 0;

  // 1. Load master templates
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, kind, content, is_active')
    .in('kind', ['reminder_24h', 'reminder_2h'])
    .eq('is_active', true);

  const templatesByMasterKind = new Map<string, TemplateRow[]>();
  for (const row of (tplRows ?? []) as TemplateRow[]) {
    const key = `${row.master_id}:${row.kind}`;
    const arr = templatesByMasterKind.get(key) ?? [];
    arr.push(row);
    templatesByMasterKind.set(key, arr);
  }

  const getTemplate = (masterId: string, kind: 'reminder_24h' | 'reminder_2h', fallback: string) =>
    pickTemplate(templatesByMasterKind.get(`${masterId}:${kind}`), fallback);

  // 2. Upcoming appointments in next 30 days (wide net; we'll filter per-offset)
  type AppointmentRow = {
    id: string;
    starts_at: string;
    status: string;
    client_id: string;
    master_id: string;
    clients: { profile_id: string | null; full_name: string } | null;
    services: { name: string } | null;
    masters: { profile_id: string | null; display_name: string | null } | null;
  };

  const horizonEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRes = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, client_id, master_id, ' +
      'clients(profile_id, full_name), services(name), masters(profile_id, display_name)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', now.toISOString())
    .lte('starts_at', horizonEnd.toISOString())
    .limit(500);
  const upcoming = (upcomingRes.data ?? []) as unknown as AppointmentRow[];

  if (!upcoming.length) return NextResponse.json({ created: 0 });

  // 3. Gather all profile_ids involved (clients + masters) to batch-load preferences
  const profileIds = new Set<string>();
  for (const apt of upcoming) {
    const client = apt.clients as unknown as { profile_id: string | null } | null;
    const master = apt.masters as unknown as { profile_id: string | null } | null;
    if (client?.profile_id) profileIds.add(client.profile_id);
    if (master?.profile_id) profileIds.add(master.profile_id);
  }

  const { data: prefsRows } = await supabase
    .from('notification_preferences')
    .select('profile_id, offsets_minutes, enabled, quiet_hours_start, quiet_hours_end')
    .in('profile_id', Array.from(profileIds));

  interface Prefs { offsets: number[]; enabled: boolean; qStart: number | null; qEnd: number | null }
  const prefsByProfile = new Map<string, Prefs>();
  for (const p of (prefsRows ?? []) as Array<{ profile_id: string; offsets_minutes: number[]; enabled: boolean; quiet_hours_start: number | null; quiet_hours_end: number | null }>) {
    prefsByProfile.set(p.profile_id, {
      offsets: p.offsets_minutes ?? DEFAULT_OFFSETS,
      enabled: p.enabled,
      qStart: p.quiet_hours_start,
      qEnd: p.quiet_hours_end,
    });
  }
  const getPrefs = (pid: string): Prefs => prefsByProfile.get(pid) ?? { offsets: DEFAULT_OFFSETS, enabled: true, qStart: null, qEnd: null };

  // 4. Automation settings per master (for template toggles + auto_release)
  const masterIds = Array.from(new Set(upcoming.map((a) => a.master_id)));
  const automationSettings = await loadAutomationSettings(supabase, masterIds);

  // 5. Load already-queued reminder notifications for these appointments to dedup
  const apptIds = upcoming.map((a) => a.id);
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('data')
    .in('data->>appointment_id', apptIds)
    .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const sentKeys = new Set<string>();
  for (const n of (existingNotifs ?? []) as Array<{ data: Record<string, unknown> | null }>) {
    const d = n.data;
    const apptId = d?.appointment_id as string | undefined;
    const offset = d?.offset_min as number | undefined;
    const recipient = d?.recipient_profile as string | undefined;
    if (apptId && offset != null && recipient) {
      sentKeys.add(`${apptId}:${recipient}:${offset}`);
    }
  }

  // Helper: create a notification for one recipient at one offset, with dedup + quiet-hours
  async function queueReminder(
    profileId: string,
    apptId: string,
    offsetMin: number,
    title: string,
    body: string,
  ): Promise<boolean> {
    const key = `${apptId}:${profileId}:${offsetMin}`;
    if (sentKeys.has(key)) return false;

    const prefs = getPrefs(profileId);
    if (!prefs.enabled) return false;

    // Quiet hours: delay scheduled_for until end of quiet window
    let scheduledFor = now.toISOString();
    if (prefs.qStart !== null && prefs.qEnd !== null) {
      const curHour = now.getHours();
      const inQuiet = prefs.qStart <= prefs.qEnd
        ? curHour >= prefs.qStart && curHour < prefs.qEnd
        : curHour >= prefs.qStart || curHour < prefs.qEnd;
      if (inQuiet) {
        const delayUntil = new Date(now);
        delayUntil.setHours(prefs.qEnd, 0, 0, 0);
        if (delayUntil.getTime() < now.getTime()) delayUntil.setDate(delayUntil.getDate() + 1);
        scheduledFor = delayUntil.toISOString();
      }
    }

    await supabase.from('notifications').insert({
      profile_id: profileId,
      channel: 'telegram',
      title,
      body,
      scheduled_for: scheduledFor,
      data: { appointment_id: apptId, offset_min: offsetMin, recipient_profile: profileId, kind: 'appointment_reminder' },
    });
    sentKeys.add(key);
    return true;
  }

  // 6. Main loop — for each appointment, for each offset per recipient
  for (const apt of upcoming) {
    const client = apt.clients;
    const service = apt.services;
    const master = apt.masters;

    const startsAt = new Date(apt.starts_at);
    const minutesUntil = (startsAt.getTime() - now.getTime()) / 60000;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres-ca.com';
    const time = startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = startsAt.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

    const ctx = {
      client_name: client?.full_name ?? 'клиент',
      service_name: service?.name ?? 'услуга',
      time,
      date,
      master_name: master?.display_name ?? '',
      confirm_url: `${baseUrl}/confirm/${apt.id}`,
    };

    // Auto-release unconfirmed booking at the 2h mark
    if (Math.abs(minutesUntil - 120) <= WINDOW_MINUTES
        && apt.status === 'booked'
        && isEnabled(automationSettings, apt.master_id, 'auto_release')) {
      await supabase.from('appointments').update({ status: 'cancelled_by_client' }).eq('id', apt.id);
      if (client?.profile_id) {
        await queueReminder(client.profile_id, apt.id, -1, '❌ Запись отменена', 'Вы не подтвердили приход, слот освобождён.');
      }
      if (master?.profile_id) {
        await queueReminder(master.profile_id, apt.id, -1, '❌ Слот освобождён', 'Клиент не подтвердил визит — слот освобождён.');
      }
      continue;
    }

    // Client reminders per client's preferences
    if (client?.profile_id) {
      const clientPrefs = getPrefs(client.profile_id);
      for (const off of clientPrefs.offsets) {
        if (Math.abs(minutesUntil - off) > WINDOW_MINUTES) continue;
        let title = `🔔 Напоминание за ${formatOffset(off)}`;
        let body: string;
        if (off === 1440) {
          title = '📅 Запись завтра';
          body = renderTemplate(getTemplate(apt.master_id, 'reminder_24h', DEFAULT_24H), ctx);
        } else if (off === 120) {
          title = '⏰ Запись через 2 часа';
          body = renderTemplate(getTemplate(apt.master_id, 'reminder_2h', DEFAULT_2H), ctx);
        } else {
          body = renderTemplate(DEFAULT_GENERIC, ctx).replace('Напоминаем:', `Напоминаем (за ${formatOffset(off)}):`);
        }
        if (await queueReminder(client.profile_id, apt.id, off, title, body)) created++;
      }
    }

    // Master reminders per master's preferences (defaults to 24h + 2h)
    if (master?.profile_id) {
      const masterPrefs = getPrefs(master.profile_id);
      for (const off of masterPrefs.offsets) {
        if (Math.abs(minutesUntil - off) > WINDOW_MINUTES) continue;
        let title: string;
        let body: string;
        if (off === 1440) {
          title = '📅 Завтра запись клиента';
          body = `${ctx.client_name} — ${ctx.service_name} в ${time}`;
        } else if (off === 120) {
          title = '⏰ Через 2 часа';
          body = `${ctx.client_name} — ${ctx.service_name} в ${time}`;
        } else {
          title = `🔔 Через ${formatOffset(off)}`;
          body = `${ctx.client_name} — ${ctx.service_name} в ${time}`;
        }
        if (await queueReminder(master.profile_id, apt.id, off, title, body)) created++;
      }
    }
  }

  // 7. Pre-visit brief for master — 30 min before (context-rich, independent from prefs)
  type PreVisitRow = {
    id: string;
    starts_at: string;
    status: string;
    master_id: string;
    clients: {
      full_name: string; notes: string | null; allergies: string[] | null;
      has_health_alert: boolean | null; last_visit_at: string | null; total_visits: number | null;
    } | null;
    services: { name: string } | null;
    masters: { profile_id: string | null } | null;
  };

  const preVisitRes = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, master_id, clients(full_name, notes, allergies, has_health_alert, last_visit_at, total_visits), services(name), masters(profile_id)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', new Date(now.getTime() + (30 - WINDOW_MINUTES) * 60 * 1000).toISOString())
    .lte('starts_at', new Date(now.getTime() + (30 + WINDOW_MINUTES) * 60 * 1000).toISOString());
  const preVisit = (preVisitRes.data ?? []) as unknown as PreVisitRow[];

  const pvMasterIds = Array.from(new Set(preVisit.map((a) => a.master_id)));
  const pvSettings = await loadAutomationSettings(supabase, pvMasterIds);

  for (const apt of preVisit) {
    if (!isEnabled(pvSettings, apt.master_id, 'pre_visit_master')) continue;
    const client = apt.clients;
    const service = apt.services;
    const master = apt.masters;
    if (!master?.profile_id) continue;

    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const parts: string[] = [`${client?.full_name ?? 'Клиент'} — ${service?.name ?? 'услуга'} в ${time}`];
    if (client?.has_health_alert) parts.push('⚠️ Health alert — проверь карту клиента');
    if (client?.allergies?.length) parts.push(`Аллергии: ${client.allergies.join(', ')}`);
    if (client?.notes) {
      const last = client.notes.split('\n').slice(-1)[0].trim();
      if (last) parts.push(`Заметка: ${last.slice(0, 160)}`);
    }
    if (client?.total_visits) {
      parts.push(client.total_visits === 1 ? 'первый визит' : `${client.total_visits}-й визит`);
    } else {
      parts.push('новый клиент');
    }

    if (await queueReminder(master.profile_id, apt.id, 30, '⏳ Через 30 минут', parts.join('\n'))) created++;
  }

  return NextResponse.json({ created });
}
