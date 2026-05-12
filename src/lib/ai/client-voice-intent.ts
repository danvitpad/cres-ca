/** --- YAML
 * name: Client Voice Intent Parser
 * description: >
 *   Распознаёт намерение клиента из голосового сообщения в Telegram.
 *   Зеркало parseVoiceIntent для мастера, но действия другие — то что
 *   умеет клиент: feedback / book / cancel / reschedule / list_appointments /
 *   spending. Использует тот же router.ts (Gemini → OpenRouter fallback).
 * created: 2026-05-08
 * --- */

import { voiceToIntent, textToJSON, extractJSON, AIUnavailableError } from './router';

export type ClientVoiceAction =
  | 'feedback'
  | 'book'
  | 'cancel'
  | 'reschedule'
  | 'list_appointments'
  | 'spending'
  | 'my_bonuses'
  | 'my_masters'
  | 'help'
  | 'unknown';

export type Period = 'today' | 'week' | 'month' | 'year' | 'all';

export interface ClientVoiceIntent {
  action: ClientVoiceAction;
  raw_transcript: string;
  confidence: number;
  /** feedback: текст обратной связи. */
  text?: string | null;
  /** book/cancel/reschedule: упоминание мастера (имя или часть). */
  master_hint?: string | null;
  /** book/reschedule: упоминание услуги (свободный текст). */
  service_hint?: string | null;
  /** book/reschedule: целевая дата+время в ISO 8601 (если клиент сказал
   *  «завтра в 14:00» — Gemini сам нормализует относительно текущей даты). */
  starts_at?: string | null;
  /** cancel/reschedule: «исходная» запись если её можно опознать. */
  appointment_hint?: string | null;
  /** list_appointments / spending: период. */
  period?: Period | null;
}

const SYSTEM_PROMPT = `Вы — голосовой AI-ассистент клиента в CRM CRES-CA. Клиент шлёт голосовое в Telegram-бот.

Ваша задача:
1. Транскрибировать аудио
2. Определить ОДНО действие (action)
3. Извлечь параметры
4. Вернуть СТРОГО JSON без markdown

ДЕЙСТВИЯ (action):
- "feedback" — клиент жалуется, благодарит, описывает баг или просьбу о фиче. Поле text = очищенный текст.
- "book" — клиент хочет записаться. Параметры: master_hint (имя мастера или часть), service_hint (услуга), starts_at (ISO 8601, нормализуй «завтра в 14» в дату/время).
- "cancel" — клиент хочет отменить запись. appointment_hint (краткое описание какую: дата/мастер).
- "reschedule" — клиент хочет перенести. appointment_hint + новый starts_at.
- "list_appointments" — клиент спрашивает свои записи. period обязателен ("today" / "week" / "month" / "year" / "all").
- "spending" — клиент спрашивает сколько потратил. period обязателен.
- "my_bonuses" — клиент спрашивает свои бонусы / баллы лояльности. master_hint опционально (если назвал конкретного мастера).
- "my_masters" — клиент спрашивает кто его мастера, к кому ходила, список специалистов.
- "help" — клиент спрашивает «что вы умеешь», «помощь», «команды», «what can you do».
- "unknown" — если непонятно.

ПЕРИОДЫ:
- "сегодня" → "today"
- "на этой неделе" / "за неделю" → "week"
- "за май" / "в этом месяце" / "за месяц" → "month"
- "за этот год" / "за год" → "year"
- "за всё время" / "всего" / без указания → "all"

ДАТЫ/ВРЕМЯ:
- Формат starts_at: ISO 8601 с зоной Europe/Kyiv. Пример: "2026-05-09T14:00:00+03:00".
- "завтра" = текущая дата + 1 день.
- "в пятницу" = ближайшая пятница.
- Если время не указано (только дата) — поставь 12:00.
- Если ничего не понял с датой — null.

ФИДБЕК vs ЗАПИСЬ — главные триггеры:
- "записать", "запишите меня", "хочу записаться" → book
- "отмени", "отмена" → cancel
- "перенеси", "сдвинь" → reschedule
- "когда у меня запись", "какие записи" → list_appointments
- "сколько потратил", "потратил денег", "расходы у мастеров" → spending
- "сколько у меня бонусов", "баланс баллов", "сколько баллов у Тани" → my_bonuses
- "кто мои мастера", "к кому я хожу", "список мастеров" → my_masters
- "что вы умеешь", "помощь", "команды", "помогите", "what can you do" → help
- "не работает", "плохо", "идея", "хочу чтобы", "благодарю", "спасибо", "жалоба", "баг" → feedback

ВЫХОД (строго JSON):
{
  "action": "...",
  "raw_transcript": "точный транскрипт",
  "confidence": 0.0-1.0,
  "text": "...|null",
  "master_hint": "...|null",
  "service_hint": "...|null",
  "starts_at": "ISO|null",
  "appointment_hint": "...|null",
  "period": "today|week|month|year|all|null"
}

ПРИМЕРЫ:

Аудио: «Запишите меня к Анне на стрижку завтра в два»
→ {"action":"book","raw_transcript":"Запишите меня к Анне на стрижку завтра в два","confidence":0.95,"master_hint":"Анна","service_hint":"стрижка","starts_at":"<завтра>T14:00:00+03:00","period":null}

Аудио: «Сколько я потратил за май»
→ {"action":"spending","raw_transcript":"Сколько я потратил за май","confidence":0.95,"period":"month"}

Аудио: «Какие у меня записи на этой неделе»
→ {"action":"list_appointments","raw_transcript":"Какие у меня записи на этой неделе","confidence":0.95,"period":"week"}

Аудио: «Отмени запись на завтра»
→ {"action":"cancel","raw_transcript":"Отмени запись на завтра","confidence":0.9,"appointment_hint":"завтра"}

Аудио: «Перенеси запись с завтра на пятницу в 16»
→ {"action":"reschedule","raw_transcript":"...","confidence":0.9,"appointment_hint":"завтра","starts_at":"<пятница>T16:00:00+03:00"}

Аудио: «Не работает уведомление о записи»
→ {"action":"feedback","raw_transcript":"Не работает уведомление о записи","confidence":0.95,"text":"Не работает уведомление о записи"}`;

