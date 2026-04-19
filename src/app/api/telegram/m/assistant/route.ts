/** --- YAML
 * name: Master Mini App AI Assistant
 * description: Conversational Q&A endpoint for the master. Authenticates via Telegram initData,
 *              loads compact business context (today / week / clients), forwards to Gemini→OpenRouter,
 *              logs to ai_actions_log as source=telegram_mini.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';
import { aiChat } from '@/lib/ai/openrouter';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_OR_MODELS = [
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
    } catch {
      continue;
    }
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
    } catch {
      continue;
    }
  }
  return { text: '', model: '' };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { initData, message, history } = body as {
    initData?: string;
    message?: string;
    history?: ChatMessage[];
  };

  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });
  if (!message || !message.trim()) return NextResponse.json({ error: 'missing_message' }, { status: 400 });

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const tg = result.user;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_id', tg.id)
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

  let ai = await callGemini(system, conv);
  if (!ai.text) ai = await callOpenRouter(system, conv);

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
