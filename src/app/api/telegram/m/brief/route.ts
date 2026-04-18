/** --- YAML
 * name: Master Mini App Daily Brief API
 * description: LLM-generated daily brief for the Mini App home screen. One brief per master per day,
 *              cached in public.ai_briefs. Gemini first, OpenRouter fallback.
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
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

async function callGemini(prompt: string): Promise<{ text: string; model: string }> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY;
  if (!key) return { text: '', model: '' };

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GOOGLE_AI_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 180 },
        }),
      });
      if (res.status === 429) continue;
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (text.length > 10) return { text, model: `gemini/${model}` };
    } catch {
      continue;
    }
  }
  return { text: '', model: '' };
}

async function callOpenRouter(prompt: string): Promise<{ text: string; model: string }> {
  for (const model of FALLBACK_OR_MODELS) {
    try {
      const result = await aiChat(
        [{ role: 'user', content: prompt }],
        { model, temperature: 0.6, maxTokens: 180 },
      );
      const text = (result || '').trim();
      if (text.length > 10) return { text, model: `openrouter/${model}` };
    } catch {
      continue;
    }
  }
  return { text: '', model: '' };
}

async function callAI(prompt: string): Promise<{ text: string; model: string }> {
  const gem = await callGemini(prompt);
  if (gem.text) return gem;
  return await callOpenRouter(prompt);
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request: Request) {
  const { initData } = await request.json().catch(() => ({}));
  if (!initData) return NextResponse.json({ error: 'missing_init_data' }, { status: 400 });

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
  if (!profile) return NextResponse.json({ brief: null });

  const { data: master } = await admin
    .from('masters')
    .select('id, vertical')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ brief: null });

  const brief_date = todayIsoDate();

  // Check cache first
  const { data: cached } = await admin
    .from('ai_briefs')
    .select('brief_text')
    .eq('master_id', master.id)
    .eq('brief_date', brief_date)
    .maybeSingle();
  if (cached?.brief_text) {
    return NextResponse.json({ brief: cached.brief_text, cached: true });
  }

  // Gather signals for today + last 7 days
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [{ data: todayApts }, { data: weekPayments }, { data: topClients }] = await Promise.all([
    admin
      .from('appointments')
      .select('id, status, price, starts_at, service:service_id(name), client:client_id(profile:profile_id(full_name))')
      .eq('master_id', master.id)
      .gte('starts_at', startOfToday.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at', { ascending: true }),
    admin
      .from('payments')
      .select('amount, type, created_at')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('created_at', weekAgo.toISOString()),
    admin
      .from('clients')
      .select('id, total_visits, total_spent, last_visit_at')
      .eq('master_id', master.id)
      .order('total_spent', { ascending: false })
      .limit(5),
  ]);

  const todayCount = todayApts?.length ?? 0;
  const todayUpcoming = (todayApts ?? []).filter((a) => a.status !== 'completed' && a.status !== 'cancelled_by_client' && a.status !== 'cancelled_by_master' && a.status !== 'no_show');
  const todayDone = (todayApts ?? []).filter((a) => a.status === 'completed').length;
  const todayRevenue = (todayApts ?? [])
    .filter((a) => a.status === 'completed')
    .reduce((s, a) => s + Number(a.price ?? 0), 0);

  const weekRevenue = (weekPayments ?? [])
    .filter((p) => p.type !== 'refund')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const firstName = profile.full_name?.split(' ')[0] || 'мастер';
  const dormantCount = (topClients ?? []).filter((c) => {
    if (!c.last_visit_at) return false;
    const days = (now.getTime() - new Date(c.last_visit_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 45;
  }).length;

  // Zero-signal fallback — skip AI call
  if (todayCount === 0 && weekRevenue === 0 && (topClients?.length ?? 0) === 0) {
    return NextResponse.json({ brief: null, empty: true });
  }

  const prompt = `Ты AI-ассистент мастера в CRM CRES-CA. Напиши КОРОТКИЙ дневной бриф для мастера по имени ${firstName}.

ДАННЫЕ НА СЕГОДНЯ:
- Записей всего: ${todayCount} (выполнено ${todayDone}, осталось ${todayUpcoming.length})
- Выручка за сегодня: ${todayRevenue} ₴
- Выручка за последние 7 дней: ${weekRevenue} ₴
- Клиентов, не заходивших 45+ дней: ${dormantCount}

ПРАВИЛА:
- 2 коротких предложения, максимум 30 слов.
- Русский, без markdown, без списков, без вопросов.
- Конкретика по цифрам. Если тишина — мотивируй на 1 действие.
- Без "отлично", "молодец", "стабильный доход". Без эмодзи.
- Тон: умный друг-аналитик. Прямо, по делу.

Пример: "Сегодня 4 записи, 2 уже за плечами. Если все дойдут — закроешь день на 2400 ₴, это лучше вторника."`;

  const ai = await callAI(prompt);
  if (!ai.text) {
    return NextResponse.json({ brief: null, error: 'ai_unavailable' });
  }

  await admin.from('ai_briefs').upsert(
    {
      master_id: master.id,
      brief_date,
      brief_text: ai.text,
      model: ai.model,
    },
    { onConflict: 'master_id,brief_date' },
  );

  return NextResponse.json({ brief: ai.text, cached: false });
}
