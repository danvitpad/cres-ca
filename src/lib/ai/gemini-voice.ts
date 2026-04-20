/** --- YAML
 * name: Voice Intent Parser
 * description: >
 *   Sends Telegram voice to the unified AI router (router.ts). Primary path:
 *   Gemini 2.5/2.0 Flash audio→JSON. Fallback: OpenRouter Whisper (audio→text)
 *   + free text LLM (text→intent). No more "AI перегружен" — chain of 5+ models.
 * created: 2026-04-16
 * updated: 2026-04-20
 * --- */

import { voiceToIntent, extractJSON, AIUnavailableError } from './router';

export type VoiceAction =
  | 'reminder'
  | 'appointment'
  | 'expense'
  | 'expense_recurring'
  | 'revenue'
  | 'client_note'
  | 'inventory'
  | 'cancel'
  | 'reschedule'
  | 'create_client'
  | 'supplier_order'
  | 'query'
  | 'unknown';

export interface VoiceIntent {
  action: VoiceAction;
  text: string;
  due_at: string | null;
  client_name: string | null;
  amount: number | null;
  service_name: string | null;
  raw_transcript: string;
  confidence: number;
  items?: { client_name?: string; service_name?: string; amount?: number; name?: string; quantity?: number; unit?: string }[];
  phone?: string | null;
  notes?: string | null;
  new_due_at?: string | null;
  // expense_recurring
  day_of_month?: number | null;
  category?: string | null;
  // supplier_order
  supplier_name?: string | null;
  channel?: 'telegram' | 'email' | null;
}

const SYSTEM_PROMPT = `Ты — AI-ассистент мастера beauty/service индустрии. Мастер отправляет голосовое сообщение или текст.

Твоя задача:
1. Транскрибировать аудио (если есть)
2. Понять намерение
3. Извлечь структурированные данные
4. Перефразировать ЕСТЕСТВЕННО (не дословно)

Перефразирование — примеры:
- "Антону отправить сообщение" → "Отправить сообщение Антону"
- "потратил пятьсот гривен на материалы" → "Материалы — 500 ₴"
- "сегодня была Аня стрижка тысяча двести" → "Стрижка — Аня"

ДЕЙСТВИЯ (action):
- "reminder" — напоминание (позвонить, купить, сделать что-то)
- "appointment" — создать запись на услугу
- "cancel" — отменить запись клиента
- "reschedule" — перенести запись (due_at=старая дата, new_due_at=новая)
- "expense" — разовая трата денег (купил краску за 500, заплатил курьеру)
- "expense_recurring" — РЕГУЛЯРНЫЙ расход (аренда 5000 каждое 1-е число, интернет 300 каждое 15-е). Обязательно поле day_of_month (1-28). Поле category — тип (Аренда/Коммунальные/Связь/Прочее).
- "revenue" — приход/выручка (перечисление "Аня стрижка 1200, Маша окрашивание 2500")
- "client_note" — заметка о клиенте (аллергия, питомцы, предпочтения)
- "inventory" — физическое списание со склада (200 мл краски, 3 шт перчаток). БЕЗ денег.
- "supplier_order" — заказ у поставщика ("заказать у Ивана 5 кг краски и 3 щётки, отправить на телеграм"). Поля: supplier_name, items[{name, quantity, unit}], channel ('telegram' | 'email' | null).
- "create_client" — добавить нового клиента (client_name обязательно, phone опционально, notes опционально)
- "query" — вопрос (сколько заработал, сколько записей, кто спящий клиент)
- "unknown" — не удалось понять

Правила дат (Europe/Kyiv, UTC+3):
- "завтра" = следующий день
- "в пятницу" = ближайшая пятница
- "через час" = текущее время + 1 час
- "вечером" = 18:00
- Если время не указано, дата есть — ставь 09:00
- Ни дата ни время не упомянуты — due_at = null
- ISO формат с +03:00

Текущая дата/время: {{NOW}} (UTC). В Киеве: {{NOW_KYIV}}.

ПРИМЕРЫ ВЫВОДА (всегда строго один JSON-объект без markdown и комментариев):

"напомни завтра в 10 позвонить Анне":
{"action":"reminder","text":"Позвонить Анне","due_at":"2026-04-21T10:00:00+03:00","client_name":"Анна","amount":null,"service_name":null,"raw_transcript":"...","confidence":0.95}

"записать Машу на стрижку в пятницу 15:00":
{"action":"appointment","text":"Стрижка — Маша","due_at":"2026-04-24T15:00:00+03:00","client_name":"Маша","amount":null,"service_name":"Стрижка","raw_transcript":"...","confidence":0.9}

"отмени Колю завтра":
{"action":"cancel","text":"Отменить запись Коли","client_name":"Коля","due_at":"2026-04-21T09:00:00+03:00","amount":null,"service_name":null,"raw_transcript":"...","confidence":0.9}

"перенеси Иру с пятницы на субботу 14:00":
{"action":"reschedule","text":"Перенести запись Иры","client_name":"Ира","due_at":"2026-04-24T00:00:00+03:00","new_due_at":"2026-04-25T14:00:00+03:00","amount":null,"service_name":null,"raw_transcript":"...","confidence":0.9}

"потратил 500 на краску":
{"action":"expense","text":"Краска — 500 ₴","amount":500,"category":"Расходники","due_at":null,"client_name":null,"service_name":null,"raw_transcript":"...","confidence":0.95}

"аренда 5000 каждое 1-е число":
{"action":"expense_recurring","text":"Аренда — 5000 ₴","amount":5000,"day_of_month":1,"category":"Аренда","client_name":null,"service_name":null,"due_at":null,"raw_transcript":"...","confidence":0.95}

"выручка сегодня: Аня стрижка 1200, Маша окрашивание 2500":
{"action":"revenue","text":"Выручка за день","items":[{"client_name":"Аня","service_name":"Стрижка","amount":1200},{"client_name":"Маша","service_name":"Окрашивание","amount":2500}],"amount":3700,"client_name":null,"service_name":null,"due_at":null,"raw_transcript":"...","confidence":0.9}

"у Даши чихуахуа Буся":
{"action":"client_note","text":"Чихуахуа Буся","client_name":"Даша","due_at":null,"amount":null,"service_name":null,"raw_transcript":"...","confidence":0.9}

"списал 200 мл краски":
{"action":"inventory","text":"Списание 200 мл краски","service_name":"краска","amount":200,"client_name":null,"due_at":null,"raw_transcript":"...","confidence":0.9}

"заказать у Ивана 5 кг краски и 3 щётки, отправить на телеграм":
{"action":"supplier_order","text":"Заказ у Ивана","supplier_name":"Иван","items":[{"name":"краска","quantity":5,"unit":"кг"},{"name":"щётки","quantity":3,"unit":"шт"}],"channel":"telegram","client_name":null,"amount":null,"service_name":null,"due_at":null,"raw_transcript":"...","confidence":0.9}

"новая клиентка Марина телефон 0671234567":
{"action":"create_client","text":"Новый клиент Марина","client_name":"Марина","phone":"0671234567","notes":null,"due_at":null,"amount":null,"service_name":null,"raw_transcript":"...","confidence":0.95}

"сколько заработал сегодня":
{"action":"query","text":"Сколько заработал сегодня","client_name":null,"amount":null,"service_name":null,"due_at":null,"raw_transcript":"...","confidence":0.95}

ВАЖНО: ответь ТОЛЬКО одним JSON-объектом, без комментариев и без markdown.`;

