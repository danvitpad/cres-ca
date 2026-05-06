/** --- YAML
 * name: AI Client Chat
 * description: Главный endpoint AI-консьержа клиента. Принимает сообщение + history
 *              + locale (язык интерфейса) + userId. Понимает 11 интентов, отвечает
 *              на языке UI. Поиск мастеров — broad fuzzy match по specialization,
 *              vertical, display_name, profile.full_name, bio, services.name+desc.
 *              Геолокация — из Vercel-headers (x-vercel-ip-city) как мягкий хинт,
 *              без вопросов клиенту. Если клиент явно указал город — он побеждает.
 * created: 2026-04-26
 * updated: 2026-05-05
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

type Locale = 'uk' | 'ru' | 'en';

const LANG_NAME: Record<Locale, string> = {
  uk: 'Ukrainian (українська)',
  ru: 'Russian (русский)',
  en: 'English',
};

function buildSystemPrompt(locale: Locale, defaultCity: string | null): string {
  const langInstruction = locale === 'uk'
    ? 'ВАЖЛИВО: відповідай ВИКЛЮЧНО українською мовою — навіть якщо користувач написав російською. Це жорстке правило.'
    : locale === 'en'
    ? 'IMPORTANT: respond EXCLUSIVELY in English — even if the user wrote in another language. This is a hard rule.'
    : 'ВАЖНО: отвечай ИСКЛЮЧИТЕЛЬНО на русском языке — даже если пользователь написал на другом языке. Это жёсткое правило.';

  const cityHint = defaultCity
    ? `Город пользователя по умолчанию: «${defaultCity}». Если он не уточнил другой город — используй этот.`
    : 'Город пользователя неизвестен. НЕ спрашивай его — ищи без фильтра по городу. Если пользователь сам указал город — используй его.';

  return `Ты — AI-консьерж в приложении CRES-CA (универсальная платформа для бронирования услуг: красота, здоровье, фитнес, образование, авто, дом, репетиторы, тренеры, ветеринары и др.).
Клиент общается с тобой в Mini App. Ты помогаешь ему: найти мастера/специалиста, записаться, отменить/перенести, узнать когда визит, как подготовиться, как ухаживать после, и т.д.

${langInstruction}

${cityHint}

ЗАДАЧА — вернуть СТРОГО JSON следующего формата (без markdown-ограждений, без \`\`\`):
{
  "intent": "find" | "book" | "reschedule" | "cancel" | "status" | "prep" | "care" | "compare" | "remind" | "gift" | "smalltalk",
  "reply": "человеко-читаемый ответ клиенту (2-4 коротких предложения) на нужном языке",
  "params": {
    "query": "учитель иностранных языков" | null,    // СВОБОДНЫЙ ТЕКСТ описание что ищет (профессия / услуга / тип специалиста)
    "service": "маникюр" | null,                       // конкретная услуга если упомянута
    "city": "Киев" | null,                             // только если КЛИЕНТ ЯВНО назвал город (не выдумывай)
    "price_max": 800 | null,
    "when": "завтра вечером" | null,
    "appointment_id": null,
    "reminder_days": null
  },
  "suggestions": ["короткая reply 1", "короткая reply 2"]   // ИЛИ пустой массив
}

ПРАВИЛА:
- intent="find" — клиент ищет специалиста любой профессии: «найди маникюр», «нужен репетитор английского», «учитель иностранных языков», «массаж в центре», «парикмахер на завтра», «ветеринар», «тренер», «педикюрша». Заполняй params.query своими словами на русском (для базы поиска), а params.service — только если в сообщении явно прозвучало название услуги. params.city — ТОЛЬКО если клиент сам его назвал.
- intent="status" — «когда у меня запись?», «что у меня на завтра» — клиент хочет узнать ближайший визит.
- intent="prep" — «что взять с собой», «как готовиться» — инструкции по подготовке.
- intent="care" — «как ухаживать после», «можно ли мочить» — советы после визита.
- intent="reschedule" — «перенеси», «другое время» — клиент хочет сменить время.
- intent="cancel" — «отмени» — отмена записи.
- intent="remind" — «напомни через 4 недели» — создать напоминание.
- intent="compare" — «кто лучше из этих» — сравнение.
- intent="gift" — «нужен подарок» — подарочные карты.
- intent="smalltalk" — приветствие, благодарность, болтовня.

Тёплый и краткий тон, как друг-консьерж в дорогом сервисе. Без банальностей. Без приветствий («Привет!», «Здравствуй!») — клиент уже в приложении.

Если intent="find" — дай suggestions: одну фразу-уточнение (на нужном языке), например «Подобрать сейчас» / «Підібрати зараз» / «Pick now».
Иначе suggestions = [].`;
}

const SURFACE = 'client_concierge';
const HISTORY_LIMIT = 10;

async function loadHistory(profileId: string): Promise<ChatMessage[]> {
  const db = admin();
  const { data } = await db
    .from('ai_messages')
    .select('role, content')
    .eq('profile_id', profileId)
    .eq('surface', SURFACE)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (!data) return [];
  // DESC → reverse в хронологический порядок
  return (data as Array<{ role: 'user' | 'assistant'; content: string }>)
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

async function saveMessage(
  profileId: string,
  role: 'user' | 'assistant',
  content: string,
  intent?: string | null,
  data?: Record<string, unknown> | null,
): Promise<void> {
  const db = admin();
  await db.from('ai_messages').insert({
    profile_id: profileId,
    surface: SURFACE,
    role,
    content,
    intent: intent ?? null,
    data: data ?? null,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { message: string; history?: ChatMessage[]; userId?: string; locale?: Locale }
      | null;
    if (!body?.message?.trim()) {
      return NextResponse.json({ error: 'empty_message' }, { status: 400 });
    }

    // Locale: явно из тела (UI) → fallback uk
    const locale: Locale =
      body.locale === 'ru' || body.locale === 'en' ? body.locale : 'uk';

    // Default city из Vercel-headers (CDN edge geolocation). Если есть —
    // подсказка для AI, но не жёсткий фильтр.
    const headerCity = decodeURIComponent(
      req.headers.get('x-vercel-ip-city') ||
      req.headers.get('cf-ipcity') ||
      '',
    ).trim() || null;

    // История: если есть userId — берём из БД (persistent), иначе из тела
    // (legacy sessionStorage path). Новые чаты пишутся в БД, старые сессии
    // donьше пользоваться body.history до релогина.
    const userMessage = body.message.trim();
    const dbHistory = body.userId ? await loadHistory(body.userId) : [];
    const history: ChatMessage[] = dbHistory.length > 0
      ? dbHistory
      : (body.history ?? []).slice(-HISTORY_LIMIT);
    history.push({ role: 'user', content: userMessage });

    const result = await chatCompletion({
      systemPrompt: buildSystemPrompt(locale, headerCity),
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
      const fallbackReply =
        result.data?.slice(0, 600) ??
        (locale === 'uk'
          ? 'Не впевнений що зрозумів. Спробуй переформулювати.'
          : locale === 'en'
          ? "Not sure I understood. Could you rephrase?"
          : 'Не уверен что понял. Попробуй переформулировать.');
      // Persist даже невалидные ответы — модель такое тоже использует как контекст.
      if (body.userId) {
        await saveMessage(body.userId, 'user', userMessage);
        await saveMessage(body.userId, 'assistant', fallbackReply, 'smalltalk');
      }
      return NextResponse.json({
        intent: 'smalltalk',
        reply: fallbackReply,
        suggestions: [],
        actions: [],
      });
    }

    let actions: ActionCard[] = [];

    if (parsed.intent === 'find' && parsed.params) {
      // Если AI не прислал city, но edge-headers их дали — добавим как мягкий фильтр.
      const params = { ...parsed.params };
      if (!params.city && headerCity) params.city = headerCity;
      actions = await findMasters(params, locale);

      // Если ничего не нашли по «строгому» с city — пробуем БЕЗ city.
      if (!actions.length && params.city) {
        actions = await findMasters({ ...params, city: null }, locale);
      }
    }

    if (parsed.intent === 'status' && body.userId) {
      const next = await getNextAppointment(body.userId);
      if (next) actions = [next];
    }

    // Persist в ai_messages — после успешного ответа модели.
    if (body.userId) {
      await saveMessage(body.userId, 'user', userMessage);
      await saveMessage(
        body.userId, 'assistant', parsed.reply,
        parsed.intent,
        { params: parsed.params, actions },
      );
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
        {
          error: 'ai_unavailable',
          message: 'AI сейчас недоступен — попробуй чуть позже.',
        },
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

interface MasterRow {
  id: string;
  slug: string | null;
  display_name: string | null;
  specialization: string | null;
  vertical: string | null;
  bio: string | null;
  city: string | null;
  rating: number | null;
  total_reviews: number | null;
  profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
}

interface ServiceRow {
  master_id: string;
  name: string | null;
  description: string | null;
  price: number | null;
}

/**
 * Расширенный поиск мастеров: по нескольким полям сразу.
 * Score-based ranking: чем больше попаданий ключевых слов, тем выше.
 * Поля для скоринга: specialization, vertical, display_name,
 * profile.full_name, bio, services.name, services.description.
 */
