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

const GEMINI_KEY = () => (process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY || '').trim();
const OPENROUTER_KEY = () => (process.env.OPENROUTER_API_KEY || '').trim();

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

// Voice audio → JSON intent (Gemini can eat audio directly)
const VOICE_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

// Text → JSON / text (ordered by preference)
const TEXT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const TEXT_OPENROUTER_MODELS = [
  'deepseek/deepseek-chat-v3.1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
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
  const systemPrompt =
    'Ты транскрибируешь аудио в текст. Верни ТОЛЬКО транскрипт, без комментариев, без markdown. ' +
    'Сохраняй язык оригинала. Убирай мусорные слова-паразиты («ну», «эээ», повторы). Сохраняй смысл.';

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
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All Gemini transcription models failed', log);
}

/* ═══════════════ TEXT (text → JSON) ═══════════════ */

export async function textToJSON(params: {
  systemPrompt: string;
  userMessage: string;
}): Promise<AICallResult> {
  const log: AICallLog[] = [];

  // Gemini first
  for (let i = 0; i < TEXT_GEMINI_MODELS.length; i++) {
    const model = TEXT_GEMINI_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callGeminiText(model, params.systemPrompt, [{ role: 'user', content: params.userMessage }]);
      if (text) {
        log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `gemini/${model}`, log };
      }
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  // OpenRouter fallback
  if (!OPENROUTER_KEY()) {
    throw new AIUnavailableError('All Gemini failed and no OPENROUTER_API_KEY set', log);
  }

  for (let i = 0; i < TEXT_OPENROUTER_MODELS.length; i++) {
    const model = TEXT_OPENROUTER_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callOpenRouter(model, params.systemPrompt, [{ role: 'user', content: params.userMessage }]);
      if (text) {
        log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `openrouter/${model}`, log };
      }
      log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All 5 models failed', log);
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

  // Free-only chain: Gemini (primary) → OpenRouter free models (fallback).
  // Никаких платных провайдеров — продукт остаётся zero-cost для пользователя.
  for (let i = 0; i < TEXT_GEMINI_MODELS.length; i++) {
    const model = TEXT_GEMINI_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callGeminiText(model, params.systemPrompt, params.history, params.maxTokens);
      if (text) {
        log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `gemini/${model}`, log };
      }
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: 'gemini', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  if (!OPENROUTER_KEY()) throw new AIUnavailableError('All Gemini failed', log);

  for (let i = 0; i < TEXT_OPENROUTER_MODELS.length; i++) {
    const model = TEXT_OPENROUTER_MODELS[i];
    const t0 = Date.now();
    try {
      const text = await callOpenRouter(model, params.systemPrompt, params.history, params.maxTokens);
      if (text) {
        log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: true });
        return { data: text, model: `openrouter/${model}`, log };
      }
      log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: 'empty' });
    } catch (e) {
      log.push({ provider: 'openrouter', model, attempt: i + 1, ms: Date.now() - t0, ok: false, error: (e as Error).message });
    }
  }

  throw new AIUnavailableError('All free providers failed', log);
}

/* ═══════════════ Internals ═══════════════ */

async function callGeminiAudio(
  model: string,
  params: { audioBase64: string; mimeType: string; systemPrompt: string },
): Promise<string> {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY not set');

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
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  });

  if (res.status === 429 || res.status === 503) throw new Error(`${model} ${res.status}`);
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function callGeminiText(
  model: string,
  system: string,
  history: ChatMessage[],
  maxTokens = 1024,
): Promise<string> {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const contents = history
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(`${GOOGLE_BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });

  if (res.status === 429 || res.status === 503) throw new Error(`${model} ${res.status}`);
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
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
