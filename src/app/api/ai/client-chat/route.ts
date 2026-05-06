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

import {
  findFreeSlotsInDay,
  findNextAvailableSlots,
  getClientHistory,
  getClientStats,
  getNextDueEstimate,
  resolveMaster,
  resolveService,
} from '@/lib/ai/concierge-tools';

type Locale = 'uk' | 'ru' | 'en';

function todayKyivStr(): string {
  const k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
  return `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, '0')}-${String(k.getDate()).padStart(2, '0')}`;
}

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

Сегодня: ${todayKyivStr()} (Europe/Kiev). Когда клиент говорит «завтра», «в среду», «через неделю» — переводи в YYYY-MM-DD.

ЗАДАЧА — вернуть СТРОГО JSON следующего формата (без markdown-ограждений, без \`\`\`):
{
  "intent": "find_master" | "find_slots" | "book" | "reschedule" | "cancel" | "status" | "history" | "stats" | "next_due" | "prep" | "care" | "compare" | "remind" | "gift" | "smalltalk",
  "reply": "короткий ответ клиенту (1-2 предложения, нужный язык). Если intent требует данных из БД (find_slots/history/stats/next_due/status) — оставь reply короткой подводкой; точные цифры/слоты сервер допишет сам.",
  "params": {
    "query": "учитель иностранных языков" | null,
    "service": "маникюр" | null,
    "master_name": "Таня" | null,
    "city": "Киев" | null,
    "price_max": 800 | null,
    "date": "2026-05-08" | null,
    "after_time": "14:00" | null,
    "period_from": "2026-01-01" | null,
    "appointment_id": null,
    "reminder_days": null
  },
  "suggestions": ["короткая reply 1", "короткая reply 2"]
}

ИНТЕНТЫ:
- "find_master" — поиск специалиста: «найди маникюр», «нужен репетитор английского», «массаж в центре». Заполняй params.query, опц. service/city/price_max.
- "find_slots" — конкретные свободные времена у мастера на дату: «когда у Тани свободно в среду на маникюр». Обязательно: master_name + date (YYYY-MM-DD). Опц.: service, after_time («после обеда» → "14:00»).
- "book" — клиент хочет записаться, и УЖЕ назвал мастера/услугу/время. Если чего-то не хватает (нет времени) → используй "find_slots" вместо "book", сервер покажет варианты.
- "status" — «когда у меня запись?»: ближайший визит клиента.
- "history" — «покажи мою историю», «что я делала в прошлом месяце»: список последних завершённых визитов.
- "stats" — «сколько я потратила на маникюр в этом году», «сколько раз я была у Кати»: суммы и счётчики. Заполни service (что суммируем) и period_from (с какой даты, YYYY-MM-DD).
- "next_due" — «когда мне обычно стричься», «пора ли мне на маникюр»: оценка следующей даты по медианному интервалу. Заполни service.
- "reschedule" / "cancel" — клиент хочет перенести / отменить уже существующую запись. appointment_id обычно null — клиент скажет «мою запись на четверг».
- "prep" / "care" — инструкции до/после визита. Серверу не нужны данные, отвечай сам коротко.
- "compare" — «кто лучше из этих»; "gift" — «подарочная карта»; "remind" — «напомни через N дней»; "smalltalk" — болтовня.

Тёплый и краткий тон, как друг-консьерж в дорогом сервисе. Без приветствий — клиент уже в приложении.

Если intent="find_master" — suggestions: одна фраза-уточнение («Подобрать сейчас» / «Підібрати зараз»).
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
    let serverReply: string | null = null;

    // Алиас find → find_master (старые сессии)
    const intent = parsed.intent === 'find' ? 'find_master' : parsed.intent;

    if (intent === 'find_master' && parsed.params) {
      const params = { ...parsed.params };
      if (!params.city && headerCity) params.city = headerCity;
      actions = await findMasters(params, locale);
      if (!actions.length && params.city) {
        actions = await findMasters({ ...params, city: null }, locale);
      }
    }

    if (intent === 'status' && body.userId) {
      const next = await getNextAppointment(body.userId);
      if (next) actions = [next];
    }

    if (intent === 'find_slots' && parsed.params) {
      const r = await handleFindSlots(parsed.params, body.userId ?? null, locale);
      actions = r.actions;
      serverReply = r.reply;
    }

    if (intent === 'history' && body.userId) {
      serverReply = await handleHistory(body.userId, parsed.params ?? {}, locale);
    }

    if (intent === 'stats' && body.userId) {
      serverReply = await handleStats(body.userId, parsed.params ?? {}, locale);
    }

    if (intent === 'next_due' && body.userId) {
      serverReply = await handleNextDue(body.userId, parsed.params ?? {}, locale);
    }

    const finalReply = serverReply ?? parsed.reply;

    // Persist в ai_messages — после успешного ответа модели.
    if (body.userId) {
      await saveMessage(body.userId, 'user', userMessage);
      await saveMessage(
        body.userId, 'assistant', finalReply,
        intent,
        { params: parsed.params, actions },
      );
    }

    return NextResponse.json({
      intent,
      reply: finalReply,
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
  type: 'master' | 'appointment' | 'time-slot' | 'slot-list';
  data: Record<string, unknown>;
}

/* ─────────── Intent handlers ─────────── */

const fmtDateUk = (iso: string): string =>
  new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', timeZone: 'Europe/Kiev',
  });

const fmtMoney = (price: number, currency: string | null): string => {
  const cur = (currency ?? 'UAH').toUpperCase();
  const sym: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€', RUB: '₽', PLN: 'zł' };
  return `${Math.round(price)} ${sym[cur] ?? cur}`;
};

async function handleFindSlots(
  params: Record<string, unknown>,
  profileId: string | null,
  locale: Locale,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const masterName = (params.master_name as string | null)?.trim() || null;
  const serviceQuery = (params.service as string | null)?.trim() || null;
  const date = (params.date as string | null)?.trim() || null;
  const afterTime = (params.after_time as string | null)?.trim() || null;

  if (!masterName) {
    return {
      reply: locale === 'uk'
        ? 'Підкажи, у якого майстра шукати слоти?'
        : locale === 'en'
        ? 'Which master should I look up slots for?'
        : 'Подскажи, у какого мастера искать слоты?',
      actions: [],
    };
  }

  const db = admin();
  const masterRes = await resolveMaster(db, { profileId, query: masterName });

  if (masterRes.kind === 'none') {
    return {
      reply: locale === 'uk'
        ? `Не знайшов майстра «${masterName}». Може уточниш ім’я?`
        : locale === 'en'
        ? `Couldn't find a master named "${masterName}". Could you clarify the name?`
        : `Не нашёл мастера «${masterName}». Уточни имя?`,
      actions: [],
    };
  }
  if (masterRes.kind === 'choices') {
    const list = masterRes.options.map((o) => o.name).join(', ');
    return {
      reply: locale === 'uk'
        ? `Знайшов кілька майстрів з таким іменем: ${list}. Кого з них?`
        : locale === 'en'
        ? `Found several masters: ${list}. Which one?`
        : `Нашёл нескольких мастеров: ${list}. Кого из них?`,
      actions: [],
    };
  }

  const masterId = masterRes.masterId;

  // Услуга обязательна для расчёта длительности
  if (!serviceQuery) {
    return {
      reply: locale === 'uk'
        ? 'Яку послугу шукаємо? Від цього залежить тривалість слоту.'
        : locale === 'en'
        ? 'Which service? Slot length depends on it.'
        : 'Какую услугу? От неё зависит длительность слота.',
      actions: [],
    };
  }
  const svcRes = await resolveService(db, { masterId, query: serviceQuery });
  if (svcRes.kind === 'none') {
    return {
      reply: locale === 'uk'
        ? `У цього майстра немає послуги «${serviceQuery}». Подивись список на його сторінці.`
        : locale === 'en'
        ? `This master doesn't offer "${serviceQuery}". Check their profile for the full list.`
        : `У этого мастера нет услуги «${serviceQuery}». Посмотри список на его странице.`,
      actions: [],
    };
  }
  if (svcRes.kind === 'choices') {
    const list = svcRes.options.map((o) => `${o.name} (${o.durationMinutes} мин, ${fmtMoney(o.price, o.currency)})`).join('; ');
    return {
      reply: locale === 'uk'
        ? `Є кілька варіантів: ${list}. Яку саме?`
        : locale === 'en'
        ? `Several options: ${list}. Which one?`
        : `Нашёл несколько вариантов: ${list}. Какую именно?`,
      actions: [],
    };
  }

  const service = svcRes;
  const targetDate = date || todayKyivStr();

  const slots = await findFreeSlotsInDay(db, {
    masterId,
    date: targetDate,
    durationMinutes: service.durationMinutes,
    afterTime,
  });

  if (slots.length > 0) {
    const previewMax = 6;
    const preview = slots.slice(0, previewMax);
    const tail = slots.length > previewMax ? ` + ще ${slots.length - previewMax}` : '';
    const dateLabel = fmtDateUk(`${targetDate}T12:00:00`);
    const reply = locale === 'uk'
      ? `На ${dateLabel} (${service.name}, ${service.durationMinutes} хв) вільно: ${preview.join(', ')}${tail}.`
      : locale === 'en'
      ? `On ${dateLabel} (${service.name}, ${service.durationMinutes} min) free: ${preview.join(', ')}${tail}.`
      : `На ${dateLabel} (${service.name}, ${service.durationMinutes} мин) свободно: ${preview.join(', ')}${tail}.`;
    return {
      reply,
      actions: [{
        type: 'slot-list',
        data: {
          masterId,
          serviceId: service.serviceId,
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          date: targetDate,
          slots: preview,
        },
      }],
    };
  }

  // Нет слотов — ищем ближайшие свободные дни
  const next = await findNextAvailableSlots(db, {
    masterId,
    durationMinutes: service.durationMinutes,
  });

  if (!next.length) {
    return {
      reply: locale === 'uk'
        ? `На найближчі 2 тижні немає вільних вікон під ${service.name} (${service.durationMinutes} хв).`
        : locale === 'en'
        ? `No free windows for ${service.name} (${service.durationMinutes} min) in the next 2 weeks.`
        : `На ближайшие 2 недели нет свободных окон под ${service.name} (${service.durationMinutes} мин).`,
      actions: [],
    };
  }

  const lines = next.map(
    (n) => `${fmtDateUk(`${n.date}T12:00:00`)}: ${n.slots.join(', ')}`,
  ).join('; ');
  const reply = locale === 'uk'
    ? `На ${fmtDateUk(`${targetDate}T12:00:00`)} вільних вікон під ${service.name} (${service.durationMinutes} хв) немає. Найближчі: ${lines}.`
    : locale === 'en'
    ? `No openings for ${service.name} (${service.durationMinutes} min) on ${fmtDateUk(`${targetDate}T12:00:00`)}. Next available: ${lines}.`
    : `На ${fmtDateUk(`${targetDate}T12:00:00`)} нет свободных окон под ${service.name} (${service.durationMinutes} мин). Ближайшие: ${lines}.`;

  return {
    reply,
    actions: next.flatMap((n) => [{
      type: 'slot-list' as const,
      data: {
        masterId,
        serviceId: service.serviceId,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        date: n.date,
        slots: n.slots,
      },
    }]),
  };
}

