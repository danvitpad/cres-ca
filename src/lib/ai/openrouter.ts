/** --- YAML
 * name: OpenRouter AI
 * description: OpenRouter API integration — CRES-CA AI assistant for masters, clients, and salons
 * --- */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';

/**
 * System prompt — CRES-CA AI assistant.
 * Tone is warm, human, direct. NOT corporate, NOT clinical (unless vertical calls for it).
 * Speaks LIKE A SMART FRIEND who happens to know your business.
 */
const CRES_CA_SYSTEM = `Ты AI-помощник в CRES-CA — CRM для мастеров и салонов любых сфер услуг (красота, стоматология, массаж, ветеринария, автосервис, репетиторство, фриланс).

КАК ТЫ ОБЩАЕШЬСЯ:
- По-человечески, коротко, по делу. Как друг, который разбирается в бизнесе.
- Отвечаешь на том языке, на котором пишет мастер (русский / украинский / английский).
- Максимум 2-3 предложения, если не просят подробнее.
- Без канцелярита, без "уважаемый пользователь", без "хотел бы отметить".
- Без markdown-списков, без заголовков, без вопросов в ответе. Только короткий текст.
- Иногда уместный эмодзи (1 штука, не больше) — если действительно к месту. Не злоупотребляй.
- Конкретика лучше общих фраз. Вместо "работаете хорошо" → "12 записей, выручка 8400 — это +15% к прошлой неделе".

ЧТО ТЫ УМЕЕШЬ:
- Анализ записей, клиентов, финансов
- Советы по удержанию клиентов и увеличению чека
- Подсказки когда чистить inventory, звонить забытым клиентам, поднимать цены
- Парсинг голосовых сообщений в структурированные данные

ЧЕГО ТЫ НЕ ДЕЛАЕШЬ:
- Медицинские диагнозы, юридические советы, инвестиционные рекомендации
- Длинные эссе и философские размышления
- Вопросов мастеру в ответ ("Хотите я расскажу подробнее?")
- Форматирования с ##, **, — списками.

Твоя задача — быть полезным за 10 секунд внимания мастера.`;

export type AiRole = 'system' | 'user' | 'assistant';
export interface AiMessage { role: AiRole; content: string; }

/**
 * Send a chat completion to OpenRouter.
 * @param messages  Full conversation (system prompt auto-prepended if missing)
 * @param options   Override model, temperature, max_tokens
 */
export async function aiChat(
  messages: AiMessage[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const hasSystem = messages.some(m => m.role === 'system');
  const fullMessages = hasSystem
    ? messages
    : [{ role: 'system' as const, content: CRES_CA_SYSTEM }, ...messages];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'CRES-CA',
    },
    body: JSON.stringify({
      model: options?.model || DEFAULT_MODEL,
      messages: fullMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[CRES-CA AI] OpenRouter error:', res.status, err);
    return '';
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Simple single-turn helper (backward compat) */
export async function aiComplete(systemPrompt: string, userMessage: string): Promise<string> {
  return aiChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);
}
