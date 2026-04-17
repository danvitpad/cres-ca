/** --- YAML
 * name: Finance AI Insights API
 * description: AI-powered financial insights — period summaries, expense categorization, price recommendations, forecasts.
 *              Uses Google AI Studio (second key) to distribute load away from main OpenRouter key.
 * created: 2026-04-17
 * --- */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiChat } from '@/lib/ai/openrouter';

const GOOGLE_AI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

type InsightType = 'period_summary' | 'expense_categorize' | 'price_recommendation' | 'forecast';

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!key) return '';

  try {
    const res = await fetch(`${GOOGLE_AI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    });

    if (!res.ok) {
      console.error('[Finance AI] Gemini error:', res.status, await res.text());
      return '';
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    console.error('[Finance AI] Gemini call failed:', err);
    return '';
  }
}

async function callOpenRouter(prompt: string): Promise<string> {
  try {
    return await aiChat([
      { role: 'system', content: 'You are a financial analyst AI for a service business CRM. Respond in the same language as the user data (Ukrainian/Russian). Be concise — 2-3 sentences.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, maxTokens: 300 });
  } catch {
    return '';
  }
}

/** Try Google AI Studio first, fallback to OpenRouter */
async function callAI(prompt: string): Promise<string> {
  let result = await callGemini(prompt);
  if (!result) {
    result = await callOpenRouter(prompt);
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { type, master_id, period, data: extraData } = await req.json() as {
      type: InsightType;
      master_id: string;
      period?: string;
      data?: Record<string, unknown>;
    };

    if (!master_id || !type) {
      return NextResponse.json({ error: 'Missing master_id or type' }, { status: 400 });
    }

    const supabase = await createClient();

    let prompt = '';

    switch (type) {
      case 'period_summary': {
        // Fetch summary data for AI context
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, type, payment_method, created_at')
          .eq('master_id', master_id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount, category, date')
          .eq('master_id', master_id)
          .order('date', { ascending: false })
          .limit(50);

        const totalRevenue = (payments || [])
          .filter((p: any) => p.type !== 'refund')
          .reduce((s: number, p: any) => s + Number(p.amount), 0);

        const totalExpenses = (expenses || [])
          .reduce((s: number, e: any) => s + Number(e.amount), 0);

        const categoryCounts: Record<string, number> = {};
        for (const e of (expenses || []) as any[]) {
          const cat = e.category || 'Прочее';
          categoryCounts[cat] = (categoryCounts[cat] || 0) + Number(e.amount);
        }

        const methodCounts: Record<string, number> = {};
        for (const p of (payments || []) as any[]) {
          const m = p.payment_method || 'other';
          methodCounts[m] = (methodCounts[m] || 0) + 1;
        }

        prompt = `Проанализируй финансы мастера за период "${period || 'month'}":

Доходы: ${totalRevenue} UAH (${(payments || []).length} платежей)
Расходы: ${totalExpenses} UAH
Чистая прибыль: ${totalRevenue - totalExpenses} UAH
Категории расходов: ${JSON.stringify(categoryCounts)}
Методы оплаты: ${JSON.stringify(methodCounts)}

Дай 2-3 коротких инсайта: что хорошо, что можно улучшить, на что обратить внимание. Ответ на русском, без форматирования, простым текстом.`;
        break;
      }

      case 'expense_categorize': {
        const { description, vendor } = extraData as { description?: string; vendor?: string };
        prompt = `Определи категорию расхода для бьюти-мастера.
Описание: "${description || ''}"
Поставщик: "${vendor || ''}"

Выбери ОДНУ из категорий: Расходники, Аренда, Еда, Транспорт, Коммунальные, Реклама, Оборудование, Прочее.
Ответь только названием категории, без пояснений.`;
        break;
      }

      case 'price_recommendation': {
        const { service_name, cost, current_price } = extraData as {
          service_name?: string; cost?: number; current_price?: number;
        };
        prompt = `Для бьюти-услуги "${service_name}":
Себестоимость: ${cost} UAH
Текущая цена: ${current_price} UAH
Маржа: ${current_price && cost ? Math.round(((current_price - cost) / current_price) * 100) : '?'}%

Дай рекомендацию по оптимальной цене (целевая маржа 60-70% для бьюти). Ответ на русском, 1-2 предложения.`;
        break;
      }

      case 'forecast': {
        const { data: recentPayments } = await supabase
          .from('payments')
          .select('amount, created_at')
          .eq('master_id', master_id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(100);

        const weeklyTotals: Record<string, number> = {};
        for (const p of (recentPayments || []) as any[]) {
          const week = p.created_at.slice(0, 10);
          weeklyTotals[week] = (weeklyTotals[week] || 0) + Number(p.amount);
        }

        prompt = `На основе последних платежей мастера (${(recentPayments || []).length} транзакций):
Суммы по дням (последние): ${JSON.stringify(Object.entries(weeklyTotals).slice(0, 14))}

Спрогнозируй доход на следующую неделю и месяц. Ответ на русском, 2-3 предложения. Будь конкретен с числами.`;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown insight type: ${type}` }, { status: 400 });
    }

    const insight = await callAI(prompt);

    if (!insight) {
      return NextResponse.json({
        insight: 'AI-анализ временно недоступен. Проверьте ключи API.',
      });
    }

    return NextResponse.json({ insight });
  } catch (err) {
    console.error('[Finance AI Insights] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