async function handleHistory(
  profileId: string,
  _params: Record<string, unknown>,
  locale: Locale,
): Promise<string> {
  const db = admin();
  const list = await getClientHistory(db, profileId, 7);
  if (!list.length) {
    return locale === 'uk' ? 'Поки що історії немає.' : locale === 'en' ? 'No visits yet.' : 'Пока историй нет.';
  }
  const lines = list.map((r) => {
    const date = new Date(r.starts_at).toLocaleDateString(
      locale === 'uk' ? 'uk-UA' : locale === 'en' ? 'en-GB' : 'ru-RU',
      { day: 'numeric', month: 'short', timeZone: 'Europe/Kiev' },
    );
    const price = r.price ? ` — ${fmtMoney(r.price, r.currency)}` : '';
    return `• ${date}: ${r.service_name ?? '—'}${r.master_name ? ` · ${r.master_name}` : ''}${price}`;
  }).join('\n');
  const head = locale === 'uk' ? 'Останні візити:' : locale === 'en' ? 'Recent visits:' : 'Последние визиты:';
  return `${head}\n${lines}`;
}

async function handleStats(
  profileId: string,
  params: Record<string, unknown>,
  locale: Locale,
): Promise<string> {
  const db = admin();
  const periodFrom = (params.period_from as string | null)?.trim() || null;
  const serviceQuery = (params.service as string | null)?.trim() || null;
  const stats = await getClientStats(db, profileId, {
    from: periodFrom ?? undefined,
    serviceQuery,
  });

  if (stats.visits === 0) {
    return locale === 'uk'
      ? 'Завершених візитів за цей період не знайшов.'
      : locale === 'en'
      ? 'No completed visits found for this period.'
      : 'Завершённых визитов за этот период не нашёл.';
  }

  const total = fmtMoney(stats.totalSpent, stats.currency);
  const head = serviceQuery
    ? (locale === 'uk' ? `По «${serviceQuery}»: ${stats.visits} візит(и/ів) на ${total}.`
       : locale === 'en' ? `For "${serviceQuery}": ${stats.visits} visits, ${total} total.`
       : `По «${serviceQuery}»: ${stats.visits} визит(а/ов) на ${total}.`)
    : (locale === 'uk' ? `Всього: ${stats.visits} візит(и/ів) на ${total}.`
       : locale === 'en' ? `Total: ${stats.visits} visits, ${total}.`
       : `Всего: ${stats.visits} визит(а/ов) на ${total}.`);

  if (!stats.byService.length) return head;
  const breakdown = stats.byService
    .slice(0, 3)
    .map((b) => `${b.name} ×${b.count} — ${fmtMoney(b.spent, stats.currency)}`)
    .join(', ');
  return `${head}\n${breakdown}`;
}

