/** --- YAML
 * name: AI Router
 * description: >
 *   Unified fallback chain for AI calls. Tries Gemini first (free, Google direct),
 *   falls back to OpenRouter free models. For audio — if all Gemini fails, uses
 *   Whisper via OpenRouter to transcribe, then any text LLM for intent.
 *   This is the ONE place that decides which model runs — all AI surfaces
 *   (voice webhook, /today chat, Mini App assistant) go through this.
 * created: 2026-04-20
 * --- */

/**
 * Gemini keys — collect ALL configured keys (deduped) so each model
 * attempt can rotate through every key before falling through. Using two
 * keys doubles the free-tier RPM/RPD budget.
 */
const GEMINI_KEYS = (): string[] => {
  const raw = [
    process.env.GOOGLE_AI_STUDIO_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_STUDIO_KEY_2,
    process.env.GEMINI_API_KEY_2,
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of raw) {
    const v = (k || '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      keys.push(v);
    }
  }
  return keys;
};
const OPENROUTER_KEY = () => (process.env.OPENROUTER_API_KEY || '').trim();

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

// Voice audio → JSON intent (Gemini can eat audio directly).
// 1.5-flash — старая, но устойчивая (отдельный бесплатный лимит, реже даёт 429/503).
const VOICE_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

// Унифицированная цепочка для текстовых вызовов: сильные свободные модели сверху,
// слабые/старые снизу. Те же модели и порядок что в master-ассистенте — Qwen3 и
// Nemotron мощнее Gemini Flash, поэтому они идут первыми. Если первая в лимите/
// упала/таймаут — переходим к следующей. Gemini 2.5/2.0 в середине как
// надёжный fallback (Google free tier стабильный). Llama в конце как последний
// рубеж.
type ModelEntry =
  | { type: 'gemini'; id: string }
  | { type: 'openrouter'; id: string };

const TEXT_MODEL_CHAIN: ModelEntry[] = [
  { type: 'openrouter', id: 'qwen/qwen3-next-80b-a3b-instruct:free' },     // 1. Qwen3 80B — сильнее и быстрее Gemini Flash, отлично знает русский
  { type: 'openrouter', id: 'nvidia/nemotron-3-super-120b-a12b:free' },    // 2. Nemotron 120B — большая NVIDIA, instruction-following
  { type: 'openrouter', id: 'openai/gpt-oss-120b:free' },                  // 3. OpenAI 120B open weights
  { type: 'openrouter', id: 'z-ai/glm-4.5-air:free' },                     // 4. GLM-4.5 Air — точная по фактам
  { type: 'gemini', id: 'gemini-2.5-flash' },                              // 5. Google Flash — стабильный fallback
  { type: 'gemini', id: 'gemini-2.0-flash' },                              // 6. старый Flash — тоже надёжный
  { type: 'openrouter', id: 'deepseek/deepseek-chat-v3.1:free' },          // 7. DeepSeek Chat (не R1 — без reasoning-задержки)
  { type: 'openrouter', id: 'meta-llama/llama-3.3-70b-instruct:free' },    // 8. Llama 3.3 — последний рубеж
];

export interface AICallLog {
  provider: 'gemini' | 'openrouter';
  model: string;
  attempt: number;
  ms: number;
  ok: boolean;
  error?: string;
}

/** Result of a successful call — text + which model served it, plus per-attempt log */
export interface AICallResult<T = string> {
  data: T;
  model: string;
  log: AICallLog[];
}

/* ═══════════════ VOICE (audio → JSON) ═══════════════ */

/**
 * Voice audio → intent JSON.
 * Only Gemini accepts audio inline (OpenRouter doesn't expose Whisper).
 * We run Gemini 2.5 then 2.0; each fails fast on 429/503.
 * Total worst-case ~4-6s, well under Vercel Hobby 10s timeout.
 */
export async function voiceToIntent(params: {
  audioBase64: string;
  mimeType: string;
  systemPrompt: string;
}): Promise<AICallResult> {
  const log: AICallLog[] = [];

  for (let i = 0; i < VOICE_GEMINI_MODELS.length; i++) {
    const model = VOICE_GEMINI_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callGeminiAudio(model, params);
      if (text) {
        log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `gemini/${model}`, log };
      }
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All Gemini audio models failed', log);
}

/**
 * Voice audio → plain text transcription.
 * Same Gemini chain as voiceToIntent but with a transcription-only prompt —
 * no JSON parsing, just the raw transcript text in the source language.
 */
export async function voiceToText(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<AICallResult> {
  const log: AICallLog[] = [];
  // Короткий prompt — длинный context для voice transcription у Gemini
  // приводил к "All Gemini transcription models failed" (см. логи 2026-05-07).
  // Минимум правил: язык оригинала, без воды, бренды как принято.
  const systemPrompt =
    'Транскрибируй аудио в текст. Верни ТОЛЬКО транскрипт, без комментариев. ' +
    'Сохраняй язык оригинала. Убирай слова-паразиты, но смысл и числа сохраняй. ' +
    'Бренды: CRES-CA, Telegram, Mini App.';

  for (let i = 0; i < VOICE_GEMINI_MODELS.length; i++) {
    const model = VOICE_GEMINI_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callGeminiAudio(model, { ...params, systemPrompt });
      if (text) {
        log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `gemini/${model}`, log };
      }
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      const errMsg = (e as Error).message;
      // Логируем ПОЛНУЮ ошибку для каждой модели (raw, не truncated) чтобы
      // можно было увидеть quota/auth/timeout прямо в Vercel logs.
      console.error(`[voiceToText] ${model} failed:`, errMsg.slice(0, 300));
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: errMsg });
    }
  }

  // Сводный лог по всем моделям перед throw — видно сразу всю цепочку
  // в один взгляд.
  console.error('[voiceToText] all models failed. Summary:',
    log.map((l) => `${l.model}=${l.error?.slice(0, 80) ?? 'ok'}`).join(' | '),
  );
  throw new AIUnavailableError('All Gemini transcription models failed', log);
}

