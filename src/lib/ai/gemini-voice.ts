/** --- YAML
 * name: Voice Intent Parser
 * description: Sends Telegram voice to Gemini 2.5 Flash with retry, returns structured intent.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

export type VoiceAction =
  | 'reminder'
  | 'appointment'
  | 'expense'
  | 'revenue'
  | 'client_note'
  | 'cancel'
  | 'reschedule'
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
  items?: { client_name: string; service_name: string; amount: number }[];
}

const SYSTEM_PROMPT = `Ты — AI-ассистент мастера beauty/service индустрии. Мастер отправляет голосовое сообщение.

Твоя задача:
1. Транскрибировать аудио
2. Понять намерение
3. Извлечь структурированные данные
4. Перефразировать текст ЕСТЕСТВЕННО и КРАСИВО (не дословная транскрипция, а человечная формулировка)

Примеры перефразирования:
- "Антону отправить сообщение" → "Отправить сообщение Антону"
- "краску купить завтра" → "Купить краску"
- "Маше напомнить про окрашивание" → "Напомнить Маше про окрашивание"
- "потратил пятьсот гривен на материалы" → "Материалы — 500 ₴"
- "сегодня была Аня стрижка тысяча двести" → text: "Стрижка — Аня", amount: 1200

Возможные действия (action):
- "reminder" — напоминание (позвонить, купить, сделать что-то)
- "appointment" — создать/записать клиента на услугу
- "expense" — записать расход (купил краску, заплатил за аренду, материалы)
- "revenue" — записать приход/выручку (мастер рассказывает кто был и за что заплатил)
- "client_note" — заметка о клиенте (аллергия, предпочтения)
- "cancel" — отменить запись
- "reschedule" — перенести запись
- "query" — вопрос (сколько заработал, сколько записей)
- "unknown" — не удалось понять

Если мастер перечисляет клиентов/услуги/суммы за день — это "revenue".
Если мастер говорит что потратил деньги — это "expense".

Правила для дат (таймзона мастера — Europe/Kyiv, UTC+3):
- "завтра" = следующий день от текущей даты
- "в пятницу" = ближайшая пятница
- "через час" = текущее время + 1 час
- "вечером" = 18:00 текущего дня
- Если время не указано, но дата есть — ставь 09:00
- Если ни дата ни время не указаны — due_at = null
- ВСЕ даты возвращай в формате ISO с таймзоной +03:00

Текущая дата/время: {{NOW}} (UTC). В Киеве сейчас {{NOW_KYIV}}.

Для "revenue" — если перечислено несколько клиентов/услуг, верни массив items:
{"action":"revenue","text":"Выручка за день","items":[{"client_name":"Аня","service_name":"Стрижка","amount":1200},{"client_name":"Маша","service_name":"Окрашивание","amount":2500}],"amount":3700,"raw_transcript":"...","confidence":0.9}

Для остальных — обычный формат:
{"action":"reminder","text":"Отправить сообщение Антону","due_at":"2026-04-17T10:00:00+03:00","client_name":"Антон","amount":null,"service_name":null,"raw_transcript":"полная транскрипция","confidence":0.9}

ВАЖНО: ответь ТОЛЬКО одним JSON-объектом, без комментариев и без markdown.`;

export async function parseVoiceIntent(audioBase64: string, mimeType: string = 'audio/ogg'): Promise<VoiceIntent> {
  const now = new Date().toISOString();
  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'full', timeStyle: 'short' });
  const prompt = SYSTEM_PROMPT.replace('{{NOW}}', now).replace('{{NOW_KYIV}}', nowKyiv);

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  });

  // Retry up to 5 times with backoff — model is available but intermittently 503
  const delays = [0, 2000, 3000, 5000, 8000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }

    try {
      const response = await fetch(geminiUrl('gemini-2.5-flash'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.status === 503 || response.status === 429) {
        console.log(`[voice] gemini-2.5-flash ${response.status}, attempt ${attempt + 1}/${delays.length}`);
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini ${response.status}: ${err.slice(0, 200)}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.log('[voice] empty response, retrying');
        continue;
      }

      console.log('[voice] raw response:', rawText.slice(0, 500));

      const parsed = extractJSON(rawText);
      if (parsed) return parsed;

      console.log('[voice] failed to parse JSON, retrying');
      continue;
    } catch (e) {
      if (attempt === delays.length - 1) throw e;
      console.log(`[voice] error attempt ${attempt + 1}:`, (e as Error).message);
    }
  }

  throw new Error('Gemini unavailable after 5 retries');
}

/** Extract JSON from Gemini response — handles markdown, thinking preamble, truncation */
function extractJSON(raw: string): VoiceIntent | null {
  // Strip markdown
  let text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Find the JSON object — Gemini 2.5 may output thinking text before JSON
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');

  if (jsonStart === -1) return null;

  if (jsonEnd > jsonStart) {
    try {
      return normalizeIntent(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));
    } catch { /* fall through */ }
  }

  // Truncated — try to fix
  text = text.slice(jsonStart);
  // Remove trailing incomplete key-value
  text = text.replace(/,\s*"[^"]*"?\s*:?\s*[^,}]*$/, '') + '}';
  try {
    return normalizeIntent(JSON.parse(text));
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIntent(obj: any): VoiceIntent {
  return {
    action: obj.action || 'unknown',
    text: obj.text || obj.raw_transcript || '',
    due_at: obj.due_at || null,
    client_name: obj.client_name || null,
    amount: obj.amount != null ? Number(obj.amount) : null,
    service_name: obj.service_name || null,
    raw_transcript: obj.raw_transcript || obj.text || '',
    confidence: obj.confidence || 0.5,
    items: Array.isArray(obj.items) ? obj.items : undefined,
  };
}

/** Download a Telegram voice file and return as base64 */
export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  const fileInfo = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileInfo.json();
  const filePath = fileData.result?.file_path;

  if (!filePath) {
    throw new Error('Could not get Telegram file path');
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileResponse = await fetch(fileUrl);
  const buffer = await fileResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const detectedMime = filePath.endsWith('.oga') || filePath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg';
  return { base64, mimeType: detectedMime };
}
