/** --- YAML
 * name: Client Behavior Analysis (AI)
 * description: Crunches a client's visit history into key signals (visits,
 *   spend, intervals, cancel rate, last seen) and asks the AI to return:
 *   - risk_level: low/medium/high — likelihood the client churns
 *   - vip_readiness: yes/maybe/no — is this client a VIP candidate
 *   - summary: 1-2 sentence plain-language read of behaviour
 *   - recommendations: 2-4 concrete actions the master can take
 *   MAX-tier feature.
 * created: 2026-05-01
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { textToJSON, extractJSON } from '@/lib/ai/router';

interface ClientStats {
  visits_total: number;
  visits_last_90d: number;
  cancelled_total: number;
  no_show_total: number;
  total_spent: number;
  avg_check: number;
  days_since_first_visit: number | null;
  days_since_last_visit: number | null;
  avg_interval_days: number | null;
  favourite_services: string[];
}

const SYSTEM_PROMPT = `Ты — деловой ассистент мастера услуг. На вход тебе дают
сырые числа поведения одного клиента. Твоя работа — выдать короткий, конкретный
отчёт на русском, который мастер сможет прочитать за 30 секунд.

ТРЕБОВАНИЯ К ОТВЕТУ:
- Только валидный JSON. Никаких markdown-обёрток, никаких комментариев.
- Поля строго:
  {
    "risk_level": "low" | "medium" | "high",
    "vip_readiness": "yes" | "maybe" | "no",
    "summary": "одно-два предложения, как у живого человека, без воды",
    "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
  }

ПРАВИЛА ОЦЕНКИ:
- risk_level "high" — если визитов >= 2 и от последнего прошло > 2× среднего интервала, или cancel rate > 25%, или no-show >= 1.
- risk_level "low" — если последний визит свежий (< среднего интервала) и cancel rate <= 10%.
- vip_readiness "yes" — visits_total >= 6 И avg_check выше типичного (свыше 1500 ₴) И no-show = 0.
- recommendations — обязательно конкретные действия (написать с предложением, дать промокод, предложить новую услугу), без общих слов.`;

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // verify ownership: master accessing one of their clients
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'no_master' }, { status: 403 });

  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name, master_id')
    .eq('id', id)
    .eq('master_id', master.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: apts } = await supabase
    .from('appointments')
    .select('id, status, starts_at, price, promo_discount_amount, bonus_redeemed, services(name)')
    .eq('client_id', id)
    .order('starts_at', { ascending: true });

  type Apt = {
    status: string;
    starts_at: string;
    price: number | null;
    promo_discount_amount: number | null;
    bonus_redeemed: number | null;
    services: { name: string } | null;
  };
  const list = (apts ?? []) as unknown as Apt[];

  const now = Date.now();
  const cutoff90d = now - 90 * 24 * 60 * 60 * 1000;
  const completed = list.filter((a) => a.status === 'completed');
  const completedDates = completed.map((a) => new Date(a.starts_at).getTime()).sort((a, b) => a - b);

  let avgInterval: number | null = null;
  if (completedDates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < completedDates.length; i++) {
      gaps.push((completedDates[i] - completedDates[i - 1]) / (24 * 60 * 60 * 1000));
    }
    avgInterval = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  const totalSpent = completed.reduce((s, a) =>
    s + Math.max(0, Number(a.price ?? 0) - Number(a.promo_discount_amount ?? 0) - Number(a.bonus_redeemed ?? 0)),
    0,
  );
  const avgCheck = completed.length > 0 ? Math.round(totalSpent / completed.length) : 0;

  const serviceCounts = new Map<string, number>();
  for (const a of completed) {
    const s = a.services?.name;
    if (!s) continue;
    serviceCounts.set(s, (serviceCounts.get(s) ?? 0) + 1);
  }
  const favouriteServices = Array.from(serviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const stats: ClientStats = {
    visits_total: completed.length,
    visits_last_90d: completed.filter((a) => new Date(a.starts_at).getTime() >= cutoff90d).length,
    cancelled_total: list.filter((a) => a.status === 'cancelled').length,
    no_show_total: list.filter((a) => a.status === 'no_show').length,
    total_spent: Math.round(totalSpent),
    avg_check: avgCheck,
    days_since_first_visit: completedDates.length > 0
      ? Math.round((now - completedDates[0]) / (24 * 60 * 60 * 1000))
      : null,
    days_since_last_visit: completedDates.length > 0
      ? Math.round((now - completedDates[completedDates.length - 1]) / (24 * 60 * 60 * 1000))
      : null,
    avg_interval_days: avgInterval,
    favourite_services: favouriteServices,
  };

  if (stats.visits_total === 0) {
    return NextResponse.json({
      stats,
      analysis: {
        risk_level: 'low',
        vip_readiness: 'no',
        summary: 'Это новый клиент — пока нет истории, чтобы делать выводы.',
        recommendations: [
          'Отправьте приветственное сообщение с услугами и ценами',
          'Предложите небольшую скидку на первый визит',
        ],
      },
      ai_used: false,
    });
  }

  // ask AI
  const userMessage = `Имя клиента: ${client.full_name ?? '—'}\n` +
    `Метрики:\n${JSON.stringify(stats, null, 2)}`;

  try {
    const res = await textToJSON({ systemPrompt: SYSTEM_PROMPT, userMessage });
    const parsed = extractJSON<{
      risk_level: 'low' | 'medium' | 'high';
      vip_readiness: 'yes' | 'maybe' | 'no';
      summary: string;
      recommendations: string[];
    }>(res.data);
    if (!parsed) {
      return NextResponse.json({
        error: 'ai_parse_failed',
        raw: res.data,
        stats,
      }, { status: 502 });
    }
    return NextResponse.json({ stats, analysis: parsed, ai_used: true, model: res.model });
  } catch (e) {
    return NextResponse.json({
      error: 'ai_unavailable',
      detail: (e as Error).message,
      stats,
    }, { status: 502 });
  }
}
