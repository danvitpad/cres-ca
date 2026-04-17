/** --- YAML
 * name: OpenRouter AI
 * description: OpenRouter API integration — CRES-CA AI assistant for masters, clients, and salons
 * --- */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';

/** System prompt that constrains the AI to CRES-CA domain */
const CRES_CA_SYSTEM = `You are CRES-CA AI — an intelligent assistant embedded in a CRM platform for service businesses (beauty salons, dental clinics, massage therapists, etc.).

RULES:
- You ONLY help with tasks related to the service business: appointments, clients, inventory, marketing, finance.
- You respond in the same language the user writes in (Ukrainian, Russian, or English).
- You are concise — 1-3 sentences unless asked for detail.
- You NEVER generate medical diagnoses, legal advice, or financial investment advice.
- You can: summarize client notes, suggest upsells, draft reminder messages, analyze appointment patterns, convert voice notes to structured data, calculate inventory usage.
- When suggesting actions (book, message, discount), format them as actionable items the UI can parse.
- Be warm and professional — you represent the master's brand to their clients.`;

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
