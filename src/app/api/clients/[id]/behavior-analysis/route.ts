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

const SYSTEM_PROMPT = `Ты — деловой ассистент мастера услуг. На вход дают
числа поведения одного клиента. Твоя работа — короткий конкретный отчёт
на русском.

КРИТИЧНО ВАЖНО: ответь ТОЛЬКО валидным JSON-объектом. Никакого текста до
JSON, никакого после. Никаких \`\`\`-блоков. Никаких пояснений. Сразу { ... }.

Точный шаблон ответа:
{"risk_level":"low","vip_readiness":"no","summary":"одно-два предложения","recommendations":["действие 1","действие 2","действие 3"]}

Допустимые значения:
- risk_level: "low" | "medium" | "high"
- vip_readiness: "yes" | "maybe" | "no"
- recommendations: массив из 2-4 строк, каждая — конкретное действие

Логика оценки:
- risk_level "high" если визитов >= 2 и от последнего прошло > 2× среднего интервала, или отмен > 25%, или есть пропуски визитов
- risk_level "low" если последний визит свежий и отмен мало
- vip_readiness "yes" если visits_total >= 6 И avg_check >= 1500 И не пропускал визиты
- recommendations — конкретные действия (написать клиенту X, дать промокод Y, предложить услугу Z), без воды

Внутри строк используй только обычные кавычки (никаких "ёлочек" «»). Не ставь запятые после последнего элемента массива или объекта.`;

interface ParsedAnalysis {
  risk_level: 'low' | 'medium' | 'high';
  vip_readiness: 'yes' | 'maybe' | 'no';
  summary: string;
  recommendations: string[];
}

function ruleBasedFallback(stats: ClientStats): ParsedAnalysis {
  const recs: string[] = [];

  // risk
  let risk: ParsedAnalysis['risk_level'] = 'low';
  if (stats.no_show_total >= 1 || (stats.cancelled_total / Math.max(1, stats.visits_total + stats.cancelled_total)) > 0.25) {
    risk = 'high';
  } else if (
    stats.visits_total >= 2 && stats.avg_interval_days &&
    stats.days_since_last_visit && stats.days_since_last_visit > stats.avg_interval_days * 2
  ) {
    risk = 'high';
  } else if (stats.days_since_last_visit && stats.days_since_last_visit > 60) {
    risk = 'medium';
  }

  // vip
  const vip: ParsedAnalysis['vip_readiness'] =
    stats.visits_total >= 6 && stats.avg_check >= 1500 && stats.no_show_total === 0 ? 'yes'
    : stats.visits_total >= 4 && stats.avg_check >= 800 ? 'maybe'
    : 'no';

  // summary
  let summary = `Визитов: ${stats.visits_total}, средний чек ${stats.avg_check} ₴.`;
  if (stats.days_since_last_visit !== null) {
    summary += ` Последний визит ${stats.days_since_last_visit} дн. назад.`;
  }
  if (stats.no_show_total > 0) summary += ` Не приходил: ${stats.no_show_total}.`;

  // recommendations
  if (risk === 'high') {
    recs.push('Напишите клиенту лично — спросите, всё ли в порядке, и предложите удобное время');
    recs.push('Дайте небольшую скидку или бонус, чтобы вернуть его');
  } else if (vip === 'yes' || vip === 'maybe') {
    recs.push('Предложите VIP-условия: приоритетный слот или повышенный кэшбек');
    if (stats.favourite_services.length > 0) {
      recs.push(`Расскажите о новой услуге, дополняющей «${stats.favourite_services[0]}»`);
    }
  } else if (stats.visits_total === 0) {
    recs.push('Отправьте приветственное сообщение со списком услуг и ценами');
  } else {
    recs.push('Напомните о себе через 1-2 недели — короткое сообщение с предложением записи');
    if (stats.favourite_services.length > 0) {
      recs.push(`Предложите попробовать что-то ещё, кроме «${stats.favourite_services[0]}»`);
    }
  }

  return { risk_level: risk, vip_readiness: vip, summary, recommendations: recs };
}

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

  // ask AI. Если AI не дал валидный JSON — используем rule-based fallback,
  // чтобы пользователь всегда получал содержательный ответ (мастеру важно
  // увидеть оценку, а не «попробуйте позже»).
  const userMessage = `Имя клиента: ${client.full_name ?? '—'}\n` +
    `Метрики:\n${JSON.stringify(stats, null, 2)}`;

  try {
    const res = await textToJSON({ systemPrompt: SYSTEM_PROMPT, userMessage });
    const parsed = extractJSON<ParsedAnalysis>(res.data);
    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.recommendations)) {
      return NextResponse.json({ stats, analysis: parsed, ai_used: true, model: res.model });
    }
    // AI ответил мусором — отдаём rule-based анализ (без обмана пользователя:
    // ai_used=false показывает что это не AI-вывод)
    return NextResponse.json({
      stats,
      analysis: ruleBasedFallback(stats),
      ai_used: false,
      ai_fallback_reason: 'parse_failed',
    });
  } catch (e) {
    // AI вообще не ответил (rate limit, network) — тоже идём в fallback
    return NextResponse.json({
      stats,
      analysis: ruleBasedFallback(stats),
      ai_used: false,
      ai_fallback_reason: (e as Error).message,
    });
  }
}
