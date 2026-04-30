/** --- YAML
 * name: Appointment Reminder Cron
 * description: Preferences-driven appointment reminders. Per upcoming appointment computes which
 *              offsets to fire (per-recipient) and queues notifications. Client-wins dedup —
 *              when a client has an explicit `notification_preferences` row, it overrides the
 *              master's automation toggles; otherwise master's `master_automation_settings`
 *              (reminder_24h/reminder_2h) are the fallback. Subjects + bodies come from
 *              `message_templates` (kind = reminder_24h | reminder_2h) and are rendered
 *              against per-appointment context. Master-side reminders (to the master's own
 *              profile) are independent and follow the master's notification_preferences.
 * created: 2026-04-13
 * updated: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickFullTemplate, renderFullTemplate } from '@/lib/messaging/render-template';
import { loadAutomationSettings, isEnabled } from '@/lib/messaging/automation-settings';

interface TemplateRow {
  master_id: string;
  kind: string;
  subject: string | null;
  content: string;
  is_active: boolean;
}

const DEFAULT_OFFSETS = [1440, 120]; // 24h + 2h
const WINDOW_MINUTES = 10;            // ±10 min tolerance

/* Локализованные fallback-шаблоны напоминаний. Применяются когда мастер не задал
   свой message_template — выбираются по masters.public_language.
   Формат: без приветствия (чтобы работал и на «ты» и на «Вы»),
   структурированный: услуга на время / стоимость / адрес.
   Линии стоимости/адреса включаются только если значения непустые. */

type Lang = 'ru' | 'uk' | 'en';

interface ReminderCtx {
  service_name: string;
  time: string;
  date: string;
  price_label: string;     // "1350 грн" or ""
  address_label: string;   // assembled "вул. ..., 8 этаж" or ""
  master_name: string;
  confirm_url: string;
  offset_label: string;    // "через 2 часа", "через 30 мин", "сегодня в 14:00", etc.
}

const L10N: Record<Lang, {
  cost: string;
  address: string;
  reminder24h: string;     // header for the 24h template
  reminder2h: string;
  reminderGeneric: (ctx: ReminderCtx) => string;
  on: string;              // preposition before time, e.g. "на" / "о" / "at"
  subject24h: string;
  subject2h: string;
  subjectGeneric: string;
}> = {
  ru: {
    cost: 'Стоимость',
    address: 'Адрес',
    reminder24h: 'Напоминаю о записи на завтра:',
    reminder2h: 'Напоминаю — через 2 часа запись:',
    reminderGeneric: (ctx) => `Напоминаю о записи (${ctx.date}):`,
    on: 'на',
    subject24h: '📅 Запись на завтра',
    subject2h: '⏰ Через 2 часа — запись',
    subjectGeneric: '🔔 Напоминание о визите',
  },
  uk: {
    cost: 'Вартість',
    address: 'Адреса',
    reminder24h: 'Нагадую про запис на завтра:',
    reminder2h: 'Нагадую — через 2 години запис:',
    reminderGeneric: (ctx) => `Нагадую про запис (${ctx.date}):`,
    on: 'о',
    subject24h: '📅 Запис на завтра',
    subject2h: '⏰ Через 2 години — запис',
    subjectGeneric: '🔔 Нагадування про візит',
  },
  en: {
    cost: 'Price',
    address: 'Address',
    reminder24h: 'Reminder for tomorrow:',
    reminder2h: 'Reminder — in 2 hours:',
    reminderGeneric: (ctx) => `Reminder (${ctx.date}):`,
    on: 'at',
    subject24h: '📅 Tomorrow at the salon',
    subject2h: '⏰ In 2 hours',
    subjectGeneric: '🔔 Appointment reminder',
  },
};

function resolveLang(raw: unknown): Lang {
  return raw === 'uk' || raw === 'en' ? raw : 'ru';
}

const CURRENCY_LABEL: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
  RUB: '₽',
  PLN: 'zł',
  GBP: '£',
};

function fmtPrice(price: number | null | undefined, currency: string | null | undefined): string {
  if (price == null || price <= 0) return '';
  const cur = currency ?? 'UAH';
  const label = CURRENCY_LABEL[cur] ?? cur;
  // 1350.00 → "1350"; 1350.50 → "1350.50"
  const n = Number(price);
  const numStr = Number.isInteger(n) ? String(n) : n.toFixed(2);
  // ₴/$/€/zł — трактовка как символа: `1350 грн` / `1350 $`
  return `${numStr} ${label}`;
}

