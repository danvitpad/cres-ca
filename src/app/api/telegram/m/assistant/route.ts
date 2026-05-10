/** --- YAML
 * name: Master Mini App AI Assistant
 * description: Conversational endpoint for the master. Auth via Telegram initData. Loads compact
 *              business context, forwards to model chain (Qwen3 → Nemotron → gpt-oss → GLM-Air →
 *              Gemini → Llama). Model returns JSON {action, data, answer}. If action present —
 *              executes it server-side. Supported actions: expense, reminder, note, inventory,
 *              book, cancel, reschedule, broadcast. Logs everything to ai_actions_log.
 * created: 2026-04-19
 * updated: 2026-05-10
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { aiChat } from '@/lib/ai/openrouter';
import { sendMessage as sendTelegramMessage } from '@/lib/telegram/bot';

const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Единая цепочка моделей: самые сильные сверху, более слабые снизу.
// Только быстрые non-reasoning модели — отвечают за 1-3 секунды.
// На каждый запрос идём по порядку — если модель упала / в лимите / зависла,
// переходим к следующей. Ответ берём от первой которая дала >2 символов.
//
// Тип 'gemini' — Google Generative Language API (env: GOOGLE_AI_STUDIO_KEY).
// Тип 'openrouter' — OpenRouter free-tier (env: OPENROUTER_API_KEY).
type ModelEntry =
  | { type: 'gemini'; id: string }
  | { type: 'openrouter'; id: string };

const MODEL_CHAIN: ModelEntry[] = [
  // 1. Qwen3 80B Instruct — самая умная быстрая модель, отлично знает русский.
  { type: 'openrouter', id: 'qwen/qwen3-next-80b-a3b-instruct:free' },

  // 2. Nemotron 3 Super 120B — большая NVIDIA модель, сильный instruction-following.
  { type: 'openrouter', id: 'nvidia/nemotron-3-super-120b-a12b:free' },

  // 3. OpenAI gpt-oss-120b — open weights от OpenAI, проверенная.
  { type: 'openrouter', id: 'openai/gpt-oss-120b:free' },

  // 4. GLM-4.5 Air (Zhipu) — точная, русский ок.
  { type: 'openrouter', id: 'z-ai/glm-4.5-air:free' },

  // 5. Gemini 2.5 Flash — быстрый Google Flash, средняя сила, очень надёжный.
  { type: 'gemini', id: 'gemini-2.5-flash' },

  // 6. Gemini 2.0 Flash — старее, но всегда онлайн.
  { type: 'gemini', id: 'gemini-2.0-flash' },

  // 7. Llama 3.3 70B — последний рубеж. Старее остальных, но почти никогда не падает.
  { type: 'openrouter', id: 'meta-llama/llama-3.3-70b-instruct:free' },
];

// Таймаут на одну модель — если зависла, идём к следующей.
const MODEL_TIMEOUT_MS = 20_000;

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function tryGemini(modelId: string, system: string, history: ChatMessage[], signal: AbortSignal): Promise<string> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY;
  if (!key) return '';
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(`${GOOGLE_AI_BASE}/${modelId}:generateContent?key=${key}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (res.status === 429 || !res.ok) return '';
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function tryOpenRouter(modelId: string, system: string, history: ChatMessage[], signal: AbortSignal): Promise<string> {
  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const text = (await aiChat(messages, { model: modelId, temperature: 0.5, maxTokens: 600, signal })) || '';
  return text.trim();
}

async function runChain(system: string, history: ChatMessage[]): Promise<{ text: string; model: string }> {
  for (const entry of MODEL_CHAIN) {
    const t = withTimeout(MODEL_TIMEOUT_MS);
    try {
      const text = entry.type === 'gemini'
        ? await tryGemini(entry.id, system, history, t.signal)
        : await tryOpenRouter(entry.id, system, history, t.signal);
      if (text.length > 2) return { text, model: `${entry.type}/${entry.id}` };
    } catch {
      // 429, network, abort, parsing — идём к следующей модели
    } finally {
      t.clear();
    }
  }
  return { text: '', model: '' };
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { message, history } = body as {
    message?: string;
    history?: ChatMessage[];
  };

  if (!message || !message.trim()) return NextResponse.json({ error: 'missing_message' }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  const { data: master } = await admin
    .from('masters')
    .select('id, vertical')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no_master' }, { status: 404 });

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayIso = startOfToday.toISOString().slice(0, 10);
  const weekAgoIso = weekAgo.toISOString().slice(0, 10);

  const [
    { data: todayApts },
    { data: weekApts },
    { data: weekManual },
    { data: weekExpenses },
    { data: topClients },
    { data: services },
  ] = await Promise.all([
    admin
      .from('appointments')
      .select('id, status, price, starts_at, service:service_id(name), client:client_id(full_name)')
      .eq('master_id', master.id)
      .gte('starts_at', startOfToday.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at', { ascending: true }),
    admin
      .from('appointments')
      .select('status, price')
      .eq('master_id', master.id)
      .gte('starts_at', weekAgo.toISOString()),
    admin
      .from('manual_incomes')
      .select('amount')
      .eq('master_id', master.id)
      .gte('date', weekAgoIso)
      .lte('date', todayIso),
    admin
      .from('expenses')
      .select('amount, category')
      .eq('master_id', master.id)
      .gte('date', weekAgoIso)
      .lte('date', todayIso),
    admin
      .from('clients')
      .select('id, full_name, total_visits, total_spent, last_visit_at')
      .eq('master_id', master.id)
      .order('total_spent', { ascending: false })
      .limit(8),
    admin
      .from('services')
      .select('name, price')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .limit(20),
  ]);

  const todayList = (todayApts ?? []).map((a) => {
    const t = new Date(a.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const svc = (a.service as { name?: string } | null)?.name || 'услуга';
    const cli = (a.client as { full_name?: string } | null)?.full_name || 'клиент';
    return `${t} · ${cli} · ${svc} · ${a.status}`;
  });
  const todayRevenue = (todayApts ?? [])
    .filter((a) => a.status === 'completed')
    .reduce((s, a) => s + Number(a.price ?? 0), 0);

  const weekApptRevenue = (weekApts ?? [])
    .filter((a) => a.status === 'completed')
    .reduce((s, a) => s + Number(a.price ?? 0), 0);
  const weekManualRevenue = (weekManual ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const weekExpTotal = (weekExpenses ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const dormantList = (topClients ?? []).filter((c) => {
    if (!c.last_visit_at) return false;
    const days = (now.getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 45;
  }).slice(0, 5).map((c) => `${c.full_name} (${Math.round((now.getTime() - new Date(c.last_visit_at!).getTime()) / 86400000)} дн.)`);

  const vipList = (topClients ?? []).slice(0, 3).map((c) => `${c.full_name} — ${c.total_visits ?? 0} виз., ${Math.round(Number(c.total_spent ?? 0))} ₴`);
  const svcList = (services ?? []).slice(0, 10).map((s) => `${s.name} (${s.price ?? '—'} ₴)`);

  const firstName = profile.full_name?.split(' ')[0] || 'мастер';

  const tomorrowIso = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const system = `Ты AI-помощник мастера ${firstName} в CRES-CA. Отвечаешь как умный коллега: тепло, на «ты», коротко (1-3 предложения).

ВАЖНО: возвращаешь ТОЛЬКО JSON — никакого текста до или после, никакого markdown:

{ "action": null, "answer": "..." }                                ← вопрос или общение
{ "action": "expense", "data": {...}, "answer": "..." }            ← трата
{ "action": "reminder", "data": {...}, "answer": "..." }           ← напоминание
{ "action": "note", "data": {...}, "answer": "..." }               ← заметка про клиента
{ "action": "inventory", "data": {...}, "answer": "..." }          ← списание материала со склада
{ "action": "book", "data": {...}, "answer": "..." }               ← создать запись клиента
{ "action": "cancel", "data": {...}, "answer": "..." }             ← отменить запись клиента
{ "action": "reschedule", "data": {...}, "answer": "..." }         ← перенести запись
{ "action": "broadcast", "data": {...}, "answer": "..." }          ← отправить рассылку

КОГДА action="expense" (мастер потратил, купил, заплатил):
  data: { "amount": число, "currency": "UAH"|"USD"|"EUR", "category": "Расходники"|"Аренда"|"Еда"|"Транспорт"|"Коммунальные"|"Реклама"|"Оборудование"|"Прочее", "description": "коротко" }

КОГДА action="reminder" (просит напомнить):
  data: { "text": "что", "in_days": число (0=сегодня, 1=завтра, 7=через неделю) }

КОГДА action="note" (просит запомнить про клиента):
  data: { "client_hint": "имя", "text": "что" }

КОГДА action="inventory" (списать расходник со склада, "потратил 200мл геля", "ушло 3 баночки"):
  data: { "item_hint": "название материала", "quantity": число, "unit": "ml"|"g"|"pcs"|"bottles"|"impulses"|"sessions" или null }

КОГДА action="book" (создать запись на клиента):
  data: { "client_hint": "имя клиента", "service_hint": "название услуги или null если не сказал", "date": "YYYY-MM-DD", "time": "HH:MM" }
  Сегодня = ${todayIso}, завтра = ${tomorrowIso}. Конвертируй относительные даты в ISO.
  Если клиент новый — создадим автоматически по имени. Если услуги нет — возьмём первую активную.

КОГДА action="cancel" (отменить запись):
  data: { "client_hint": "имя клиента", "date": "YYYY-MM-DD" or null (берём ближайшую запись если null) }

КОГДА action="reschedule" (перенести запись):
  data: { "client_hint": "имя", "to_date": "YYYY-MM-DD", "to_time": "HH:MM" }

КОГДА action="broadcast" (мастер просит отправить рассылку клиентам):
  data: { "audience": "subscribers"|"favorites"|"all_clients", "subject": "тема или null", "body": "текст рассылки" }
  По умолчанию audience="subscribers" (подписчики мастера). all_clients = все клиенты в CRM.

КОГДА action=null:
  answer — короткий ответ по контексту ниже.
  Примеры: "За неделю 8400₴, это +15% к прошлой.", "Сегодня записей нет.", "У тебя 3 клиента: Тая, Даня, Денис."

ТОН в answer (КРИТИЧНО):
- Тепло, на «ты», как живой коллега. Кратко, без воды.
- БЕЗ канцелярита: НЕ "согласно данным CRM", НЕ "у вас зарегистрировано", НЕ "рекомендую открыть раздел"
- БЕЗ markdown, списков, эмодзи
- В подтверждении действия — что именно сделал: "Записал расход 500₴ на материалы.", "Создал запись Анне на завтра в 14:00.", "Отменил запись Дениса на сегодня.", "Отправил рассылку 47 подписчикам."

КОНТЕКСТ НА ${now.toLocaleDateString('ru')}:

СЕГОДНЯ (${todayList.length} записей):
${todayList.length ? todayList.join('\n') : 'пусто'}
Выручка за сегодня (выполнено): ${todayRevenue} ₴.

НЕДЕЛЯ:
- Выручка из записей: ${weekApptRevenue} ₴
- Ручной доход: ${weekManualRevenue} ₴
- Итого выручка: ${weekApptRevenue + weekManualRevenue} ₴
- Расходы: ${weekExpTotal} ₴
- Прибыль: ${weekApptRevenue + weekManualRevenue - weekExpTotal} ₴

ТОП-КЛИЕНТЫ:
${vipList.join('\n') || 'нет данных'}

СПЯЩИЕ (45+ дней):
${dormantList.join('\n') || 'нет'}

УСЛУГИ:
${svcList.join(', ') || '—'}

Используй данные из контекста. Не выдумывай цифр и имён.`;

  const trimmedHistory = (history ?? []).slice(-6);
  const conv: ChatMessage[] = [...trimmedHistory, { role: 'user', content: message.trim() }];

  const ai = await runChain(system, conv);

  if (!ai.text) {
    await admin.from('ai_actions_log').insert({
      master_id: master.id,
      source: 'telegram_mini',
      action_type: 'assistant_chat',
      input_text: message.trim().slice(0, 500),
      status: 'failed',
      error_message: 'ai_unavailable',
    });
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 });
  }

  // Парсим JSON-ответ модели. Если не JSON — используем текст как answer без action.
  const parsed = parseAiOutput(ai.text);
  let answer = parsed.answer;
  let executedAction: string | null = null;

  // Выполняем action если он есть и валиден.
  if (parsed.action === 'expense' && parsed.data) {
    const d = parsed.data as { amount?: number; currency?: string; category?: string; description?: string };
    if (typeof d.amount === 'number' && d.amount > 0) {
      const allowedCats = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];
      const category = allowedCats.includes(d.category || '') ? d.category! : 'Прочее';
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await admin.from('expenses').insert({
        master_id: master.id,
        date: today,
        amount: d.amount,
        currency: d.currency || 'UAH',
        category,
        description: d.description || category,
      });
      if (!error) executedAction = 'expense';
      else answer = `Не получилось записать расход: ${error.message}`;
    }
  } else if (parsed.action === 'reminder' && parsed.data) {
    const d = parsed.data as { text?: string; in_days?: number };
    if (d.text && typeof d.in_days === 'number' && d.in_days >= 0) {
      const when = new Date();
      when.setDate(when.getDate() + d.in_days);
      const { error } = await admin.from('notifications').insert({
        profile_id: profile.id,
        channel: 'push',
        title: 'Напоминание',
        body: d.text,
        data: { source: 'mini-app-assistant', original_text: message.slice(0, 200) },
        status: 'pending',
        scheduled_for: when.toISOString(),
      });
      if (!error) executedAction = 'reminder';
      else answer = `Не получилось создать напоминание: ${error.message}`;
    }
  } else if (parsed.action === 'note' && parsed.data) {
    const d = parsed.data as { client_hint?: string; text?: string };
    if (d.client_hint && d.text) {
      const { data: matches } = await admin.rpc('find_master_clients', {
        p_master_id: master.id,
        p_query: d.client_hint,
        p_limit: 1,
      });
      const clientId = (matches as Array<{ id: string }> | null)?.[0]?.id;
      if (clientId) {
        const { data: client } = await admin.from('clients').select('notes').eq('id', clientId).maybeSingle<{ notes: string | null }>();
        const existing = client?.notes ?? '';
        const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const stamped = `[${stamp}] ${d.text}`;
        await admin.from('clients').update({
          notes: existing ? `${existing}\n${stamped}` : stamped,
        }).eq('id', clientId);
        executedAction = 'note';
      } else {
        answer = `Не нашёл клиента "${d.client_hint}" — попробуй точное имя или фамилию.`;
      }
    }
  } else if (parsed.action === 'inventory' && parsed.data) {
    const d = parsed.data as { item_hint?: string; quantity?: number; unit?: string };
    if (d.item_hint && typeof d.quantity === 'number' && d.quantity > 0) {
      const { data: candidates } = await admin
        .from('inventory_items')
        .select('id, name, quantity, unit')
        .eq('master_id', master.id)
        .ilike('name', `%${d.item_hint}%`)
        .limit(3);
      if (candidates && candidates.length > 0) {
        const best = candidates.find((c) => d.unit && c.unit === d.unit) || candidates[0];
        const newQty = Math.max(0, Number(best.quantity) - d.quantity);
        await admin.from('inventory_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', best.id);
        await admin.from('inventory_usage').insert({ item_id: best.id, quantity_used: d.quantity, recorded_by: profile.id });
        executedAction = 'inventory';
        answer = `Списал ${d.quantity}${best.unit ? ' ' + best.unit : ''} из «${best.name}». Остаток: ${newQty}.`;
      } else {
        answer = `Не нашёл материал «${d.item_hint}» на складе. Добавь его в Услуги → Склад.`;
      }
    }
  } else if (parsed.action === 'book' && parsed.data) {
    const d = parsed.data as { client_hint?: string; service_hint?: string; date?: string; time?: string };
    if (d.client_hint && d.date && d.time && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{1,2}:\d{2}$/.test(d.time)) {
      // 1. Найти или создать клиента
      let clientId: string | null = null;
      const { data: matches } = await admin.rpc('find_master_clients', {
        p_master_id: master.id, p_query: d.client_hint, p_limit: 1,
      });
      clientId = (matches as Array<{ id: string }> | null)?.[0]?.id ?? null;
      if (!clientId) {
        const { data: created } = await admin.from('clients')
          .insert({ master_id: master.id, full_name: d.client_hint })
          .select('id').single();
        clientId = created?.id ?? null;
      }
      if (!clientId) {
        answer = `Не получилось найти или создать клиента «${d.client_hint}».`;
      } else {
        // 2. Найти услугу (либо по hint, либо первую активную)
        let svc: { id: string; duration_minutes: number; price: number } | null = null;
        if (d.service_hint) {
          const { data: svcRow } = await admin.from('services')
            .select('id, duration_minutes, price')
            .eq('master_id', master.id).eq('is_active', true)
            .ilike('name', `%${d.service_hint}%`).limit(1).maybeSingle<{ id: string; duration_minutes: number; price: number }>();
          svc = svcRow;
        }
        if (!svc) {
          const { data: anySvc } = await admin.from('services')
            .select('id, duration_minutes, price')
            .eq('master_id', master.id).eq('is_active', true)
            .limit(1).maybeSingle<{ id: string; duration_minutes: number; price: number }>();
          svc = anySvc;
        }
        const duration = svc?.duration_minutes || 60;
        const price = svc?.price || 0;
        const startsAt = new Date(`${d.date}T${d.time.padStart(5, '0')}:00`);
        const endsAt = new Date(startsAt.getTime() + duration * 60_000);
        // 3. Проверка на конфликт
        const { data: conflict } = await admin.from('appointments')
          .select('id').eq('master_id', master.id)
          .not('status', 'in', '(cancelled,rejected,no_show)')
          .lt('starts_at', endsAt.toISOString())
          .gt('ends_at', startsAt.toISOString())
          .limit(1).maybeSingle();
        if (conflict) {
          answer = `На ${d.date} в ${d.time} уже есть запись — выбери другое время.`;
        } else {
          const { error } = await admin.from('appointments').insert({
            master_id: master.id, client_id: clientId,
            service_id: svc?.id ?? null,
            starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
            status: 'booked', price, currency: 'UAH',
            created_by_role: 'ai_assistant',
          });
          if (error) answer = `Не получилось создать запись: ${error.message}`;
          else executedAction = 'book';
        }
      }
    }
  } else if (parsed.action === 'cancel' && parsed.data) {
    const d = parsed.data as { client_hint?: string; date?: string };
    if (d.client_hint) {
      const { data: matches } = await admin.rpc('find_master_clients', {
        p_master_id: master.id, p_query: d.client_hint, p_limit: 1,
      });
      const clientId = (matches as Array<{ id: string }> | null)?.[0]?.id;
      if (!clientId) {
        answer = `Не нашёл клиента «${d.client_hint}».`;
      } else {
        let q = admin.from('appointments')
          .select('id, starts_at')
          .eq('master_id', master.id).eq('client_id', clientId)
          .not('status', 'in', '(cancelled,rejected,completed,no_show)')
          .order('starts_at', { ascending: true });
        if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
          q = q.gte('starts_at', `${d.date}T00:00:00`).lt('starts_at', `${d.date}T23:59:59`);
        } else {
          q = q.gte('starts_at', new Date().toISOString());
        }
        const { data: appt } = await q.limit(1).maybeSingle<{ id: string; starts_at: string }>();
        if (!appt) {
          answer = `Не нашёл активную запись клиента «${d.client_hint}»${d.date ? ` на ${d.date}` : ''}.`;
        } else {
          const { error } = await admin.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
          if (error) answer = `Не получилось отменить: ${error.message}`;
          else executedAction = 'cancel';
        }
      }
    }
  } else if (parsed.action === 'reschedule' && parsed.data) {
    const d = parsed.data as { client_hint?: string; to_date?: string; to_time?: string };
    if (d.client_hint && d.to_date && d.to_time && /^\d{4}-\d{2}-\d{2}$/.test(d.to_date) && /^\d{1,2}:\d{2}$/.test(d.to_time)) {
      const { data: matches } = await admin.rpc('find_master_clients', {
        p_master_id: master.id, p_query: d.client_hint, p_limit: 1,
      });
      const clientId = (matches as Array<{ id: string }> | null)?.[0]?.id;
      if (!clientId) {
        answer = `Не нашёл клиента «${d.client_hint}».`;
      } else {
        const { data: appt } = await admin.from('appointments')
          .select('id, starts_at, ends_at')
          .eq('master_id', master.id).eq('client_id', clientId)
          .not('status', 'in', '(cancelled,rejected,completed,no_show)')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(1).maybeSingle<{ id: string; starts_at: string; ends_at: string }>();
        if (!appt) {
          answer = `Нет активной записи клиента «${d.client_hint}» которую можно перенести.`;
        } else {
          const oldDuration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
          const newStart = new Date(`${d.to_date}T${d.to_time.padStart(5, '0')}:00`);
          const newEnd = new Date(newStart.getTime() + oldDuration);
          // Проверка конфликта (исключая саму перемещаемую запись)
          const { data: conflict } = await admin.from('appointments')
            .select('id').eq('master_id', master.id).neq('id', appt.id)
            .not('status', 'in', '(cancelled,rejected,no_show)')
            .lt('starts_at', newEnd.toISOString())
            .gt('ends_at', newStart.toISOString())
            .limit(1).maybeSingle();
          if (conflict) {
            answer = `На ${d.to_date} в ${d.to_time} уже есть другая запись.`;
          } else {
            const { error } = await admin.from('appointments').update({
              starts_at: newStart.toISOString(), ends_at: newEnd.toISOString(),
            }).eq('id', appt.id);
            if (error) answer = `Не получилось перенести: ${error.message}`;
            else executedAction = 'reschedule';
          }
        }
      }
    }
  } else if (parsed.action === 'broadcast' && parsed.data) {
    const d = parsed.data as { audience?: string; subject?: string; body?: string };
    const audience = (['subscribers', 'favorites', 'all_clients'].includes(d.audience || '') ? d.audience : 'subscribers') as 'subscribers' | 'favorites' | 'all_clients';
    if (!d.body || !d.body.trim()) {
      answer = 'Текст рассылки пустой — повтори с текстом.';
    } else {
      const recipientIds = await resolveBroadcastRecipients(master.id, audience);
      if (recipientIds.length === 0) {
        answer = 'В выбранной аудитории нет получателей.';
      } else {
        const { data: bc } = await admin.from('master_broadcasts').insert({
          master_id: master.id,
          subject: d.subject?.trim() || null,
          body: d.body.trim(),
          audience,
          recipients_count: recipientIds.length,
          status: 'sending',
          sent_at: new Date().toISOString(),
        }).select('id').single<{ id: string }>();
        if (bc?.id) {
          await admin.from('master_broadcast_deliveries').insert(
            recipientIds.map((pid) => ({ broadcast_id: bc.id, profile_id: pid })),
          );
          // Fire-and-forget fanout
          void fanoutBroadcast(bc.id, recipientIds, d.subject?.trim() ?? null, d.body.trim(), firstName);
          executedAction = 'broadcast';
          answer = `Отправил рассылку ${recipientIds.length} ${audience === 'subscribers' ? 'подписчикам' : audience === 'favorites' ? 'избранным' : 'клиентам'}.`;
        } else {
          answer = 'Не получилось создать рассылку.';
        }
      }
    }
  }

  await admin.from('ai_actions_log').insert({
    master_id: master.id,
    source: 'telegram_mini',
    action_type: executedAction ? `assistant_${executedAction}` : 'assistant_chat',
    input_text: message.trim().slice(0, 500),
    result: { answer: answer.slice(0, 2000), model: ai.model, action: executedAction },
    status: 'success',
  });

  return NextResponse.json({ answer, model: ai.model, action: executedAction });
}

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Получатели рассылки — те же 3 аудитории что в /api/marketing/broadcast. */
async function resolveBroadcastRecipients(
  masterId: string,
  audience: 'subscribers' | 'favorites' | 'all_clients',
): Promise<string[]> {
  const admin = makeAdmin();
  if (audience === 'subscribers') {
    const { data } = await admin.from('client_master_links').select('profile_id').eq('master_id', masterId);
    return (data ?? []).map((r) => r.profile_id as string).filter(Boolean);
  }
  if (audience === 'favorites') {
    const { data } = await admin.from('client_favorites').select('profile_id').eq('master_id', masterId);
    return (data ?? []).map((r) => r.profile_id as string).filter(Boolean);
  }
  const { data } = await admin.from('clients').select('profile_id').eq('master_id', masterId).not('profile_id', 'is', null);
  return (data ?? []).map((r) => r.profile_id as string).filter(Boolean);
}

