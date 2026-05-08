/** --- YAML
 * name: Client Voice Action Handler
 * description: >
 *   Выполняет распознанное действие клиента (parseClientVoiceIntent → ...).
 *   Возвращает текст ответа для отправки в Telegram. Не использует roundtrip
 *   через HTTP — прямые supabase select/insert/update через service-role.
 *
 *   Действия:
 *     • book — поиск мастера по имени в подписках клиента, поиск услуги,
 *       создание appointment.
 *     • cancel — отмена ближайшей записи (или по подсказке).
 *     • reschedule — отмена + создание новой.
 *     • list_appointments — список записей за период.
 *     • spending — сумма потраченного за период.
 * created: 2026-05-08
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientVoiceIntent, Period } from './client-voice-intent';

interface HandlerResult {
  reply: string;
  ok: boolean;
}

const TZ = 'Europe/Kyiv';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: TZ });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
}

function periodRange(period: Period | null | undefined): { fromIso: string; toIso: string; label: string } {
  const now = new Date();
  let from: Date;
  let label: string;
  if (period === 'today') {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    label = 'сегодня';
  } else if (period === 'week') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    label = 'за неделю';
  } else if (period === 'month') {
    from = new Date(now);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    label = 'за месяц';
  } else if (period === 'year') {
    from = new Date(now);
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
    label = 'за год';
  } else {
    from = new Date(2020, 0, 1);
    label = 'за всё время';
  }
  return { fromIso: from.toISOString(), toIso: now.toISOString(), label };
}

/** Список мастеров, к которым клиент имеет «доступ» — те у кого он значится
 *  в clients table (то есть уже был, есть карточка). Для голосового бронирования
 *  только из этого списка по запросу Данила. */
async function findMastersForClient(admin: SupabaseClient, profileId: string): Promise<Array<{
  master_id: string;
  client_id: string;
  master_display_name: string;
  master_profile_id: string;
}>> {
  const { data: clients } = await admin
    .from('clients')
    .select('id, master_id, master:masters(id, display_name, profile_id, profile:profiles!masters_profile_id_fkey(full_name))')
    .eq('profile_id', profileId);
  type Row = {
    id: string;
    master_id: string;
    master: {
      id: string;
      display_name: string | null;
      profile_id: string;
      profile: { full_name: string | null } | { full_name: string | null }[] | null;
    } | null;
  };
  return ((clients ?? []) as unknown as Row[])
    .filter((r) => !!r.master)
    .map((r) => {
      const m = r.master!;
      const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return {
        master_id: m.id,
        client_id: r.id,
        master_display_name: m.display_name || prof?.full_name || 'мастер',
        master_profile_id: m.profile_id,
      };
    });
}

function matchByHint<T extends { master_display_name: string }>(items: T[], hint: string): T[] {
  const q = hint.toLowerCase().trim();
  if (!q) return items;
  return items.filter((it) => it.master_display_name.toLowerCase().includes(q));
}

export async function handleClientVoiceIntent(
  admin: SupabaseClient,
  profileId: string,
  intent: ClientVoiceIntent,
): Promise<HandlerResult> {
  if (intent.action === 'list_appointments') {
    return listAppointments(admin, profileId, intent.period ?? 'week');
  }
  if (intent.action === 'spending') {
    return spendingTotal(admin, profileId, intent.period ?? 'all');
  }
  if (intent.action === 'cancel') {
    return cancelAppointment(admin, profileId, intent);
  }
  if (intent.action === 'reschedule') {
    return rescheduleAppointment(admin, profileId, intent);
  }
  if (intent.action === 'book') {
    return bookAppointment(admin, profileId, intent);
  }
  // feedback и unknown обрабатываются ВНЕ хендлера — feedback идёт в старый
  // saveFeedbackAndNotify путь в webhook'е, unknown → подсказка.
  return {
    ok: false,
    reply: '🤔 Не понял. Скажи: «запиши к Анне на маникюр завтра в 14», «когда у меня записи», «сколько потратил за май», «отмени запись на завтра».',
  };
}