async function handleNextDue(
  profileId: string,
  params: Record<string, unknown>,
  locale: Locale,
): Promise<string> {
  const serviceQuery = (params.service as string | null)?.trim();
  if (!serviceQuery) {
    return locale === 'uk'
      ? 'Підкажи, що саме ти зазвичай робиш — стрижка, манікюр, масаж?'
      : locale === 'en'
      ? 'What service do you usually book — haircut, manicure, massage?'
      : 'Подскажи, что ты обычно делаешь — стрижка, маникюр, массаж?';
  }
  const db = admin();
  const est = await getNextDueEstimate(db, profileId, serviceQuery);
  if (!est) {
    return locale === 'uk'
      ? `Ще не маю достатньо візитів по «${serviceQuery}», щоб порахувати інтервал.`
      : locale === 'en'
      ? `Not enough visits on "${serviceQuery}" to estimate the interval yet.`
      : `Пока недостаточно визитов по «${serviceQuery}», чтобы посчитать интервал.`;
  }
  if (!est.nextDue || !est.intervalDays) {
    return locale === 'uk'
      ? `Знайшов один візит «${serviceQuery}». Цього мало для оцінки — після другого скажу інтервал.`
      : locale === 'en'
      ? `Only one "${serviceQuery}" visit so far. Need another one to estimate.`
      : `Нашёл один визит «${serviceQuery}». Этого мало для оценки — после второго скажу интервал.`;
  }
  const last = new Date(est.lastVisit!);
  const next = new Date(est.nextDue);
  const daysSince = Math.round((Date.now() - last.getTime()) / 86_400_000);
  const overdue = daysSince - est.intervalDays;

  const dateLabel = next.toLocaleDateString(
    locale === 'uk' ? 'uk-UA' : locale === 'en' ? 'en-GB' : 'ru-RU',
    { day: 'numeric', month: 'long', timeZone: 'Europe/Kiev' },
  );

  if (overdue > 0) {
    return locale === 'uk'
      ? `Зазвичай ти робиш «${serviceQuery}» раз на ${est.intervalDays} дн. Минулий візит — ${daysSince} дн тому. Уже час 🙂`
      : locale === 'en'
      ? `You usually book "${serviceQuery}" every ${est.intervalDays} days. Last visit was ${daysSince} days ago — time to book.`
      : `Обычно ты делаешь «${serviceQuery}» раз в ${est.intervalDays} дн. Прошлый визит — ${daysSince} дн назад. Уже пора 🙂`;
  }

  return locale === 'uk'
    ? `Інтервал ~${est.intervalDays} дн. Орієнтовно наступний візит: ${dateLabel}.`
    : locale === 'en'
    ? `Interval ~${est.intervalDays} days. Approximate next visit: ${dateLabel}.`
    : `Интервал ~${est.intervalDays} дн. Примерно следующий визит: ${dateLabel}.`;
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
