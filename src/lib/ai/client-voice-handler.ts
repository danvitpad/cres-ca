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

/** Список мастеров, к которым у клиента есть отношение:
 *  1) запись в clients (уже ходил) → client_id известен
 *  2) подписка через follows → client_id null, создаём при реальной записи.
 *  Реализовано через 3 простых SELECT (без PostgREST embedded join) —
 *  embedded версия в проде нестабильна для этого пути. */
async function findMastersForClient(admin: SupabaseClient, profileId: string): Promise<Array<{
  master_id: string;
  client_id: string | null;
  master_display_name: string;
  master_profile_id: string;
}>> {
  // 1) clients у этого профиля
  const { data: clientsRows } = await admin
    .from('clients')
    .select('id, master_id')
    .eq('profile_id', profileId);
  const clients = (clientsRows ?? []) as Array<{ id: string; master_id: string }>;

  // 2) follows этого профиля → найти masters по following_id (= master profile_id)
  const { data: followsRows } = await admin
    .from('follows')
    .select('following_id')
    .eq('follower_id', profileId);
  const followProfileIds = ((followsRows ?? []) as Array<{ following_id: string }>)
    .map((f) => f.following_id);

  // Собираем все master_id'ы, которые нужно загрузить.
  const directMasterIds = clients.map((c) => c.master_id);
  let mastersById = new Map<string, { id: string; display_name: string | null; profile_id: string }>();
  if (directMasterIds.length > 0) {
    const { data: ms } = await admin
      .from('masters')
      .select('id, display_name, profile_id')
      .in('id', directMasterIds);
    for (const m of ((ms ?? []) as Array<{ id: string; display_name: string | null; profile_id: string }>)) {
      mastersById.set(m.id, m);
    }
  }
  // Из подписок: ищем masters where profile_id in followProfileIds
  if (followProfileIds.length > 0) {
    const { data: ms } = await admin
      .from('masters')
      .select('id, display_name, profile_id')
      .in('profile_id', followProfileIds);
    for (const m of ((ms ?? []) as Array<{ id: string; display_name: string | null; profile_id: string }>)) {
      if (!mastersById.has(m.id)) mastersById.set(m.id, m);
    }
  }

  if (mastersById.size === 0) return [];

  // Подтягиваем profile.full_name для тех у кого display_name пусто.
  const allProfileIds = Array.from(mastersById.values()).map((m) => m.profile_id);
  const profilesByid = new Map<string, string | null>();
  if (allProfileIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', allProfileIds);
    for (const p of ((profs ?? []) as Array<{ id: string; full_name: string | null }>)) {
      profilesByid.set(p.id, p.full_name);
    }
  }

  // Map master_id → client_id (если есть в clients)
  const clientIdByMaster = new Map<string, string>();
  for (const c of clients) clientIdByMaster.set(c.master_id, c.id);

  return Array.from(mastersById.values()).map((m) => ({
    master_id: m.id,
    client_id: clientIdByMaster.get(m.id) ?? null,
    master_display_name: m.display_name || profilesByid.get(m.profile_id) || 'мастер',
    master_profile_id: m.profile_id,
  }));
}

/** Создать clients-row для клиента у мастера, если её ещё нет.
 *  Используется при первой записи через подписку. Возвращает client_id. */
