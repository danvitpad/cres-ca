/** --- YAML
 * name: Web AI Assistant
 * description: Web counterpart of /api/telegram/m/assistant. Uses cookie auth (supabase
 *              server client), scopes all data strictly to auth.uid() → masters.id.
 *              Returns Gemini→OpenRouter answer and logs to ai_actions_log.
 * created: 2026-04-20
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { aiChat } from '@/lib/ai/openrouter';
import { parseTextIntent } from '@/lib/ai/gemini-voice';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_OR_MODELS = [
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

async function callGemini(system: string, history: ChatMessage[]): Promise<{ text: string; model: string }> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY;
  if (!key) return { text: '', model: '' };
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GOOGLE_AI_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.5, maxOutputTokens: 320 },
        }),
      });
      if (res.status === 429 || !res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (text.length > 2) return { text, model: `gemini/${model}` };
    } catch { continue; }
  }
  return { text: '', model: '' };
}

async function callOpenRouter(system: string, history: ChatMessage[]): Promise<{ text: string; model: string }> {
  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  for (const model of FALLBACK_OR_MODELS) {
    try {
      const text = (await aiChat(messages, { model, temperature: 0.5, maxTokens: 320 })) || '';
      if (text.trim().length > 2) return { text: text.trim(), model: `openrouter/${model}` };
    } catch { continue; }
  }
  return { text: '', model: '' };
}

export async function POST(request: Request) {
  // Cookie-based auth — strict: we never trust client-supplied profile_id.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { message, history } = body as { message?: string; history?: ChatMessage[] };
  if (!message || !message.trim()) return NextResponse.json({ error: 'missing_message' }, { status: 400 });

  // Admin client just for the read queries (RLS-wise we'd still get the right
  // rows — the auth.uid() scoping happens on master_id filter below).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  const { data: master } = await admin
    .from('masters')
    .select('id, vertical')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no_master' }, { status: 404 });

  // ── STEP 1: try parsing as an action (text command) ──
  // If the user said something like "потратил 500 на краску", execute it
  // directly instead of routing to Q&A chat.
  try {
    const intent = await parseTextIntent(message.trim());
    if (intent.action !== 'query' && intent.action !== 'unknown') {
      const result = await executeTextAction(admin, master.id, profile.id, intent);
      if (result) {
        await admin.from('ai_actions_log').insert({
          master_id: master.id,
          source: 'web',
          action_type: intent.action,
          input_text: message.trim().slice(0, 500),
          result: { answer: result.answer.slice(0, 2000) },
          status: result.ok ? 'success' : 'failed',
          error_message: result.ok ? null : result.answer.slice(0, 200),
        });
        return NextResponse.json({ answer: result.answer, action: intent.action, executed: result.ok });
      }
    }
  } catch {
    // Intent parsing failed — fall through to Q&A mode
  }

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const weekAgo = new Date(startOfToday.getTime() - 7 * 86400000);
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
    admin.from('appointments')
      .select('id, status, price, starts_at, service:service_id(name), client:client_id(full_name)')
      .eq('master_id', master.id)
      .gte('starts_at', startOfToday.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at', { ascending: true }),
    admin.from('appointments').select('status, price').eq('master_id', master.id).gte('starts_at', weekAgo.toISOString()),
    admin.from('manual_incomes').select('amount').eq('master_id', master.id).gte('date', weekAgoIso).lte('date', todayIso),
    admin.from('expenses').select('amount, category').eq('master_id', master.id).gte('date', weekAgoIso).lte('date', todayIso),
    admin.from('clients').select('id, full_name, total_visits, total_spent, last_visit_at').eq('master_id', master.id).order('total_spent', { ascending: false }).limit(8),
    admin.from('services').select('name, price').eq('master_id', master.id).eq('is_active', true).limit(20),
  ]);

  const todayList = (todayApts ?? []).map((a) => {
    const t = new Date(a.starts_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const svc = (a.service as { name?: string } | null)?.name || 'услуга';
    const cli = (a.client as { full_name?: string } | null)?.full_name || 'клиент';
    return `${t} · ${cli} · ${svc} · ${a.status}`;
  });
  const todayRevenue = (todayApts ?? []).filter((a) => a.status === 'completed').reduce((s, a) => s + Number(a.price ?? 0), 0);
  const weekApptRevenue = (weekApts ?? []).filter((a) => a.status === 'completed').reduce((s, a) => s + Number(a.price ?? 0), 0);
  const weekManualRevenue = (weekManual ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const weekExpTotal = (weekExpenses ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const dormantList = (topClients ?? []).filter((c) => {
    if (!c.last_visit_at) return false;
    const days = (now.getTime() - new Date(c.last_visit_at).getTime()) / 86400000;
    return days > 45;
  }).slice(0, 5).map((c) => `${c.full_name} (${Math.round((now.getTime() - new Date(c.last_visit_at!).getTime()) / 86400000)} дн.)`);
  const vipList = (topClients ?? []).slice(0, 3).map((c) => `${c.full_name} — ${c.total_visits ?? 0} виз., ${Math.round(Number(c.total_spent ?? 0))} ₴`);
  const svcList = (services ?? []).slice(0, 10).map((s) => `${s.name} (${s.price ?? '—'} ₴)`);
  const firstName = profile.full_name?.split(' ')[0] || 'мастер';

  const system = `Ты AI-ассистент мастера ${firstName} в CRM CRES-CA. Отвечай по делу, кратко (2–4 предложения), на языке вопроса, без markdown и списков. Если данных не хватает — честно скажи.

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

Правила:
- Используй только данные этого мастера. Никогда не упоминай чужих клиентов/мастеров.
- Не выдумывай цифр.
- Без эмодзи, без «отлично/молодец».`;

  const trimmedHistory = (history ?? []).slice(-6);
  const conv: ChatMessage[] = [...trimmedHistory, { role: 'user', content: message.trim() }];

  let ai = await callGemini(system, conv);
  if (!ai.text) ai = await callOpenRouter(system, conv);

  if (!ai.text) {
    await admin.from('ai_actions_log').insert({
      master_id: master.id,
      source: 'web',
      action_type: 'assistant_chat',
      input_text: message.trim().slice(0, 500),
      status: 'failed',
      error_message: 'ai_unavailable',
    });
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 });
  }

  await admin.from('ai_actions_log').insert({
    master_id: master.id,
    source: 'web',
    action_type: 'assistant_chat',
    input_text: message.trim().slice(0, 500),
    result: { answer: ai.text.slice(0, 2000), model: ai.model },
    status: 'success',
  });

  return NextResponse.json({ answer: ai.text, model: ai.model });
}

/**
 * Execute a text command from the /today chat.
 * Handles the "doing" intents (reminder, expense, revenue, client_note, etc.).
 * Complex flows that need inline buttons (supplier_order, appointment cancel/
 * reschedule) are redirected back to voice bot or dashboard.
 * Returns null if action not supported in text mode → caller falls to Q&A.
 */