/* ═══════════════ TEXT (text → JSON) ═══════════════ */

export async function textToJSON(params: {
  systemPrompt: string;
  userMessage: string;
}): Promise<AICallResult> {
  const log: AICallLog[] = [];
  const orHasKey = !!OPENROUTER_KEY();

  for (let i = 0; i < TEXT_MODEL_CHAIN.length; i++) {
    const entry = TEXT_MODEL_CHAIN[i];
    if (entry.type === 'openrouter' && !orHasKey) continue; // skip OR if нет ключа
    const t0 = Date.now();
    try {
      const text = entry.type === 'gemini'
        ? await callGeminiText(entry.id, params.systemPrompt, [{ role: 'user', content: params.userMessage }])
        : await callOpenRouter(entry.id, params.systemPrompt, [{ role: 'user', content: params.userMessage }]);
      if (text) {
        log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `${entry.type}/${entry.id}`, log };
      }
      log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All free providers failed', log);
}

/* ═══════════════ CHAT (text → human-readable reply) ═══════════════ */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(params: {
  systemPrompt: string;
  history: ChatMessage[];
  maxTokens?: number;
}): Promise<AICallResult> {
  const log: AICallLog[] = [];
  const orHasKey = !!OPENROUTER_KEY();

  // Унифицированная свободная цепочка — сильные модели сверху, более слабые
  // снизу. Если первая в лимите/упала/таймаут — переходим к следующей.
  // Никаких платных провайдеров — продукт остаётся zero-cost для пользователя.
  for (let i = 0; i < TEXT_MODEL_CHAIN.length; i++) {
    const entry = TEXT_MODEL_CHAIN[i];
    if (entry.type === 'openrouter' && !orHasKey) continue;
    const t0 = Date.now();
    try {
      const text = entry.type === 'gemini'
        ? await callGeminiText(entry.id, params.systemPrompt, params.history, params.maxTokens)
        : await callOpenRouter(entry.id, params.systemPrompt, params.history, params.maxTokens);
      if (text) {
        log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `${entry.type}/${entry.id}`, log };
      }
      log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: entry.type, model: entry.id, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All free providers failed', log);
}

/* ═══════════════ Internals ═══════════════ */

async function callGeminiAudio(
  model: string,
  params: { audioBase64: string; mimeType: string; systemPrompt: string },
): Promise<string> {
  const keys = GEMINI_KEYS();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY not set');

  let lastErr = '';
  // Rotate through every configured Gemini key. If first key hits 429/503 we
  // immediately retry with the second — doubles effective RPM on the free tier.
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    // 2.5-flash supports thinkingBudget; setting it to 0 disables thinking → 3-5x faster
    // and frees up output token budget for actual JSON. 2.0-flash ignores this field.
    const res = await fetch(`${GOOGLE_BASE}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: params.systemPrompt },
            { inline_data: { mime_type: params.mimeType, data: params.audioBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });

    if (res.status === 429 || res.status === 503) {
      lastErr = `${model} ${res.status} (key#${i + 1})`;
      continue; // try next key
    }
    if (!res.ok) {
      throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }
  throw new Error(lastErr || `${model} all keys failed`);
}

async function callGeminiText(
  model: string,
  system: string,
  history: ChatMessage[],
  maxTokens = 1024,
): Promise<string> {
  const keys = GEMINI_KEYS();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY not set');

  const contents = history
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  let lastErr = '';
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const res = await fetch(`${GOOGLE_BASE}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    });

    if (res.status === 429 || res.status === 503) {
      lastErr = `${model} ${res.status} (key#${i + 1})`;
      continue;
    }
    if (!res.ok) {
      throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }
  throw new Error(lastErr || `${model} all keys failed`);
}

async function callOpenRouter(
  model: string,
  system: string,
  history: ChatMessage[],
  maxTokens = 1024,
): Promise<string> {
  const key = OPENROUTER_KEY();
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history];

  const res = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://cres-ca.com',
      'X-Title': 'CRES-CA',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (res.status === 429 || res.status === 503) throw new Error(`${model} ${res.status}`);
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export class AIUnavailableError extends Error {
  log: AICallLog[];
  constructor(message: string, log: AICallLog[]) {
    super(message);
    this.name = 'AIUnavailableError';
    this.log = log;
  }
}

/** Extract JSON from LLM response — handles markdown, thinking preamble, truncation */
export function extractJSON<T = Record<string, unknown>>(raw: string): T | null {
  let text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1) return null;
  if (jsonEnd > jsonStart) {
    try {
      return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as T;
    } catch { /* fall through */ }
  }
  text = text.slice(jsonStart);
  text = text.replace(/,\s*"[^"]*"?\s*:?\s*[^,}]*$/, '') + '}';
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