async function ensureClientRow(
  admin: SupabaseClient,
  profileId: string,
  masterId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('profile_id', profileId)
    .eq('master_id', masterId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  // Возьмём имя из profiles чтобы full_name был не пустой.
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', profileId)
    .maybeSingle();

  const { data: created, error } = await admin
    .from('clients')
    .insert({
      profile_id: profileId,
      master_id: masterId,
      full_name: (profile as { full_name: string | null } | null)?.full_name ?? 'Клиент',
      phone: (profile as { phone: string | null } | null)?.phone ?? null,
    })
    .select('id')
    .single();
  if (error || !created?.id) return null;
  return created.id as string;
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
  if (intent.action === 'my_bonuses') {
    return myBonuses(admin, profileId, intent.master_hint ?? null);
  }
  if (intent.action === 'my_masters') {
    return myMasters(admin, profileId);
  }
  if (intent.action === 'help') {
    return helpReply();
  }
  // feedback и unknown обрабатываются ВНЕ хендлера — feedback идёт в старый
  // saveFeedbackAndNotify путь в webhook'е, unknown → подсказка.
  return {
    ok: false,
    reply: '🤔 Не понял. Скажи: «запиши к Анне на маникюр завтра в 14», «когда у меня записи», «сколько потратил за май», «отмени запись на завтра», «сколько у меня бонусов», «кто мои мастера». Или напиши «помощь» — я расскажу всё что умею.',
  };
}

/** Бонусы клиента у его мастеров. Если master_hint указан — фильтр.
 *  Использует loyalty_balances + masters/profiles для имени. */
async function myBonuses(admin: SupabaseClient, profileId: string, masterHint: string | null): Promise<HandlerResult> {
  const { data: balances } = await admin
    .from('loyalty_balances')
    .select('balance, locked_balance, master:masters(id, display_name, profile:profiles!masters_profile_id_fkey(full_name))')
    .eq('profile_id', profileId);

  type Row = {
    balance: number | null;
    locked_balance: number | null;
    master: {
      id: string;
      display_name: string | null;
      profile: { full_name: string | null } | { full_name: string | null }[] | null;
    } | { id: string; display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }[] | null;
  };

  const rows = ((balances ?? []) as unknown as Row[])
    .map((r) => {
      const m = Array.isArray(r.master) ? r.master[0] : r.master;
      const prof = m ? (Array.isArray(m.profile) ? m.profile[0] : m.profile) : null;
      const masterName = m?.display_name || prof?.full_name || 'мастер';
      return {
        masterName,
        balance: Number(r.balance ?? 0),
        locked: Number(r.locked_balance ?? 0),
      };
    })
    .filter((r) => r.balance > 0 || r.locked > 0);

  const filtered = masterHint
    ? rows.filter((r) => r.masterName.toLowerCase().includes(masterHint.toLowerCase()))
    : rows;

  if (filtered.length === 0) {
    return {
      ok: true,
      reply: masterHint
        ? `🎁 У мастера «${masterHint}» бонусов нет.`
        : '🎁 Пока бонусов нет. После визитов они начнут накапливаться.',
    };
  }

  const lines = filtered.map((r) => `• ${r.masterName} — ${r.balance} баллов${r.locked > 0 ? ` (ещё ${r.locked} в ожидании)` : ''}`);
  return { ok: true, reply: `🎁 Твои бонусы:\n${lines.join('\n')}` };
}

/** Список мастеров, к которым клиент уже ходил (clients) или на которых
 *  подписан (follows). findMastersForClient уже дедуплицирует по master_id. */
async function myMasters(admin: SupabaseClient, profileId: string): Promise<HandlerResult> {
  const masters = await findMastersForClient(admin, profileId);
  if (masters.length === 0) {
    return { ok: true, reply: '👥 У тебя пока нет мастеров — ни в записях, ни в подписках. Открой Mini App, найди подходящего и подпишись.' };
  }
  const lines = masters.map((m) => `• ${m.master_display_name}`);
  return { ok: true, reply: `👥 Твои мастера:\n${lines.join('\n')}` };
}

/** Что умеет клиентский AI. Текст синхронизирован с /help в TG-боте. */
function helpReply(): HandlerResult {
  return {
    ok: true,
    reply: `💡 Что я умею (текстом или голосом):

📅 Записи
• «Запиши меня к Тане на маникюр завтра в 14»
• «Какие у меня записи?»
• «Отмени запись на завтра»
• «Перенеси на пятницу 16:00»

💰 Деньги
• «Сколько я потратила в этом месяце?»
• «Сколько у меня бонусов?»

👥 Мои мастера
• «Кто мои мастера?»

💬 Обратная связь
Хочешь сообщить о баге или предложить идею — начни со слов «жалоба» / «идея» / «не работает», или используй /feedback.`,
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
    return { ok: false, reply: '❌ У тебя нет мастеров в кабинете и ты ни на кого не подписан. Открой Mini App, найди мастера и подпишись.' };
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

  // Если клиент только подписан и нет clients-row — создаём её прозрачно.
  let clientId = target.client_id;
  if (!clientId) {
    clientId = await ensureClientRow(admin, profileId, target.master_id);
    if (!clientId) {
      return { ok: false, reply: `❌ Не удалось создать карточку клиента у ${target.master_display_name}. Попробуй из приложения.` };
    }
  }

  const { error } = await admin
    .from('appointments')
    .insert({
      master_id: target.master_id,
      client_id: clientId,
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