function fmtAddress(address: string | null | undefined, city: string | null | undefined, workplace: string | null | undefined): string {
  // workplace name + city + street → "AURA простір краси, Київ, вул. Європейська 27/24".
  // Каждый компонент опционален. Пробелы — через ', '.
  const parts = [workplace, city, address]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

function buildFallbackBody(
  lang: Lang,
  header: string,
  ctx: ReminderCtx,
): string {
  const t = L10N[lang];
  const lines: string[] = [header, `${ctx.service_name} ${t.on} ${ctx.time}`];
  if (ctx.price_label) lines.push(`${t.cost}: ${ctx.price_label}`);
  if (ctx.address_label) lines.push(`${t.address}: ${ctx.address_label}`);
  return lines.join('\n');
}

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

  // 1. Load master templates (subject + body) for client reminders
  const { data: tplRows } = await supabase
    .from('message_templates')
    .select('master_id, kind, subject, content, is_active')
    .in('kind', ['reminder_24h', 'reminder_2h'])
    .eq('is_active', true);

  const templatesByMasterKind = new Map<string, TemplateRow[]>();
  for (const row of (tplRows ?? []) as TemplateRow[]) {
    const key = `${row.master_id}:${row.kind}`;
    const arr = templatesByMasterKind.get(key) ?? [];
    arr.push(row);
    templatesByMasterKind.set(key, arr);
  }

  const getTemplate = (
    masterId: string,
    kind: 'reminder_24h' | 'reminder_2h',
    fallbackSubject: string,
    fallbackBody: string,
  ) => pickFullTemplate(
    templatesByMasterKind.get(`${masterId}:${kind}`),
    fallbackBody,
    fallbackSubject,
  );

  // 2. Upcoming appointments in next 30 days
  type AppointmentRow = {
    id: string;
    starts_at: string;
    status: string;
    price: number | null;
    currency: string | null;
    client_id: string;
    master_id: string;
    clients: { profile_id: string | null; full_name: string } | null;
    services: { name: string; price: number | null; currency: string | null } | null;
    masters: {
      profile_id: string | null;
      display_name: string | null;
      public_language: string | null;
      address: string | null;
      city: string | null;
      workplace_name: string | null;
    } | null;
  };

  const horizonEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRes = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, price, currency, client_id, master_id, ' +
      'clients(profile_id, full_name), services(name, price, currency), ' +
      'masters(profile_id, display_name, public_language, address, city, workplace_name)',
    )
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', now.toISOString())
    .lte('starts_at', horizonEnd.toISOString())
    .limit(500);
  const upcoming = (upcomingRes.data ?? []) as unknown as AppointmentRow[];

  if (!upcoming.length) return NextResponse.json({ created: 0 });

  // 3. Gather profile_ids (clients + masters) to batch-load notification_preferences
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

  interface Prefs { offsets: number[]; enabled: boolean; qStart: number | null; qEnd: number | null; explicit: boolean }
  const prefsByProfile = new Map<string, Prefs>();
  for (const p of (prefsRows ?? []) as Array<{ profile_id: string; offsets_minutes: number[]; enabled: boolean; quiet_hours_start: number | null; quiet_hours_end: number | null }>) {
    prefsByProfile.set(p.profile_id, {
      offsets: p.offsets_minutes ?? DEFAULT_OFFSETS,
      enabled: p.enabled,
      qStart: p.quiet_hours_start,
      qEnd: p.quiet_hours_end,
      explicit: true,
    });
  }
  const getPrefs = (pid: string): Prefs => prefsByProfile.get(pid)
    ?? { offsets: DEFAULT_OFFSETS, enabled: true, qStart: null, qEnd: null, explicit: false };

  // 4. Master automation settings (used as FALLBACK for clients without explicit prefs)
  const masterIds = Array.from(new Set(upcoming.map((a) => a.master_id)));
  const automationSettings = await loadAutomationSettings(supabase, masterIds);

  // Derive client-side offsets per appointment with "client wins, master fallback" dedup:
  // - If client has an explicit notification_preferences row → those offsets are authoritative.
  // - Otherwise, fall back to master's reminder_24h / reminder_2h toggles.
  function getClientOffsets(clientProfileId: string | null | undefined, masterId: string): { offsets: number[]; enabled: boolean } {
    if (!clientProfileId) return { offsets: [], enabled: false };
    const prefs = getPrefs(clientProfileId);
    if (prefs.explicit) {
      // Client wins — even if disabled (then no reminders at all).
      return { offsets: prefs.enabled ? prefs.offsets : [], enabled: prefs.enabled };
    }
    // No explicit prefs → derive from master's automation toggles.
    const offs: number[] = [];
    if (isEnabled(automationSettings, masterId, 'reminder_24h')) offs.push(1440);
    if (isEnabled(automationSettings, masterId, 'reminder_2h')) offs.push(120);
    return { offsets: offs, enabled: offs.length > 0 };
  }

  // 5. Existing notifications dedup index
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

  // 6. Main loop
  for (const apt of upcoming) {
    const client = apt.clients;
    const service = apt.services;
    const master = apt.masters;

    const startsAt = new Date(apt.starts_at);
    const minutesUntil = (startsAt.getTime() - now.getTime()) / 60000;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres-ca.com';
    // ALWAYS Europe/Kyiv — server timezone is UTC, but our users are in Ukraine.
    const time = startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
    const langForDate = resolveLang(master?.public_language);
    const localeMap: Record<Lang, string> = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' };
    const date = startsAt.toLocaleDateString(localeMap[langForDate], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' });

    // Стоимость берём с appointment.price (snapshot на момент бронирования) — fallback на service.price
    const priceVal = apt.price && apt.price > 0 ? apt.price : (service?.price ?? null);
    const curVal = apt.currency ?? service?.currency ?? 'UAH';
    const priceLabel = fmtPrice(priceVal, curVal);
    const addressLabel = fmtAddress(master?.address, master?.city, master?.workplace_name);

    // Strip "(индивид.)" — individual is the default; no need to mark
    const cleanedServiceName = (service?.name ?? 'услуга').replace(
      /\s*\((индивид\.|индивидуально|индивидуальный|индивидуальная|individual)\)/gi,
      '',
    ).trim();
    const ctx = {
      client_name: client?.full_name ?? 'клиент',
      service_name: cleanedServiceName,
      time,
      date,
      master_name: master?.display_name ?? '',
      confirm_url: `${baseUrl}/confirm/${apt.id}`,
      // дополнительные плейсхолдеры для пользовательских шаблонов
      price: priceLabel,
      address: addressLabel,
      currency: CURRENCY_LABEL[curVal] ?? curVal,
    };

    const reminderCtx: ReminderCtx = {
      service_name: ctx.service_name,
      time,
      date,
      price_label: priceLabel,
      address_label: addressLabel,
      master_name: ctx.master_name,
      confirm_url: ctx.confirm_url,
      offset_label: '',
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

    // CLIENT REMINDERS — derived offsets (client prefs explicit OR master fallback)
    if (client?.profile_id) {
      const { offsets } = getClientOffsets(client.profile_id, apt.master_id);
      // Локализация fallback'ов по publicLanguage мастера —
      // мастер выбрал «uk» в settings → клиент получит укр-сообщение.
      const lang = resolveLang(master?.public_language);
      const t = L10N[lang];
      // Прекомпилируем дефолтные тела (без приветствия, на ты+вы нейтрально)
      const fbBody24 = buildFallbackBody(lang, t.reminder24h, reminderCtx);
      const fbBody2  = buildFallbackBody(lang, t.reminder2h, reminderCtx);
      const fbBodyGen = buildFallbackBody(lang, t.reminderGeneric(reminderCtx), reminderCtx);

      for (const off of offsets) {
        if (Math.abs(minutesUntil - off) > WINDOW_MINUTES) continue;
        let title: string;
        let body: string;
        if (off === 1440) {
          const tpl = getTemplate(apt.master_id, 'reminder_24h', t.subject24h, fbBody24);
          const r = renderFullTemplate(tpl, ctx);
          title = r.subject ?? t.subject24h;
          // Если мастер не задал свой шаблон — pickFullTemplate вернул fbBody24 как body,
          // и render через renderTemplate просто пройдёт по нему без подстановок (там уже всё подставлено).
          body = r.body;
        } else if (off === 120) {
          const tpl = getTemplate(apt.master_id, 'reminder_2h', t.subject2h, fbBody2);
          const r = renderFullTemplate(tpl, ctx);
          title = r.subject ?? t.subject2h;
          body = r.body;
        } else {
          title = t.subjectGeneric;
          body = fbBodyGen;
        }
        if (await queueReminder(client.profile_id, apt.id, off, title, body)) created++;
      }
    }

    // MASTER REMINDERS — master's own preference offsets (this notifies the master themselves
    // about upcoming work, independent of "send-to-client" automations).
    if (master?.profile_id) {
      const masterPrefs = getPrefs(master.profile_id);
      if (masterPrefs.enabled) {
        for (const off of masterPrefs.offsets) {
          if (Math.abs(minutesUntil - off) > WINDOW_MINUTES) continue;
          let title: string;
          if (off === 1440) title = '📅 Завтра запись клиента';
          else if (off === 120) title = '⏰ Через 2 часа';
          else title = `🔔 Через ${formatOffset(off)}`;
          const body = `${ctx.client_name} — ${ctx.service_name} в ${time}`;
          if (await queueReminder(master.profile_id, apt.id, off, title, body)) created++;
        }
      }
    }
  }

  // 7. Pre-visit brief for master — 30 min before
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
