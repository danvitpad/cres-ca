/** --- YAML
 * name: AI Voice Router
 * description: Единый endpoint для голосовых команд мастера. AI определяет intent и маршрутизирует:
 *              expense / inventory / reminder / note / question. Заменяет разрозненные regex-парсеры.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { aiChat } from '@/lib/ai/openrouter';

type Intent = 'expense' | 'inventory' | 'reminder' | 'note' | 'question' | 'unknown';

interface ExpenseData {
  amount: number;
  currency: string;
  category: string;
  description: string;
  vendor?: string;
}
interface InventoryData {
  item_hint: string;
  quantity: number;
  unit?: string;
}
interface ReminderData {
  text: string;
  delay_days: number;
}
interface NoteData {
  client_hint?: string;
  text: string;
}
interface QuestionData {
  query: string;
  answer?: string;
}

type IntentData = ExpenseData | InventoryData | ReminderData | NoteData | QuestionData;

const EXPENSE_CATEGORIES = [
  'Расходники', 'Аренда', 'Еда', 'Транспорт',
  'Коммунальные', 'Реклама', 'Оборудование', 'Прочее',
];

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Call Gemini via Google AI Studio (second key, optional). */
async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!key) return '';

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GOOGLE_AI_BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400, responseMimeType: 'application/json' },
        }),
      });
      if (res.status === 429 || !res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text.length > 2) return text;
    } catch {
      continue;
    }
  }
  return '';
}

/** Call OpenRouter as fallback. */
async function callOpenRouter(prompt: string): Promise<string> {
  try {
    return await aiChat(
      [
        { role: 'system', content: 'Ты JSON-классификатор. Отвечай ТОЛЬКО валидным JSON, без markdown, без комментариев, без бэктиков.' },
        { role: 'user', content: prompt },
      ],
      { model: 'openai/gpt-oss-120b:free', temperature: 0.3, maxTokens: 400 },
    );
  } catch {
    return '';
  }
}

