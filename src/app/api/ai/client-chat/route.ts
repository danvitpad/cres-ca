/** --- YAML
 * name: AI Client Chat
 * description: Главный endpoint AI-консьержа клиента. Принимает сообщение + history,
 *              понимает 10 интентов (find / book / reschedule / cancel / status /
 *              prep / care / compare / remind / gift). Возвращает структурированный
 *              ответ: текст + опциональные action-cards (master cards / time slots /
 *              quick-replies). Эти actions клиент рендерит inline в чате.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { chatCompletion, AIUnavailableError, extractJSON, type ChatMessage } from '@/lib/ai/router';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const SYSTEM_PROMPT = `Ты — AI-консьерж в приложении CRES-CA (бронирование услуг красоты, здоровья, домашних дел).
Клиент общается с тобой в Mini App. Ты помогаешь ему: найти мастера, записаться, отменить/перенести, узнать когда визит, как подготовиться, как ухаживать после, и т.д.

ВАЖНО: твой ответ — это СТРОГО JSON следующего формата (без markdown-ограждений):
{
  "intent": "find" | "book" | "reschedule" | "cancel" | "status" | "prep" | "care" | "compare" | "remind" | "gift" | "smalltalk",
  "reply": "человеко-читаемый ответ клиенту (2-4 коротких предложения)",
  "params": { "service": "маникюр" | null, "city": "Киев" | null, "price_max": 800 | null, "when": "завтра вечером" | null, "appointment_id": null, "reminder_days": null },
  "suggestions": ["короткая reply 1", "короткая reply 2"]   // ИЛИ пустой массив
}

ПРАВИЛА:
- intent="find" — клиент ищет мастера: «найди маникюр в центре». params.service/city/price_max/when обязательны если упомянуты.
- intent="status" — «когда у меня запись?», «что у меня на завтра» — клиент хочет узнать ближайший визит.
- intent="prep" — «что взять с собой», «как готовиться», «не есть перед?» — клиент хочет инструкции по подготовке.
- intent="care" — «как ухаживать после», «можно ли мочить» — после-уходовые советы.
- intent="reschedule" — «перенеси», «другое время» — клиент хочет сменить время.
- intent="cancel" — «отмени» — отмена записи.
- intent="remind" — «напомни через 4 недели», «поставь напоминание» — создать ремайнд.
- intent="compare" — «кто лучше из этих мастеров» — сравнение.
- intent="gift" — «нужен подарок другу» — подарочные карты.
- intent="smalltalk" — приветствие, благодарность, несвязанная болтовня.

В reply пиши на ТОМ ЖЕ языке что и пользователь (русский / украинский). Тёплый и краткий тон, как друг-консьерж в дорогом сервисе. Без банальностей. Не используй приветствия ("Привет!", "Здравствуй!") — клиент уже в приложении.

Если intent="find", дай ровно одну строку suggestions: ["Подобрать сейчас"]
Если intent="status", не добавляй suggestions если ответил.
Иначе suggestions можно оставить пустым [].`;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { message: string; history?: ChatMessage[]; userId?: string }
      | null;
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'empty_message' }, { status: 400 });
    }

    const history: ChatMessage[] = (body.history ?? []).slice(-10);
    history.push({ role: 'user', content: body.message.trim() });

    const result = await chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      history,
      maxTokens: 600,
    });

    const parsed = extractJSON<{
      intent: string;
      reply: string;
      params?: Record<string, unknown>;
      suggestions?: string[];
    }>(result.data);

    if (!parsed) {
      return NextResponse.json({
        intent: 'smalltalk',
        reply: result.data?.slice(0, 600) ?? 'Не уверен что понял. Попробуй переформулировать.',
        suggestions: [],
        actions: [],
      });
    }

    // Если intent=find — сразу подгружаем 3 топ-мастера и кладём в actions
    let actions: ActionCard[] = [];
    if (parsed.intent === 'find' && parsed.params) {
      actions = await findMasters(parsed.params);
    }
    if (parsed.intent === 'status' && body.userId) {
      const next = await getNextAppointment(body.userId);
      if (next) actions = [next];
    }

    return NextResponse.json({
      intent: parsed.intent,
      reply: parsed.reply,
      params: parsed.params ?? {},
      suggestions: parsed.suggestions ?? [],
      actions,
      model: result.model,
    });
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      return NextResponse.json(
        { error: 'ai_unavailable', message: 'AI сейчас недоступен — попробуй чуть позже.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

interface ActionCard {
  type: 'master' | 'appointment' | 'time-slot';
  data: Record<string, unknown>;
}

async function findMasters(params: Record<string, unknown>): Promise<ActionCard[]> {
  const service = (params.service as string | null)?.trim() || null;
  const city = (params.city as string | null)?.trim() || null;
  const priceMax = typeof params.price_max === 'number' ? params.price_max : null;

  const db = admin();
  let q = db
    .from('masters')
    .select(
      'id, slug, specialization, city, rating, total_reviews, ' +
        'profile:profiles!masters_profile_id_fkey(full_name, avatar_url)',
    )
    .eq('is_public', true)
    .eq('is_active', true)
    .limit(6);
  if (city) q = q.ilike('city', `%${city}%`);

  const { data: masters } = await q;
  if (!masters?.length) return [];

  type MasterRow = {
    id: string;
    slug: string;
    specialization: string | null;
    city: string | null;
    rating: number | null;
    total_reviews: number | null;
    profile: { full_name: string | null; avatar_url: string | null } | null;
  };
  const mastersTyped = masters as unknown as MasterRow[];
  let ids = mastersTyped.map((m) => m.id);
  if (service) {
    const { data: svc } = await db
      .from('services')
      .select('master_id')
      .in('master_id', ids)
      .eq('is_active', true)
      .ilike('name', `%${service}%`);
    const svcIds = new Set((svc ?? []).map((s) => s.master_id));
    ids = ids.filter((id) => svcIds.has(id));
  }
  if (priceMax) {
    const { data: svc } = await db
      .from('services')
      .select('master_id')
      .in('master_id', ids)
      .eq('is_active', true)
      .lte('price', priceMax);
    const svcIds = new Set((svc ?? []).map((s) => s.master_id));
    ids = ids.filter((id) => svcIds.has(id));
  }

  const filtered = mastersTyped.filter((m) => ids.includes(m.id));

  return filtered.slice(0, 3).map((m) => ({
    type: 'master' as const,
    data: {
      id: m.id,
      slug: m.slug,
      name: m.profile?.full_name ?? 'Мастер',
      avatar: m.profile?.avatar_url ?? null,
      city: m.city,
      specialization: m.specialization,
      rating: m.rating,
      reviewsCount: m.total_reviews ?? 0,
    },
  }));
}

async function getNextAppointment(userId: string): Promise<ActionCard | null> {
  const db = admin();
  const { data } = await db
    .from('appointments')
    .select(
      'id, starts_at, status, price, currency, ' +
        'service:services(name), ' +
        'master:masters(id, display_name, profile:profiles!masters_profile_id_fkey(full_name))',
    )
    .eq('client_profile_id', userId)
    .in('status', ['booked', 'confirmed'])
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  type R = {
    id: string;
    starts_at: string;
    status: string;
    price: number | null;
    currency: string | null;
    service: { name: string | null } | { name: string | null }[] | null;
    master:
      | { id: string; display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }
      | { id: string; display_name: string | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }[]
      | null;
  };
  const row = data as unknown as R;
  const svc = Array.isArray(row.service) ? row.service[0] : row.service;
  const master = Array.isArray(row.master) ? row.master[0] : row.master;
  const masterProfile = master ? (Array.isArray(master.profile) ? master.profile[0] : master.profile) : null;
  return {
    type: 'appointment',
    data: {
      id: row.id,
      starts_at: row.starts_at,
      service_name: svc?.name ?? '—',
      master_name: master?.display_name ?? masterProfile?.full_name ?? null,
      price: row.price,
      currency: row.currency ?? 'UAH',
    },
  };
}
