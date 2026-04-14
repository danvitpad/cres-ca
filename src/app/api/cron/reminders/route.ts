/** --- YAML
 * name: Appointment Reminder Cron
 * description: Creates reminder notifications for appointments at 24h and 2h marks. Uses per-master message_templates (reminder_24h, reminder_2h) if defined, else falls back to built-in defaults. Variables: {client_name}, {service_name}, {time}, {date}, {master_name}.
 * created: 2026-04-13
 * updated: 2026-04-13
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

  return NextResponse.json({ created });
}