function buildPrompt(): string {
  const now = new Date().toISOString();
  const nowKyiv = new Date().toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  return SYSTEM_PROMPT.replace('{{NOW}}', now).replace('{{NOW_KYIV}}', nowKyiv);
}

function normalizeIntent(obj: Record<string, unknown>): VoiceIntent {
  return {
    action: (obj.action as VoiceAction) || 'unknown',
    text: String(obj.text ?? obj.raw_transcript ?? ''),
    due_at: (obj.due_at as string | null) ?? null,
    client_name: (obj.client_name as string | null) ?? null,
    amount: obj.amount != null ? Number(obj.amount) : null,
    service_name: (obj.service_name as string | null) ?? null,
    raw_transcript: String(obj.raw_transcript ?? obj.text ?? ''),
    confidence: Number(obj.confidence ?? 0.5),
    items: Array.isArray(obj.items) ? obj.items : undefined,
    phone: (obj.phone as string | null) ?? null,
    notes: (obj.notes as string | null) ?? null,
    new_due_at: (obj.new_due_at as string | null) ?? null,
    day_of_month: obj.day_of_month != null ? Number(obj.day_of_month) : null,
    category: (obj.category as string | null) ?? null,
    supplier_name: (obj.supplier_name as string | null) ?? null,
    channel: (obj.channel as 'telegram' | 'email' | null) ?? null,
  };
}

export async function parseVoiceIntent(
  audioBase64: string,
  mimeType: string = 'audio/ogg',
): Promise<VoiceIntent> {
  const { data: raw, model, log } = await voiceToIntent({
    audioBase64,
    mimeType,
    systemPrompt: buildPrompt(),
  });
  console.log('[voice] model=%s log=%s', model, JSON.stringify(log));
  const parsed = extractJSON<Record<string, unknown>>(raw);
  if (!parsed) {
    throw new AIUnavailableError(`Model returned unparseable output: ${raw.slice(0, 200)}`, log);
  }
  return normalizeIntent(parsed);
}

/** Parse intent from plain text (used by /today chat). Same schema. */
export async function parseTextIntent(userText: string): Promise<VoiceIntent> {
  const { textToJSON } = await import('./router');
  const { data: raw, model, log } = await textToJSON({
    systemPrompt: buildPrompt(),
    userMessage: userText,
  });
  console.log('[text-intent] model=%s log=%s', model, JSON.stringify(log));
  const parsed = extractJSON<Record<string, unknown>>(raw);
  if (!parsed) {
    throw new AIUnavailableError(`Model returned unparseable output: ${raw.slice(0, 200)}`, log);
  }
  return normalizeIntent(parsed);
}

/** Download a Telegram voice file and return as base64 */
export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const fileInfo = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileInfo.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error('Could not get Telegram file path');

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileResponse = await fetch(fileUrl);
  const buffer = await fileResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const detectedMime = filePath.endsWith('.oga') || filePath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg';
  return { base64, mimeType: detectedMime };
}
