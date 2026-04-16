/** --- YAML
 * name: Gemini Voice Intent Parser
 * description: Sends Telegram voice .ogg to Gemini 2.5 Flash, returns structured intent (reminder, appointment, expense, client_note, query). One API call — audio natively understood.
 * created: 2026-04-16
 * --- */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export type VoiceAction =
  | 'reminder'
  | 'appointment'
  | 'expense'
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
}

const SYSTEM_PROMPT = `Ты — AI-ассистент мастера beauty/service индустрии. Мастер отправляет голосовое сообщение.

Твоя задача:
1. Транскрибировать аудио
2. Понять намерение
3. Извлечь структурированные данные

Возможные действия (action):
- "reminder" — напоминание (позвонить, купить, сделать что-то)
- "appointment" — создать/записать клиента на услугу
- "expense" — записать расход (купил краску, заплатил за аренду)
- "client_note" — заметка о клиенте (аллергия, предпочтения)
- "cancel" — отменить запись
- "reschedule" — перенести запись
- "query" — вопрос (сколько заработал, сколько записей)
- "unknown" — не удалось понять

Правила для дат:
- "завтра" = следующий день от текущей даты
- "в пятницу" = ближайшая пятница
- "через час" = текущее время + 1 час
- "вечером" = 18:00 текущего дня
- Если время не указано, но дата есть — ставь 09:00
- Если ни дата ни время не указаны — due_at = null

Текущая дата/время: {{NOW}}

Верни ТОЛЬКО JSON, без markdown:
{
  "action": "reminder",
  "text": "краткое описание действия на русском",
  "due_at": "2026-04-17T10:00:00+03:00" или null,
  "client_name": "Имя" или null,
  "amount": 500 или null,
  "service_name": "название услуги" или null,
  "raw_transcript": "полная транскрипция аудио",
  "confidence": 0.95
}`;

export async function parseVoiceIntent(audioBase64: string, mimeType: string = 'audio/ogg'): Promise<VoiceIntent> {
  const now = new Date().toISOString();
  const prompt = SYSTEM_PROMPT.replace('{{NOW}}', now);

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: audioBase64,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const parsed: VoiceIntent = JSON.parse(text);
  return parsed;
}

/**
 * Download a Telegram voice file and return as base64
 */
export async function downloadTelegramFile(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  // Step 1: get file path
  const fileInfo = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileInfo.json();
  const filePath = fileData.result?.file_path;

  if (!filePath) {
    throw new Error('Could not get Telegram file path');
  }

  // Step 2: download file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileResponse = await fetch(fileUrl);
  const buffer = await fileResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  // Telegram voice = .oga (Opus in Ogg), Gemini accepts audio/ogg
  const mimeType = filePath.endsWith('.oga') || filePath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg';

  return { base64, mimeType };
}
