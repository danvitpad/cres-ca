/** --- YAML
 * name: Master Mini App AI Assistant
 * description: Conversational Q&A endpoint for the master. Authenticates via Telegram initData,
 *              loads compact business context (today / week / clients), forwards to Gemini→OpenRouter,
 *              logs to ai_actions_log as source=telegram_mini.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { resolveUserId } from '@/lib/auth/resolve-user';
import { aiChat } from '@/lib/ai/openrouter';

const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Единая цепочка моделей: самые сильные сверху, более слабые снизу.
// На каждый запрос идём по порядку — если модель упала / в лимите / зависла,
// переходим к следующей. Ответ берём от первой которая дала >2 символов.
//
// Тип 'gemini' — Google Generative Language API (env: GOOGLE_AI_STUDIO_KEY).
// Тип 'openrouter' — OpenRouter free-tier (env: OPENROUTER_API_KEY).
type ModelEntry =
  | { type: 'gemini'; id: string; reasoningTokens?: number }
  | { type: 'openrouter'; id: string; reasoningTokens?: number };

const MODEL_CHAIN: ModelEntry[] = [
  // 1. DeepSeek R1 — самая сильная свободная модель, reasoning-движок уровня o3.
  //    Медленнее остальных (10-30 сек), но если стоит первой — даёт лучший ответ.
  //    reasoningTokens=600 → даём место для внутренних рассуждений + финального ответа.
  { type: 'openrouter', id: 'deepseek/deepseek-r1-0528:free', reasoningTokens: 1200 },

  // 2. Qwen3 80B Instruct — быстрая и умная, отлично знает русский. Лучшая «не-reasoning» модель.
  { type: 'openrouter', id: 'qwen/qwen3-next-80b-a3b-instruct:free' },

  // 3. Nemotron 3 Super 120B — большая NVIDIA модель, сильный instruction-following.
  { type: 'openrouter', id: 'nvidia/nemotron-3-super-120b-a12b:free' },

  // 4. OpenAI gpt-oss-120b — open weights от OpenAI, проверенная.
  { type: 'openrouter', id: 'openai/gpt-oss-120b:free' },

  // 5. GLM-4.5 Air (Zhipu) — точная, русский ок.
  { type: 'openrouter', id: 'z-ai/glm-4.5-air:free' },

  // 6. Gemini 2.5 Flash — быстрый Google Flash, средняя сила, очень надёжный.
  { type: 'gemini', id: 'gemini-2.5-flash' },

  // 7. Gemini 2.0 Flash — старее, но всегда онлайн.
  { type: 'gemini', id: 'gemini-2.0-flash' },

  // 8. Llama 3.3 70B — последний рубеж. Старее остальных, но почти никогда не падает.
  { type: 'openrouter', id: 'meta-llama/llama-3.3-70b-instruct:free' },
];

// Таймаут на одну модель. R1 рассуждает дольше — даём ей 35с, остальным 20с.
const FAST_TIMEOUT_MS = 20_000;
const REASONING_TIMEOUT_MS = 35_000;

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
      generationConfig: { temperature: 0.5, maxOutputTokens: 320 },
    }),
  });
  if (res.status === 429 || !res.ok) return '';
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function tryOpenRouter(modelId: string, system: string, history: ChatMessage[], signal: AbortSignal, maxTokens: number): Promise<string> {
  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const text = (await aiChat(messages, { model: modelId, temperature: 0.5, maxTokens, signal })) || '';
  return text.trim();
}

async function runChain(system: string, history: ChatMessage[]): Promise<{ text: string; model: string }> {
  for (const entry of MODEL_CHAIN) {
    const timeoutMs = entry.reasoningTokens ? REASONING_TIMEOUT_MS : FAST_TIMEOUT_MS;
    const t = withTimeout(timeoutMs);
    try {
      const text = entry.type === 'gemini'
        ? await tryGemini(entry.id, system, history, t.signal)
        : await tryOpenRouter(entry.id, system, history, t.signal, entry.reasoningTokens ?? 320);
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

  const system = `Ты AI-ассистент мастера ${firstName} в CRM CRES-CA. Отвечай по делу, кратко (2–4 предложения), русским языком, без markdown и списков. Если данных не хватает — честно скажи и предложи что посмотреть.

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
- Используй данные. Не выдумывай цифр.
- Отвечай на языке вопроса.
- Если мастер спрашивает про конкретного клиента, которого нет в топ-списке — скажи, что нужно зайти в раздел «Клиенты».
- Без эмодзи в тексте. Без «отлично», «молодец».`;

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

  await admin.from('ai_actions_log').insert({
    master_id: master.id,
    source: 'telegram_mini',
    action_type: 'assistant_chat',
    input_text: message.trim().slice(0, 500),
    result: { answer: ai.text.slice(0, 2000), model: ai.model },
    status: 'success',
  });

  return NextResponse.json({ answer: ai.text, model: ai.model });
}