async function findMasters(
  params: Record<string, unknown>,
  locale: Locale,
): Promise<ActionCard[]> {
  const queryRaw = (params.query as string | null)?.trim() || null;
  const serviceRaw = (params.service as string | null)?.trim() || null;
  const cityRaw = (params.city as string | null)?.trim() || null;
  const priceMax =
    typeof params.price_max === 'number' ? (params.price_max as number) : null;

  // Объединяем query + service в общий пул keywords для скоринга
  const queryText = [queryRaw, serviceRaw].filter(Boolean).join(' ').toLowerCase();
  const keywords = queryText
    .split(/[\s,;.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);  // игнорим короткие союзы / предлоги

  const db = admin();

  // 1. Берём ВСЕХ публичных активных мастеров (limit 200 — обычно их немного)
  let q = db
    .from('masters')
    .select(
      'id, slug, display_name, specialization, vertical, bio, city, rating, total_reviews, ' +
        'profile:profiles!masters_profile_id_fkey(full_name, avatar_url)',
    )
    .eq('is_public', true)
    .eq('is_active', true)
    .limit(200);
  if (cityRaw) q = q.ilike('city', `%${cityRaw}%`);

  const { data: rawMasters } = await q;
  const masters = (rawMasters ?? []) as unknown as MasterRow[];
  if (!masters.length) return [];

  // 2. Если есть keywords — подгружаем services для скоринга
  let servicesByMaster = new Map<string, ServiceRow[]>();
  if (keywords.length || priceMax) {
    const ids = masters.map((m) => m.id);
    const { data: svcRows } = await db
      .from('services')
      .select('master_id, name, description, price')
      .in('master_id', ids)
      .eq('is_active', true);
    for (const r of (svcRows ?? []) as ServiceRow[]) {
      const arr = servicesByMaster.get(r.master_id) ?? [];
      arr.push(r);
      servicesByMaster.set(r.master_id, arr);
    }
  }

  // 3. Скоринг. Если keywords пустые — все мастера пройдут (score=0).
  //    Если есть price_max — отсеиваем мастеров без услуг в бюджете.
  const profileOf = (m: MasterRow) =>
    Array.isArray(m.profile) ? m.profile[0] : m.profile;

  const scored = masters
    .map((m) => {
      const services = servicesByMaster.get(m.id) ?? [];
      const profile = profileOf(m);

      // Поля для скоринга
      const haystack = [
        m.specialization,
        m.vertical,
        m.display_name,
        profile?.full_name,
        m.bio,
        ...services.map((s) => s.name).filter(Boolean),
        ...services.map((s) => s.description).filter(Boolean),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 1;
      }
      // Бонус за совпадение vertical с известными ключевыми словами
      const verticalMap: Record<string, string[]> = {
        education: ['учитель', 'преподаватель', 'репетитор', 'tutor', 'teacher', 'язык', 'мова', 'language', 'английск', 'english'],
        beauty: ['красот', 'маникюр', 'педикюр', 'парикмахер', 'стрижк', 'волос', 'бров', 'ресниц', 'beauty', 'manicure', 'haircut'],
        health: ['врач', 'доктор', 'лікар', 'doctor', 'health', 'медиц', 'стомат', 'физио'],
        fitness: ['тренер', 'фитнес', 'фітнес', 'йога', 'yoga', 'fitness', 'trainer'],
        pets: ['ветеринар', 'грум', 'pet', 'vet', 'питом'],
        auto: ['авто', 'механик', 'car', 'auto', 'mechanic'],
        home: ['ремонт', 'сантехник', 'электрик', 'plumber', 'electric', 'home'],
      };
      if (m.vertical && verticalMap[m.vertical]) {
        for (const vKw of verticalMap[m.vertical]) {
          if (queryText.includes(vKw)) score += 2;
        }
      }

      // Бонус за рейтинг (мягкий tiebreaker)
      score += (m.rating ?? 0) * 0.1;

      // Price filter: если задан price_max — мастер ДОЛЖЕН иметь услугу <= priceMax
      if (priceMax && services.length) {
        const hasAffordable = services.some(
          (s) => s.price != null && s.price <= priceMax,
        );
        if (!hasAffordable) score = -1;  // отсеять
      }

      return { m, profile, score };
    })
    .filter((x) => x.score >= 0);

  // Если keywords заданы — оставляем только мастеров со score>0
  // (требуем хотя бы одно совпадение). Если keywords пусты — все.
  const filtered = keywords.length
    ? scored.filter((x) => x.score > 0)
    : scored;

  // Сортируем по score desc, rating desc
  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.m.rating ?? 0) - (a.m.rating ?? 0);
  });

  // Top 5
  return filtered.slice(0, 5).map(({ m, profile }) => ({
    type: 'master' as const,
    data: {
      id: m.id,
      slug: m.slug,
      name: m.display_name ?? profile?.full_name ?? (locale === 'uk' ? 'Майстер' : locale === 'en' ? 'Master' : 'Мастер'),
      avatar: profile?.avatar_url ?? null,
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
