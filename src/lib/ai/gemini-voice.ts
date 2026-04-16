/** --- YAML
 * name: Voice Intent Parser
 * description: Sends Telegram voice to AI (Gemini chain with OpenRouter fallback), returns structured intent. Handles 503/429 with model fallback.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Gemini models: try in order. 2.5-flash (best), 1.5-flash (stable fallback), 2.0-flash-lite (lightweight)
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'] as const;

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

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

  const geminiBody = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });

  // ── Try Gemini models ──
  const errors: string[] = [];

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(geminiUrl(model), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: geminiBody,
        });

        if (response.status === 503 || response.status === 429) {
          const retryAfter = response.status === 429 ? 3000 : 1500;
          await new Promise((r) => setTimeout(r, retryAfter));
          continue;
        }

        if (!response.ok) {
          const err = await response.text();
          errors.push(`${model}: ${response.status}`);
          break; // try next model
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          errors.push(`${model}: empty response`);
          break;
        }

        console.log(`[voice] Success with ${model}`);
        return JSON.parse(text) as VoiceIntent;
      } catch (e) {
        errors.push(`${model}: ${(e as Error).message}`);
        break;
      }
    }
  }

  // ── Fallback: OpenRouter (text-only, no audio — but we try with data URI) ──
  if (OPENROUTER_API_KEY) {
    console.log('[voice] All Gemini failed, trying OpenRouter');
    try {
      const result = await parseViaOpenRouter(audioBase64, mimeType, prompt);
      if (result) return result;
    } catch (e) {
      errors.push(`openrouter: ${(e as Error).message}`);
    }
  }

  throw new Error(`All models failed: ${errors.join('; ')}`);
}

/** OpenRouter fallback — uses a multimodal model that accepts audio as data URI */
async function parseViaOpenRouter(audioBase64: string, mimeType: string, prompt: string): Promise<VoiceIntent | null> {
  // Use google/gemini-2.0-flash-exp:free via OpenRouter (different quota pool)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${audioBase64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty OpenRouter response');

  // Clean potential markdown wrapping
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  console.log('[voice] Success via OpenRouter');
  return JSON.parse(cleaned) as VoiceIntent;
}

/**
 * Download a Telegram voice file and return as base64
 */
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
