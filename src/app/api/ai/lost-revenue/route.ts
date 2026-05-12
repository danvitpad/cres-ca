/** --- YAML
 * name: Lost Revenue AI API
 * description: Generates AI-powered revenue insights for masters based on booking data
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiComplete } from '@/lib/ai/openrouter';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get master
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!master) {
    return NextResponse.json({ error: 'Not a master' }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Gather analytics data
  const [appointmentsRes, cancellationsRes, servicesRes, clientsRes] = await Promise.all([
    // All appointments last 30 days
    supabase
      .from('appointments')
      .select('starts_at, status, service_id')
      .eq('master_id', master.id)
      .gte('starts_at', thirtyDaysAgo.toISOString()),
    // Cancellations & no-shows
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('master_id', master.id)
      .in('status', ['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'])
      .gte('starts_at', thirtyDaysAgo.toISOString()),
    // Services with prices
    supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('master_id', master.id)
      .eq('is_active', true),
    // Unique clients count
    supabase
      .from('clients')
      .select('id, last_visit_at')
      .eq('master_id', master.id),
  ]);

  const appointments = appointmentsRes.data ?? [];
  const cancelledCount = cancellationsRes.count ?? 0;
  const services = servicesRes.data ?? [];
  const clients = clientsRes.data ?? [];

  // Day-of-week distribution
  const dayDistribution: Record<number, number> = {};
  for (const apt of appointments) {
    const day = new Date(apt.starts_at).getDay();
    dayDistribution[day] = (dayDistribution[day] ?? 0) + 1;
  }

  // Dormant clients (haven't visited in 60+ days)
  const dormantClients = clients.filter((c) => {
    if (!c.last_visit_at) return true;
    return new Date(c.last_visit_at).getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000;
  });

  // Service popularity
  const serviceBookings: Record<string, number> = {};
  for (const apt of appointments) {
    if (apt.service_id) {
      serviceBookings[apt.service_id] = (serviceBookings[apt.service_id] ?? 0) + 1;
    }
  }

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const dayStats = dayNames.map((name, i) => `${name}: ${dayDistribution[i] ?? 0}`).join(', ');

  const serviceStats = services
    .map((s) => `${s.name}: ${serviceBookings[s.id] ?? 0} записей, цена ${s.price} ₴`)
    .join('; ');

  const summary = [
    `Всего записей за 30 дней: ${appointments.length}`,
    `Отменено и не пришли: ${cancelledCount}`,
    `Всего клиентов: ${clients.length}, спящих (60+ дней): ${dormantClients.length}`,
    `Распределение по дням: ${dayStats}`,
    `Услуги: ${serviceStats}`,
  ].join('\n');

  const aiResponse = await aiComplete(
    `Вы бизнес-аналитик для мастера сферы услуг (универсально: парикмахер, мастер маникюра, массажист, груминг, стоматолог, автосервис и т.д.). На основе данных дай ровно 3 практических совета мастеру, как заработать больше.

КРИТИЧНО:
- Отвечай ТОЛЬКО на русском языке. Никакого английского.
- Все суммы — в гривнах (₴). Никаких других валют (₽/$/€) даже как примеров.
- Только валидный JSON-массив без markdown и преамбул. Сразу [ ... ]
- Каждый объект: { "type": "schedule_gaps" | "dormant_clients" | "price_optimization" | "upsell_missed", "title": "короткий заголовок", "description": "1-2 предложения с конкретными цифрами из данных", "action": "конкретное действие, которое мастер может сделать сегодня" }
- Внутри строк только обычные кавычки. Без запятых после последнего элемента.`,
    summary,
  );

  // Parse AI response
  type Insight = { type: string; title: string; description: string; action: string };
  let insights: Insight[] = [];
  try {
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      insights = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // ignore
  }
  if (insights.length === 0) {
    insights = [
      {
        type: 'schedule_gaps',
        title: 'Посмотрите на расписание',
        description: `За 30 дней было ${cancelledCount} отмен и неявок. Это потерянные деньги.`,
        action: 'Включите политику отмены и лист ожидания, чтобы пустые слоты заполнялись',
      },
    ];
  }

  return NextResponse.json({ insights });
}
