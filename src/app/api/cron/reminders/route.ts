/** --- YAML
 * name: Appointment Reminder Cron
 * description: Creates reminder notifications for appointments at 24h / 2h / 30min marks. 24h and 2h use per-master message_templates (reminder_24h, reminder_2h) when set, else defaults. 30-min pre-visit sends master a context-rich push with client notes / allergies / visit count (toggle pre_visit_master). Variables: {client_name}, {service_name}, {time}, {date}, {master_name}.
 * created: 2026-04-13
 * updated: 2026-04-19
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

const DEFAULT_24H = '📅 {client_name}, завтра в {time} у вас {service_name}. Подтвердите приход: {confirm_url} — {master_name}';
const DEFAULT_2H = '⏰ {client_name}, через 2 часа в {time} — {service_name}. Не опаздывайте!';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  let created = 0;

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

  function getTemplate(masterId: string, kind: 'reminder_24h' | 'reminder_2h', fallback: string) {
    return pickTemplate(templatesByMasterKind.get(`${masterId}:${kind}`), fallback);
  }

  // 24-hour reminders
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const { data: upcoming24 } = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, client_id, master_id, clients(profile_id, full_name), services(name), masters(profile_id, display_name)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', in23h.toISOString())
    .lte('starts_at', in25h.toISOString());

  const masterIds24 = Array.from(new Set((upcoming24 ?? []).map((a) => a.master_id)));
  const settings24 = await loadAutomationSettings(supabase, masterIds24);

  for (const apt of upcoming24 || []) {
    if (!isEnabled(settings24, apt.master_id, 'reminder_24h')) continue;
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { profile_id: string; display_name: string | null } | null;
    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(apt.starts_at).toLocaleDateString();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres.ca';
    const ctx = {
      client_name: client?.full_name ?? 'клиент',
      service_name: service?.name ?? 'услуга',
      time,
      date,
      master_name: master?.display_name ?? '',
      confirm_url: `${baseUrl}/confirm/${apt.id}`,
    };
    const tpl = getTemplate(apt.master_id, 'reminder_24h', DEFAULT_24H);
    const body = renderTemplate(tpl, ctx);

    if (client?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '📅 Запись завтра',
        body,
        scheduled_for: now.toISOString(),
      });
      created++;
    }
    if (master?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: master.profile_id,
        channel: 'telegram',
        title: '📅 Завтра запись клиента',
        body: `${ctx.client_name} — ${ctx.service_name} в ${time}`,
        scheduled_for: now.toISOString(),
      });
      created++;
    }
  }

  // 2-hour reminders
  const in90m = new Date(now.getTime() + 90 * 60 * 1000);
  const in150m = new Date(now.getTime() + 150 * 60 * 1000);
  const { data: upcoming2 } = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, client_id, master_id, clients(profile_id, full_name), services(name), masters(profile_id, display_name)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', in90m.toISOString())
    .lte('starts_at', in150m.toISOString());

  const masterIds2 = Array.from(new Set((upcoming2 ?? []).map((a) => a.master_id)));
  const settings2 = await loadAutomationSettings(supabase, masterIds2);

  for (const apt of upcoming2 || []) {
    // Auto-release: если до визита осталось ~2ч и он всё ещё 'booked' (не подтверждён) — отменяем.
    if (apt.status === 'booked' && isEnabled(settings2, apt.master_id, 'auto_release')) {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled_by_client' })
        .eq('id', apt.id);
      const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
      const master = apt.masters as unknown as { profile_id: string; display_name: string | null } | null;
      if (client?.profile_id) {
        await supabase.from('notifications').insert({
          profile_id: client.profile_id,
          channel: 'telegram',
          title: '❌ Запись отменена',
          body: 'Вы не подтвердили приход, слот освобождён.',
          scheduled_for: now.toISOString(),
        });
      }
      if (master?.profile_id) {
        await supabase.from('notifications').insert({
          profile_id: master.profile_id,
          channel: 'telegram',
          title: '❌ Слот освобождён',
          body: 'Клиент не подтвердил визит — слот освобождён.',
          scheduled_for: now.toISOString(),
        });
      }
      continue;
    }

    if (!isEnabled(settings2, apt.master_id, 'reminder_2h')) continue;
    const client = apt.clients as unknown as { profile_id: string | null; full_name: string } | null;
    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { profile_id: string; display_name: string | null } | null;
    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(apt.starts_at).toLocaleDateString();

    const ctx = {
      client_name: client?.full_name ?? 'клиент',
      service_name: service?.name ?? 'услуга',
      time,
      date,
      master_name: master?.display_name ?? '',
    };
    const tpl = getTemplate(apt.master_id, 'reminder_2h', DEFAULT_2H);
    const body = renderTemplate(tpl, ctx);

    if (client?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: client.profile_id,
        channel: 'telegram',
        title: '⏰ Запись через 2 часа',
        body,
        scheduled_for: now.toISOString(),
      });
      created++;
    }
  }

  // Master pre-visit brief — 30 min before appointment (with client context)
  const in20m = new Date(now.getTime() + 20 * 60 * 1000);
  const in40m = new Date(now.getTime() + 40 * 60 * 1000);
  const { data: upcomingPreVisit } = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, client_id, master_id, clients(full_name, notes, allergies, has_health_alert, last_visit_at, total_visits), services(name), masters(profile_id, display_name)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', in20m.toISOString())
    .lte('starts_at', in40m.toISOString());

  const masterIdsPv = Array.from(new Set((upcomingPreVisit ?? []).map((a) => a.master_id)));
  const settingsPv = await loadAutomationSettings(supabase, masterIdsPv);

  for (const apt of upcomingPreVisit || []) {
    if (!isEnabled(settingsPv, apt.master_id, 'pre_visit_master')) continue;
    const client = apt.clients as unknown as {
      full_name: string;
      notes: string | null;
      allergies: string[] | null;
      has_health_alert: boolean | null;
      last_visit_at: string | null;
      total_visits: number | null;
    } | null;
    const service = apt.services as unknown as { name: string } | null;
    const master = apt.masters as unknown as { profile_id: string | null } | null;
    if (!master?.profile_id) continue;

    const time = new Date(apt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const parts: string[] = [];
    parts.push(`${client?.full_name ?? 'Клиент'} — ${service?.name ?? 'услуга'} в ${time}`);
    if (client?.has_health_alert) parts.push('⚠️ Health alert — проверь карту клиента');
    if (client?.allergies?.length) parts.push(`Аллергии: ${client.allergies.join(', ')}`);
    if (client?.notes) {
      const last = client.notes.split('\n').slice(-1)[0].trim();
      if (last) parts.push(`Заметка: ${last.slice(0, 160)}`);
    }
    if (client?.total_visits) {
      const visit = client.total_visits === 1 ? 'первый визит' : `${client.total_visits}-й визит`;
      parts.push(visit);
    } else {
      parts.push('новый клиент');
    }

    await supabase.from('notifications').insert({
      profile_id: master.profile_id,
      channel: 'telegram',
      title: '⏳ Через 30 минут',
      body: parts.join('\n'),
      scheduled_for: now.toISOString(),
    });
    created++;
  }

  return NextResponse.json({ created });
}