/** Fire-and-forget рассылка в TG. Берём telegram_id для тех у кого он есть, остальным
 *  пишем в notifications (видно в Mini App inbox). */
async function fanoutBroadcast(
  broadcastId: string,
  recipientIds: string[],
  subject: string | null,
  body: string,
  masterName: string,
): Promise<void> {
  const admin = makeAdmin();
  try {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, telegram_id')
      .in('id', recipientIds);
    const tgMap = new Map<string, string>();
    for (const p of (profiles ?? []) as Array<{ id: string; telegram_id: string | null }>) {
      if (p.telegram_id) tgMap.set(p.id, p.telegram_id);
    }
    const tgTitle = subject ? `*${subject}*\n\n` : '';
    const tgText = `${tgTitle}${body}\n\n— ${masterName}`;
    let delivered = 0;
    let failed = 0;
    for (const pid of recipientIds) {
      const tgId = tgMap.get(pid);
      let ok = false;
      if (tgId) {
        try {
          await sendTelegramMessage(tgId, tgText, { parse_mode: 'Markdown' });
          ok = true;
        } catch { /* ignore individual failures */ }
      }
      await admin.from('notifications').insert({
        profile_id: pid,
        channel: tgId ? 'telegram' : 'web',
        title: subject || `Сообщение от ${masterName}`,
        body,
        scheduled_for: new Date().toISOString(),
        data: { broadcast_id: broadcastId, kind: 'master_broadcast' },
      });
      if (!tgId) ok = true;
      await admin.from('master_broadcast_deliveries')
        .update({ delivered: ok, delivered_at: ok ? new Date().toISOString() : null })
        .eq('broadcast_id', broadcastId).eq('profile_id', pid);
      if (ok) delivered++; else failed++;
    }
    await admin.from('master_broadcasts')
      .update({ status: 'sent', delivered_count: delivered, failed_count: failed })
      .eq('id', broadcastId);
  } catch {
    // Если что-то совсем сломалось — оставляем broadcast в status='sending'
  }
}

/** Defensive JSON parser — модель может вернуть либо чистый JSON, либо JSON в ```-блоке,
 *  либо просто текст. Если JSON распарсился — берём оттуда action+data+answer. Если нет —
 *  весь raw текст идёт как answer без action. */
function parseAiOutput(raw: string): {
  action: string | null;
  data: Record<string, unknown> | null;
  answer: string;
} {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      action?: unknown;
      data?: unknown;
      answer?: unknown;
    };
    if (parsed && typeof parsed === 'object') {
      return {
        action: typeof parsed.action === 'string' ? parsed.action : null,
        data: (parsed.data && typeof parsed.data === 'object') ? parsed.data as Record<string, unknown> : null,
        answer: typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer.trim() : raw,
      };
    }
  } catch {
    // не JSON — возвращаем raw как answer
  }

  return { action: null, data: null, answer: raw };
}
