/** --- YAML
 * name: Client AI concierge
 * description: Parses a free-form client message ("найди маникюр до 800 в центре Киева на завтра")
 *              into structured search params. Re-uses ai-router (Gemini fallback) for JSON extraction.
 * created: 2026-04-24
 * --- */

import { textToJSON, voiceToText, AIUnavailableError, extractJSON } from './router';

export interface ConciergeIntent {
  service: string | null;      // e.g. "маникюр"
  city: string | null;         // e.g. "Киев"
  price_max: number | null;    // UAH
  when_hint: string | null;    // raw hint: "завтра", "в пятницу"  (future use — actual scheduling in Phase 4)
  raw: string;                 // original transcript
}

const PROMPT = `Ты — AI-консьерж в приложении CRES-CA (услуги beauty/красоты). Клиент пишет или говорит голосом что хочет найти.

Извлеки параметры поиска и верни СТРОГО JSON:
{
  "service": "маникюр" | "стрижка" | "окрашивание" | null,
  "city": "Киев" | "Львов" | null,
  "price_max": 800 | null,    // integer UAH, null если не указан
  "when_hint": "завтра" | "в пятницу" | null    // человек-читаемый hint, null если не указан
}

Правила:
- Возвращай только реальные услуги красоты (маникюр, педикюр, стрижка, окрашивание, брови, ресницы, массаж и т.п.)
- Город нормализуй к именительному падежу ("в Киеве" → "Киев")
- Если в сообщении ничего полезного нет — все поля null
- Никаких комментариев, только JSON`;

export async function parseClientConciergeText(userText: string): Promise<ConciergeIntent> {
  try {
    const { data: raw } = await textToJSON({ systemPrompt: PROMPT, userMessage: userText });
    const parsed = extractJSON<Record<string, unknown>>(raw);
    if (!parsed) throw new Error('unparseable');
    return normalise(parsed, userText);
  } catch (e) {
    if (e instanceof AIUnavailableError) throw e;
    return emptyIntent(userText);
  }
}

export async function parseClientConciergeVoice(audioBase64: string, mimeType: string): Promise<ConciergeIntent> {
  const { data: transcript } = await voiceToText({ audioBase64, mimeType });
  return parseClientConciergeText(transcript);
}

function normalise(obj: Record<string, unknown>, raw: string): ConciergeIntent {
  const asString = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const asNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
    return null;
  };
  return {
    service: asString(obj.service),
    city: asString(obj.city),
    price_max: asNumber(obj.price_max),
    when_hint: asString(obj.when_hint),
    raw,
  };
}

function emptyIntent(raw: string): ConciergeIntent {
  return { service: null, city: null, price_max: null, when_hint: null, raw };
}

/** True if intent has at least one usable filter. */
export function isConciergeUsable(intent: ConciergeIntent): boolean {
  return !!(intent.service || intent.city);
}
