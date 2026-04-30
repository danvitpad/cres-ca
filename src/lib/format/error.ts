/** --- YAML
 * name: humanizeError
 * description: Превращает технические ошибки (Supabase auth, PostgREST, fetch, JS Error) в
 *              человеческие русские сообщения. Используется в toast.error везде, чтобы
 *              мастер/клиент никогда не видел "Invalid login credentials" или
 *              "duplicate key value violates unique constraint".
 * created: 2026-04-27
 * --- */

const HUMAN_PATTERNS: { match: RegExp | string; ru: string }[] = [
  // ─── Supabase Auth ───
  { match: /Invalid login credentials/i, ru: 'Неверный email или пароль' },
  { match: /Email not confirmed/i, ru: 'Подтвердите email — мы отправили письмо со ссылкой' },
  { match: /Email rate limit exceeded/i, ru: 'Слишком много попыток. Подожди минуту и попробуй снова' },
  { match: /User already registered/i, ru: 'Аккаунт с этим email уже существует' },
  { match: /already registered/i, ru: 'Аккаунт с этим email уже существует' },
  { match: /User not found/i, ru: 'Аккаунт не найден' },
  { match: /Password should be at least \d+ characters/i, ru: 'Пароль должен быть не короче 6 символов' },
  { match: /Password is too weak/i, ru: 'Пароль слишком простой — добавь букв и цифр' },
  { match: /weak password/i, ru: 'Пароль слишком простой — добавь букв и цифр' },
  { match: /Token has expired or is invalid/i, ru: 'Сессия истекла. Войди заново' },
  { match: /JWT expired/i, ru: 'Сессия истекла. Войди заново' },
  { match: /jwt expired/i, ru: 'Сессия истекла. Войди заново' },
  { match: /signup is disabled/i, ru: 'Регистрация временно недоступна' },
  { match: /Invalid email/i, ru: 'Похоже, email написан с ошибкой' },
  { match: /Invalid OTP/i, ru: 'Неверный код' },
  { match: /Token has expired/i, ru: 'Код истёк. Запроси новый' },
  { match: /OTP expired/i, ru: 'Код истёк. Запроси новый' },
  { match: /For security purposes, you can only request this after \d+ seconds/i, ru: 'Подожди немного — скоро можно будет повторить' },

  // ─── PostgREST / DB constraints ───
  { match: /duplicate key value/i, ru: 'Такая запись уже существует' },
  { match: /unique constraint/i, ru: 'Такая запись уже существует' },
  { match: /violates foreign key/i, ru: 'Связанная запись не найдена' },
  { match: /violates not-null/i, ru: 'Не все обязательные поля заполнены' },
  { match: /violates check constraint/i, ru: 'Введены недопустимые значения' },
  { match: /violates row-level security/i, ru: 'Нет прав на это действие' },
  { match: /permission denied/i, ru: 'Нет доступа' },
  { match: /no rows returned/i, ru: 'Запись не найдена' },

  // ─── Network / fetch ───
  { match: /Failed to fetch/i, ru: 'Нет связи. Проверь интернет' },
  { match: /Network request failed/i, ru: 'Нет связи. Проверь интернет' },
  { match: /NetworkError/i, ru: 'Нет связи. Проверь интернет' },
  { match: /timeout/i, ru: 'Сервер слишком долго отвечает. Попробуй ещё раз' },
  { match: /AbortError/i, ru: 'Запрос отменён' },

  // ─── HTTP коды (если строка содержит код) ───
  { match: /\b400\b/, ru: 'Что-то не так с введёнными данными' },
  { match: /\b401\b/, ru: 'Войди заново — сессия закончилась' },
  { match: /\b403\b/, ru: 'Нет доступа к этому действию' },
  { match: /\b404\b/, ru: 'Не нашёл что искал' },
  { match: /\b409\b/, ru: 'Конфликт — такая запись уже есть' },
  { match: /\b429\b/, ru: 'Слишком часто. Подожди минуту' },
  { match: /\b500\b/, ru: 'Сервер задумался. Попробуй ещё раз' },
  { match: /\b502\b/, ru: 'Сервер ненадолго прилёг. Попробуй через минуту' },
  { match: /\b503\b/, ru: 'Сервис временно недоступен' },
  { match: /\b504\b/, ru: 'Сервер слишком долго отвечает' },

  // ─── Кастомные защиты от убытков (Шаг 10) ───
  { match: /promo_below_material_cost/i, ru: 'Этот промокод сделает услугу убыточной — финальная цена ниже расходников. Уменьши скидку.' },
  { match: /promo_negative_price/i, ru: 'Скидка больше цены услуги — это бесплатно или с доплатой. Уменьши скидку.' },
  { match: /promo_discount_too_large/i, ru: 'Скидка больше 95% — слишком много. Максимум 95%.' },
  { match: /cyclic_referral_blocked/i, ru: 'Нельзя пригласить того, кто уже пригласил тебя — это циклическая цепь.' },
  { match: /self_referral_blocked/i, ru: 'Нельзя пригласить самого себя.' },

  // ─── Default fallback ───
  { match: /Internal Server Error/i, ru: 'Сервер задумался. Попробуй ещё раз' },
];

/**
 * Превращает любой error / message / unknown в одну строку — на человеческом русском.
 * Если знакомый паттерн не найден — возвращает универсальное "Что-то пошло не так".
 *
 * @example
 *   try { ... } catch (e) { toast.error(humanizeError(e)); }
 *   if (error) { toast.error(humanizeError(error)); }
 */
export function humanizeError(input: unknown, fallback = 'Что-то пошло не так. Попробуй ещё раз'): string {
  if (input == null) return fallback;

  let raw = '';
  if (typeof input === 'string') raw = input;
  else if (input instanceof Error) raw = input.message;
  else if (typeof input === 'object') {
    const obj = input as { message?: unknown; error?: unknown; statusText?: unknown };
    if (typeof obj.message === 'string') raw = obj.message;
    else if (typeof obj.error === 'string') raw = obj.error;
    else if (obj.error && typeof obj.error === 'object' && 'message' in obj.error && typeof (obj.error as { message: unknown }).message === 'string') {
      raw = (obj.error as { message: string }).message;
    } else if (typeof obj.statusText === 'string') raw = obj.statusText;
    else raw = String(input);
  } else {
    raw = String(input);
  }

  if (!raw || raw === '[object Object]') return fallback;

  for (const { match, ru } of HUMAN_PATTERNS) {
    if (match instanceof RegExp ? match.test(raw) : raw.includes(match)) {
      return ru;
    }
  }

  // Если строка короткая и явно техническая (есть _, или начинается с PG, или url) — fallback.
  if (/^(PGRST|PG\d|[A-Z_]{4,}|https?:\/\/)/i.test(raw)) return fallback;
  // Если содержит SQL-фрагменты — fallback.
  if (/select |insert |update |from |where |relation /i.test(raw)) return fallback;

  // Иначе доверяем тексту — но если он английский и длинный, fallback.
  if (raw.length > 120 && !/[а-яё]/i.test(raw)) return fallback;

  return raw;
}