async function executeTextAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  masterId: string,
  profileId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intent: any,
): Promise<{ ok: boolean; answer: string } | null> {
  switch (intent.action) {
    case 'reminder': {
      const { error } = await admin.from('reminders').insert({
        master_id: masterId,
        text: intent.text,
        due_at: intent.due_at,
        source: 'text',
      });
      if (error) return { ok: false, answer: `❌ Не удалось сохранить напоминание: ${error.message}` };
      const when = intent.due_at
        ? new Date(intent.due_at).toLocaleString('ru-RU', {
            timeZone: 'Europe/Kyiv', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
        : 'без даты';
      return { ok: true, answer: `✅ Напоминание: «${intent.text}» (${when})` };
    }

    case 'expense': {
      if (!intent.amount) return { ok: false, answer: '❓ Уточни сумму: «потратил 500 на краску».' };
      const { error } = await admin.from('expenses').insert({
        master_id: masterId,
        amount: intent.amount,
        currency: 'UAH',
        date: new Date().toISOString().slice(0, 10),
        description: intent.text,
        category: intent.category || 'Прочее',
      });
      if (error) return { ok: false, answer: `❌ Не удалось сохранить трату: ${error.message}` };
      return { ok: true, answer: `✅ Расход: ${intent.text} — ${intent.amount} ₴` };
    }

    case 'expense_recurring': {
      if (!intent.amount || !intent.day_of_month) {
        return { ok: false, answer: '❓ Нужна сумма и день месяца: «аренда 5000 каждое 1-е число».' };
      }
      const dom = Math.min(28, Math.max(1, Math.round(intent.day_of_month)));
      const { error } = await admin.from('recurring_expenses').insert({
        master_id: masterId,
        name: intent.text.slice(0, 80),
        amount: intent.amount,
        currency: 'UAH',
        category: intent.category || 'Прочее',
        day_of_month: dom,
        active: true,
      });
      if (error) return { ok: false, answer: `❌ ${error.message}` };
      return { ok: true, answer: `✅ Регулярный расход: ${intent.text} — ${intent.amount} ₴ каждое ${dom}-е число.` };
    }

    case 'revenue': {
      const items = Array.isArray(intent.items) ? intent.items : [];
      if (items.length === 0) {
        return { ok: false, answer: '❓ Скажи кто и сколько: «Аня стрижка 1200, Маша окрашивание 2500».' };
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      const rows = items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((it: any) => Number(it.amount) > 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => ({
          master_id: masterId,
          amount: Number(it.amount),
          currency: 'UAH',
          date: todayIso,
          description: `${it.service_name || 'Услуга'} — ${it.client_name || 'Клиент'}`,
          category: 'revenue_voice',
          source: 'text',
        }));
      if (rows.length === 0) return { ok: false, answer: '❓ Не понял суммы.' };
      const { error } = await admin.from('manual_incomes').insert(rows);
      if (error) return { ok: false, answer: `❌ ${error.message}` };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = rows.reduce((s: number, r: any) => s + Number(r.amount), 0);
      return { ok: true, answer: `✅ Записал ${rows.length} прихода на ${total} ₴.` };
    }

    case 'client_note': {
      if (!intent.client_name) return { ok: false, answer: '❓ Укажи имя клиента.' };
      const tokens = intent.client_name.trim().split(/\s+/).filter((t: string) => t.length >= 3);
      const or = tokens.length > 0
        ? tokens.map((t: string) => `full_name.ilike.%${t}%`).join(',')
        : `full_name.ilike.%${intent.client_name}%`;
      const { data: clients } = await admin
        .from('clients').select('id, full_name, notes').eq('master_id', masterId).or(or).limit(1);
      if (!clients || clients.length === 0) {
        return { ok: false, answer: `⚠️ Клиент «${intent.client_name}» не найден.` };
      }
      const c = clients[0];
      const stamp = `[${new Date().toLocaleDateString('ru-RU')}]`;
      const newNotes = c.notes ? `${c.notes}\n${stamp} ${intent.text}` : `${stamp} ${intent.text}`;
      await admin.from('clients').update({ notes: newNotes }).eq('id', c.id);
      return { ok: true, answer: `✅ Заметка к ${c.full_name}: «${intent.text}»` };
    }

    case 'inventory': {
      if (!intent.service_name || !intent.amount) {
        return { ok: false, answer: '❓ Скажи что и сколько: «списал 200 мл краски».' };
      }
      const { data: items } = await admin
        .from('inventory_items').select('id, name, quantity')
        .eq('master_id', masterId)
        .ilike('name', `%${intent.service_name}%`)
        .limit(1);
      if (!items || items.length === 0) {
        return { ok: false, answer: `⚠️ «${intent.service_name}» не найдено в складе.` };
      }
      const item = items[0];
      const newQty = Math.max(0, Number(item.quantity) - Number(intent.amount));
      await admin.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
      await admin.from('inventory_usage').insert({
        master_id: masterId,
        item_id: item.id,
        quantity: intent.amount,
        created_by: profileId,
      });
      return { ok: true, answer: `✅ Списано ${intent.amount} ед. ${item.name}. Остаток: ${newQty}.` };
    }

    case 'cancel':
    case 'reschedule':
    case 'supplier_order':
    case 'appointment':
    case 'create_client':
      // These need interactive buttons / multi-step flows — fall back to voice bot.
      return {
        ok: false,
        answer: '💡 Для записей клиентов и заказов поставщикам — отправь голосовое сообщение боту в Telegram. Там есть кнопки подтверждения.',
      };

    default:
      return null; // fall through to Q&A
  }
}