async function listAppointments(admin: SupabaseClient, profileId: string, period: Period): Promise<HandlerResult> {
  const { fromIso, toIso, label } = periodRange(period);
  // upcoming → берём начиная с now, но если period 'today' — от начала сегодня.
  const startFrom = period === 'today' || period === 'all' ? fromIso : new Date().toISOString();
  void toIso;

  const { data: clientRows } = await admin.from('clients').select('id').eq('profile_id', profileId);
  const clientIds = ((clientRows ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (clientIds.length === 0) {
    return { ok: true, reply: `📅 Записей ${label} нет.` };
  }

  const { data: apts } = await admin
    .from('appointments')
    .select('id, starts_at, status, service:services(name), master:masters(display_name, profile:profiles!masters_profile_id_fkey(full_name))')
    .in('client_id', clientIds)
    .gte('starts_at', startFrom)
    .in('status', ['booked', 'confirmed'])
    .order('starts_at', { ascending: true })
    .limit(20);

  type Row = {
    id: string; starts_at: string; status: string;
    service: { name: string } | { name: string }[] | null;
    master: { display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null } | { display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }[] | null;
  };
  const list = (apts ?? []) as Row[];
  if (list.length === 0) {
    return { ok: true, reply: `📅 Записей ${label} не найдено.` };
  }

  const lines = list.map((r) => {
    const svc = Array.isArray(r.service) ? r.service[0] : r.service;
    const mas = Array.isArray(r.master) ? r.master[0] : r.master;
    const masProf = mas ? (Array.isArray(mas.profile) ? mas.profile[0] : mas.profile) : null;
    const masterName = mas?.display_name || masProf?.full_name || 'мастер';
    return `• ${fmtDate(r.starts_at)} ${fmtTime(r.starts_at)} — ${svc?.name ?? 'визит'} (${masterName})`;
  });
  return { ok: true, reply: `📅 Твои записи ${label}:\n${lines.join('\n')}` };
}

async function spendingTotal(admin: SupabaseClient, profileId: string, period: Period): Promise<HandlerResult> {
  const { fromIso, toIso, label } = periodRange(period);
  const { data: clientRows } = await admin.from('clients').select('id').eq('profile_id', profileId);
  const clientIds = ((clientRows ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (clientIds.length === 0) {
    return { ok: true, reply: `💸 Потрачено ${label}: 0 ₴` };
  }
  const { data: apts } = await admin
    .from('appointments')
    .select('price, status, starts_at')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso);
  const total = ((apts ?? []) as Array<{ price: number | null }>)
    .reduce((sum, a) => sum + Number(a.price ?? 0), 0);
  return { ok: true, reply: `💸 Потрачено ${label}: ${total.toFixed(0)} ₴` };
}

async function cancelAppointment(admin: SupabaseClient, profileId: string, intent: ClientVoiceIntent): Promise<HandlerResult> {
  const { data: clientRows } = await admin.from('clients').select('id').eq('profile_id', profileId);
  const clientIds = ((clientRows ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (clientIds.length === 0) {
    return { ok: false, reply: '❌ У тебя нет активных записей.' };
  }
  const { data: apts } = await admin
    .from('appointments')
    .select('id, starts_at, status, service:services(name), master:masters(display_name)')
    .in('client_id', clientIds)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['booked', 'confirmed'])
    .order('starts_at', { ascending: true });

  type Row = {
    id: string; starts_at: string; status: string;
    service: { name: string } | { name: string }[] | null;
    master: { display_name: string | null } | { display_name: string | null }[] | null;
  };
  const list = (apts ?? []) as Row[];
  if (list.length === 0) {
    return { ok: false, reply: '❌ У тебя нет предстоящих записей для отмены.' };
  }

  // Если указан hint (дата/мастер) — попробуем матчить, иначе берём ближайшую.
  let target: Row = list[0];
  const hint = (intent.appointment_hint ?? '').toLowerCase().trim();
  if (hint) {
    const found = list.find((r) => {
      const dateStr = fmtDate(r.starts_at).toLowerCase();
      const mas = Array.isArray(r.master) ? r.master[0] : r.master;
      const masterName = mas?.display_name?.toLowerCase() ?? '';
      return dateStr.includes(hint) || hint.includes(dateStr) || (masterName && hint.includes(masterName));
    });
    if (found) target = found;
  }

  const { error } = await admin
    .from('appointments')
    .update({ status: 'cancelled_by_client' })
    .eq('id', target.id);
  if (error) {
    return { ok: false, reply: '❌ Не удалось отменить запись. Попробуй из приложения.' };
  }

  const svc = Array.isArray(target.service) ? target.service[0] : target.service;
  const mas = Array.isArray(target.master) ? target.master[0] : target.master;
  return {
    ok: true,
    reply: `✅ Отменил запись: ${svc?.name ?? 'визит'} ${fmtDate(target.starts_at)} ${fmtTime(target.starts_at)}${mas?.display_name ? ` у ${mas.display_name}` : ''}.`,
  };
}

async function rescheduleAppointment(admin: SupabaseClient, profileId: string, intent: ClientVoiceIntent): Promise<HandlerResult> {
  if (!intent.starts_at) {
    return { ok: false, reply: '🤔 Скажи на какую дату и время перенести: «перенеси на пятницу в 14».' };
  }
  // Сначала отменяем существующую (находим аналогично cancel)
  const { data: clientRows } = await admin.from('clients').select('id, master_id').eq('profile_id', profileId);
  type C = { id: string; master_id: string };
  const clients = (clientRows ?? []) as C[];
  if (clients.length === 0) {
    return { ok: false, reply: '❌ У тебя нет активных записей для переноса.' };
  }
  const clientIds = clients.map((c) => c.id);
  const { data: apts } = await admin
    .from('appointments')
    .select('id, starts_at, status, ends_at, service_id, client_id, price, currency')
    .in('client_id', clientIds)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['booked', 'confirmed'])
    .order('starts_at', { ascending: true })
    .limit(1);

  type R = { id: string; starts_at: string; ends_at: string; status: string; service_id: string; client_id: string; price: number | null; currency: string };
  const target = ((apts ?? []) as R[])[0];
  if (!target) {
    return { ok: false, reply: '❌ У тебя нет предстоящих записей для переноса.' };
  }

  const oldStart = new Date(target.starts_at).getTime();
  const oldEnd = new Date(target.ends_at).getTime();
  const duration = Math.max(15 * 60 * 1000, oldEnd - oldStart);
  const newStart = new Date(intent.starts_at);
  const newEnd = new Date(newStart.getTime() + duration);

  const { error } = await admin
    .from('appointments')
    .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() })
    .eq('id', target.id);
  if (error) {
    return { ok: false, reply: '❌ Не удалось перенести. Попробуй из приложения.' };
  }
  return {
    ok: true,
    reply: `✅ Перенёс запись на ${fmtDate(newStart.toISOString())} ${fmtTime(newStart.toISOString())}.`,
  };
}

async function bookAppointment(admin: SupabaseClient, profileId: string, intent: ClientVoiceIntent): Promise<HandlerResult> {
  if (!intent.starts_at) {
    return { ok: false, reply: '🤔 Скажи когда: «запиши на завтра в 14».' };
  }

  const masters = await findMastersForClient(admin, profileId);
  if (masters.length === 0) {
    return { ok: false, reply: '❌ Ты ещё ни к кому не записывался. Открой Mini App, найди мастера и запишись там.' };
  }

  // Match по имени
  const candidates = intent.master_hint ? matchByHint(masters, intent.master_hint) : masters;
  if (candidates.length === 0) {
    const names = masters.map((m) => m.master_display_name).join(', ');
    return { ok: false, reply: `❌ Мастер не найден среди твоих: ${names}. Уточни имя.` };
  }
  if (candidates.length > 1 && intent.master_hint) {
    const names = candidates.map((m) => m.master_display_name).join(', ');
    return { ok: false, reply: `🤔 Нашёл несколько: ${names}. Уточни — например «к Анне Петренко».` };
  }
  if (candidates.length > 1) {
    const names = candidates.map((m) => m.master_display_name).join(', ');
    return { ok: false, reply: `🤔 У тебя несколько мастеров (${names}). Скажи к кому: «запиши к Анне на …».` };
  }
  const target = candidates[0];

  // Подбираем услугу: matching по service_hint, иначе показываем выбор.
  const { data: services } = await admin
    .from('services')
    .select('id, name, duration_minutes, price, currency')
    .eq('master_id', target.master_id)
    .eq('is_active', true);
  type Svc = { id: string; name: string; duration_minutes: number; price: number; currency: string };
  const svcList = (services ?? []) as Svc[];
  if (svcList.length === 0) {
    return { ok: false, reply: `❌ У ${target.master_display_name} нет активных услуг.` };
  }
  const hint = (intent.service_hint ?? '').toLowerCase().trim();
  const matched = hint
    ? svcList.filter((s) => s.name.toLowerCase().includes(hint))
    : svcList;
  if (matched.length === 0) {
    const names = svcList.map((s) => s.name).slice(0, 5).join(', ');
    return { ok: false, reply: `🤔 Услуга не найдена. У ${target.master_display_name} есть: ${names}.` };
  }
  if (matched.length > 1 && hint) {
    const names = matched.map((s) => s.name).slice(0, 5).join(', ');
    return { ok: false, reply: `🤔 Уточни услугу: ${names}.` };
  }
  if (matched.length > 1) {
    const names = matched.map((s) => s.name).slice(0, 5).join(', ');
    return { ok: false, reply: `🤔 У ${target.master_display_name} несколько услуг: ${names}. Скажи какую.` };
  }
  const svc = matched[0];

  const startsAt = new Date(intent.starts_at);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Простая проверка занятости — пересечение с существующим appointment у мастера.
  const { data: clash } = await admin
    .from('appointments')
    .select('id')
    .eq('master_id', target.master_id)
    .in('status', ['booked', 'confirmed', 'in_progress'])
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString())
    .limit(1);
  if (clash && clash.length > 0) {
    return { ok: false, reply: `❌ ${fmtDate(startsAt.toISOString())} в ${fmtTime(startsAt.toISOString())} у ${target.master_display_name} занято. Скажи другое время.` };
  }

  const { error } = await admin
    .from('appointments')
    .insert({
      master_id: target.master_id,
      client_id: target.client_id,
      service_id: svc.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'booked',
      price: svc.price,
      currency: svc.currency,
      booked_via: 'tg_voice',
    });
  if (error) {
    return { ok: false, reply: '❌ Не получилось создать запись. Попробуй из приложения.' };
  }
  return {
    ok: true,
    reply: `✅ Записал тебя: ${svc.name} у ${target.master_display_name}, ${fmtDate(startsAt.toISOString())} в ${fmtTime(startsAt.toISOString())}.`,
  };
}