async function classifyIntent(text: string, ctx: { services: string[]; currency: string }): Promise<{ intent: Intent; data: IntentData } | null> {
  const prompt = `Классифицируй команду мастера и верни JSON.

Команда: "${text}"

Услуги мастера: ${ctx.services.slice(0, 30).join(', ') || '—'}
Валюта: ${ctx.currency}

Возможные intent:
- "expense" — мастер говорит о покупке/трате денег. Пример: "Купил краску за 450". Данные: { amount: число, currency: "UAH"/"USD"/"EUR", category: одна из [${EXPENSE_CATEGORIES.join(', ')}], description: строка, vendor: строка или null }
- "inventory" — мастер говорит о списании расходника. Пример: "Потратил 200 мл геля". Данные: { item_hint: строка (название), quantity: число, unit: "ml"/"g"/"pcs"/"bottles"/"impulses"/"sessions" или null }
- "reminder" — мастер ставит напоминание. Пример: "Напомни через 3 дня позвонить Иванову". Данные: { text: строка напоминания, delay_days: число }
- "note" — мастер оставляет заметку о клиенте. Пример: "У Маши аллергия на ромашку". Данные: { client_hint: имя клиента или null, text: текст заметки }
- "question" — мастер задаёт вопрос. Пример: "Сколько я заработал сегодня?". Данные: { query: вопрос }
- "unknown" — не удалось определить

Верни ТОЛЬКО JSON вида: { "intent": "...", "data": {...} }
Никаких пояснений, markdown, бэктиков.`;

  let raw = await callGemini(prompt);
  if (!raw) raw = await callOpenRouter(prompt);
  if (!raw) return null;

  // Clean common wrappers
  raw = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.intent === 'string' && parsed.data) {
      return { intent: parsed.intent as Intent, data: parsed.data };
    }
  } catch {
    // Fall through
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { text, master_id }: { text?: string; master_id?: string } = body;

  if (!text || !master_id) {
    return NextResponse.json({ error: 'Missing text or master_id' }, { status: 400 });
  }

  // Verify ownership
  const { data: masterRow } = await supabase
    .from('masters')
    .select('id, profile_id')
    .eq('id', master_id)
    .single();

  if (!masterRow || masterRow.profile_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 13: гард по тарифу — voice_ai требует PRO+
  const { checkFeatureAccess } = await import('@/lib/subscription/feature-access');
  const access = await checkFeatureAccess(user.id, 'voice_ai');
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'feature_locked', feature: 'voice_ai', required_tier: 'pro', current_tier: access.tier },
      { status: 402 },
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Load master context (services names) for better classification
  const { data: services } = await admin
    .from('services')
    .select('name')
    .eq('master_id', master_id)
    .eq('is_active', true)
    .limit(40);
  const serviceNames = (services || []).map(s => s.name as string);

  const classified = await classifyIntent(text, { services: serviceNames, currency: 'UAH' });

  if (!classified) {
    return NextResponse.json({
      intent: 'unknown' as Intent,
      data: null,
      executed: false,
      message: 'Не удалось распознать команду. Попробуйте перефразировать.',
    });
  }

  const { intent, data } = classified;

  /* ─── Execute intent ─── */
  switch (intent) {
    case 'expense': {
      const d = data as ExpenseData;
      if (!d.amount || d.amount <= 0) {
        return NextResponse.json({ intent, data: d, executed: false, message: 'Не указана сумма расхода' });
      }
      const category = EXPENSE_CATEGORIES.includes(d.category) ? d.category : 'Прочее';
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await admin.from('expenses').insert({
        master_id,
        date: today,
        amount: d.amount,
        currency: d.currency || 'UAH',
        category,
        description: d.description || [category, d.vendor].filter(Boolean).join(' — '),
        vendor: d.vendor || null,
      });
      if (error) {
        return NextResponse.json({ intent, data: d, executed: false, message: `Ошибка: ${error.message}` });
      }
      return NextResponse.json({
        intent, data: d, executed: true,
        message: `Добавлен расход: ${d.amount} ${d.currency || 'UAH'} (${category})`,
      });
    }

    case 'inventory': {
      const d = data as InventoryData;
      if (!d.item_hint || !d.quantity) {
        return NextResponse.json({ intent, data: d, executed: false, message: 'Не указан материал или количество' });
      }
      const { data: candidates } = await admin
        .from('inventory_items')
        .select('id, name, quantity, unit')
        .eq('master_id', master_id)
        .ilike('name', `%${d.item_hint}%`)
        .limit(3);

      if (!candidates || candidates.length === 0) {
        return NextResponse.json({
          intent, data: d, executed: false,
          message: `Материал "${d.item_hint}" не найден в складе`,
        });
      }
      const best = candidates.find(c => d.unit && c.unit === d.unit) || candidates[0];
      const newQty = Math.max(0, Number(best.quantity) - d.quantity);
      await admin.from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', best.id);
      await admin.from('inventory_usage').insert({
        item_id: best.id,
        quantity_used: d.quantity,
        recorded_by: user.id,
      });
      return NextResponse.json({
        intent, data: d, executed: true,
        message: `Списано: ${d.quantity} ${best.unit || ''} из "${best.name}" (остаток ${newQty})`,
      });
    }

    case 'reminder': {
      const d = data as ReminderData;
      if (!d.text || d.delay_days < 0) {
        return NextResponse.json({ intent, data: d, executed: false, message: 'Некорректное напоминание' });
      }
      const when = new Date();
      when.setDate(when.getDate() + (d.delay_days || 0));
      const { error } = await admin.from('notifications').insert({
        profile_id: user.id,
        channel: 'push',
        title: 'Напоминание',
        body: d.text,
        data: { source: 'voice-router', original_text: text.slice(0, 200) },
        status: 'pending',
        scheduled_for: when.toISOString(),
      });
      if (error) {
        return NextResponse.json({ intent, data: d, executed: false, message: `Ошибка: ${error.message}` });
      }
      return NextResponse.json({
        intent, data: d, executed: true,
        message: `Напоминание через ${d.delay_days} дн.: ${d.text}`,
      });
    }

    case 'note': {
      const d = data as NoteData;
      if (!d.text) {
        return NextResponse.json({ intent, data: d, executed: false, message: 'Пустая заметка' });
      }
      // Try to link to client by name
      let clientId: string | null = null;
      if (d.client_hint) {
        const { data: clients } = await admin
          .from('clients')
          .select('id')
          .eq('master_id', master_id)
          .ilike('full_name', `%${d.client_hint}%`)
          .limit(1);
        clientId = clients?.[0]?.id || null;
      }
      // Insert as voice_note (if table exists) — otherwise fallback to client notes field
      if (clientId) {
        const { data: client } = await admin.from('clients').select('notes').eq('id', clientId).single();
        const existing = (client?.notes as string) || '';
        const stamped = `[${new Date().toLocaleDateString('ru-RU')}] ${d.text}`;
        await admin.from('clients').update({
          notes: existing ? `${existing}\n${stamped}` : stamped,
        }).eq('id', clientId);
        return NextResponse.json({
          intent, data: d, executed: true,
          message: `Заметка сохранена${d.client_hint ? ` для "${d.client_hint}"` : ''}`,
        });
      }
      return NextResponse.json({
        intent, data: d, executed: false,
        message: d.client_hint ? `Клиент "${d.client_hint}" не найден` : 'Укажите клиента в сообщении',
      });
    }

    case 'question': {
      const d = data as QuestionData;
      // For questions, delegate to AI with finance context
      const todayIso = new Date().toISOString().slice(0, 10);
      const [{ data: todayPayments }, { data: todayExpenses }] = await Promise.all([
        admin.from('payments').select('amount').eq('master_id', master_id).eq('status', 'completed').gte('created_at', `${todayIso}T00:00:00`),
        admin.from('expenses').select('amount').eq('master_id', master_id).eq('date', todayIso),
      ]);
      const revToday = (todayPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      const expToday = (todayExpenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0); // eslint-disable-line @typescript-eslint/no-explicit-any

      const answerPrompt = `Ответь кратко на вопрос мастера. Вопрос: "${d.query}".
Сегодня: доход ${revToday} UAH, расходы ${expToday} UAH.
Услуги: ${serviceNames.slice(0, 20).join(', ')}.
Ответь одним-двумя предложениями, без маркдауна.`;

      const answer = (await callOpenRouter(answerPrompt)) || 'Не могу ответить прямо сейчас.';
      return NextResponse.json({
        intent, data: { ...d, answer },
        executed: true, message: answer,
      });
    }

    case 'unknown':
    default:
      return NextResponse.json({
        intent: 'unknown', data: null, executed: false,
        message: 'Не удалось определить действие. Уточните команду.',
      });
  }
}