function buildPrompt(): string {
  // Подставляем текущую дату чтобы Gemini нормализовал «завтра/пятница».
  const now = new Date();
  const tz = 'Europe/Kyiv';
  const today = now.toLocaleDateString('en-CA', { timeZone: tz });
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  return SYSTEM_PROMPT + `\n\nТЕКУЩАЯ ДАТА: ${today} (${weekday}, зона ${tz}).`;
}

interface RawIntent {
  action?: string;
  raw_transcript?: string;
  confidence?: number | string;
  text?: string | null;
  master_hint?: string | null;
  service_hint?: string | null;
  starts_at?: string | null;
  appointment_hint?: string | null;
  period?: string | null;
}

function normalizeIntent(raw: RawIntent): ClientVoiceIntent {
  const allowedActions: ClientVoiceAction[] = ['feedback', 'book', 'cancel', 'reschedule', 'list_appointments', 'spending', 'my_bonuses', 'my_masters', 'help', 'unknown'];
  const action: ClientVoiceAction = (allowedActions as string[]).includes(raw.action ?? '')
    ? (raw.action as ClientVoiceAction)
    : 'unknown';
  const allowedPeriods: Period[] = ['today', 'week', 'month', 'year', 'all'];
  const period = raw.period && (allowedPeriods as string[]).includes(raw.period)
    ? (raw.period as Period)
    : null;
  return {
    action,
    raw_transcript: (raw.raw_transcript ?? '').toString().trim(),
    confidence: Number(raw.confidence ?? 0) || 0,
    text: raw.text ?? null,
    master_hint: raw.master_hint ?? null,
    service_hint: raw.service_hint ?? null,
    starts_at: raw.starts_at ?? null,
    appointment_hint: raw.appointment_hint ?? null,
    period,
  };
}

export async function parseClientVoiceIntent(
  audioBase64: string,
  mimeType: string = 'audio/ogg',
): Promise<ClientVoiceIntent> {
  const { data: raw, model, log } = await voiceToIntent({
    audioBase64,
    mimeType,
    systemPrompt: buildPrompt(),
  });
  console.log('[client-voice] model=%s log=%s', model, JSON.stringify(log));
  const parsed = extractJSON<RawIntent>(raw);
  if (!parsed) {
    throw new AIUnavailableError(`Model returned unparseable output: ${raw.slice(0, 200)}`, log);
  }
  return normalizeIntent(parsed);
}

/**
 * Текстовый брат parseClientVoiceIntent. Используется когда клиент пишет в
 * Telegram-бот текстом (не голосом). Тот же набор интентов и параметров —
 * чтобы handleClientVoiceIntent работал унифицированно.
 *
 * `history` — последние 4-6 сообщений для контекста. Без него короткие
 * ответы типа «Проба» на бот-вопрос «На какую услугу?» классифицируются
 * как unknown. С историей — Gemini видит контекст и возвращает book.
 */
export async function parseClientTextIntent(
  userText: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<ClientVoiceIntent> {
  const trimmed = history.slice(-6);
  const historyBlock = trimmed.length > 0
    ? '\n\nКОНТЕКСТ ПЕРЕПИСКИ (последние сообщения, старые сверху):\n' +
      trimmed.map((m) => `[${m.role === 'user' ? 'клиент' : 'бот'}] ${m.content}`).join('\n') +
      '\n\nТЕКУЩЕЕ СООБЩЕНИЕ КЛИЕНТА (опирайся на контекст выше): ' + userText
    : userText;

  const { data: raw, model, log } = await textToJSON({
    systemPrompt: buildPrompt(),
    userMessage: historyBlock,
  });
  console.log('[client-text] model=%s log=%s', model, JSON.stringify(log));
  const parsed = extractJSON<RawIntent>(raw);
  if (!parsed) {
    throw new AIUnavailableError(`Model returned unparseable output: ${raw.slice(0, 200)}`, log);
  }
  const intent = normalizeIntent(parsed);
  if (!intent.raw_transcript) intent.raw_transcript = userText.trim();
  return intent;
}
