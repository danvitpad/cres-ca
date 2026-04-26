/** --- YAML
 * name: Finance AI Question
 * description: POST { question } — мастер задаёт свободный вопрос своему AI-ассистенту
 *              в /finance. AI получает свежий контекст (доходы/расходы/тренды) и отвечает
 *              текстом. На текущем этапе — только Q&A, без write-actions; write-actions
 *              появятся вместе с UI undo (см. ai_actions_log table).
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiChat } from '@/lib/ai/openrouter';

const SYSTEM = `Ты финансовый помощник CRESCA для частного мастера сферы услуг.
Отвечаешь по-русски, очень кратко (3-5 коротких предложений). Никаких эмодзи,
бессмысленных похвал, маркеров. Если данных недостаточно — скажи прямо
«пока недостаточно данных, добавь записей и расходов». Когда даёшь
рекомендацию — называй конкретное число, а не общие фразы.`;

interface PaymentSummary { amount: number; type: string | null; created_at: string }
interface ExpenseSummary { amount: number; category: string | null; date: string }

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { question?: string } | null;
  const q = body?.question?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (q.length > 600) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  // Build a 30-day context the AI can reason about.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [{ data: pays }, { data: expsRaw }] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, type, created_at')
      .eq('master_id', master.id)
      .gte('created_at', sinceIso)
      .limit(200),
    supabase
      .from('expenses')
      .select('amount, category, date')
      .eq('master_id', master.id)
      .gte('date', sinceIso.slice(0, 10))
      .limit(200),
  ]);

  const payments = (pays as PaymentSummary[] | null) ?? [];
  const expenses = (expsRaw as ExpenseSummary[] | null) ?? [];
  const revenue = payments.filter((p) => p.type !== 'refund')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const cats: Record<string, number> = {};
  for (const e of expenses) {
    const c = e.category || 'Прочее';
    cats[c] = (cats[c] ?? 0) + Number(e.amount || 0);
  }

  const ctx = `КОНТЕКСТ (последние 30 дней)
Доходы: ${revenue} ₴ (${payments.length} платежей)
Расходы: ${totalExp} ₴ (${expenses.length} записей)
Чистая: ${revenue - totalExp} ₴
Расходы по категориям: ${JSON.stringify(cats)}

ВОПРОС МАСТЕРА:
${q}`;

  let answer = '';
  try {
    answer = await aiChat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: ctx },
    ], { temperature: 0.3, maxTokens: 220 });
  } catch (e) {
    console.error('[ai-question] aiChat fail:', e);
  }

  if (!answer || answer.length < 5) {
    return NextResponse.json({
      answer: 'Не получилось обработать запрос — попробуй ещё раз через минуту.',
    });
  }

  return NextResponse.json({ answer: answer.trim() });
}
