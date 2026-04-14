/** --- YAML
 * name: Voice Booking Parser
 * description: POST { text, masterId } — парсит команду в {client_name, date, time, duration_min, service_hint} через OpenRouter Gemini.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PROMPT = `You are a booking assistant. The master speaks or types a command like "запиши Машу на завтра в 15:00 на стрижку". Extract a compact JSON with: client_name (string), date (YYYY-MM-DD using today's date as reference), time (HH:MM 24h), duration_min (number, default 60 if unknown), service_hint (string or null). Today's date is provided. If a field is missing use null. Respond with ONLY the JSON, no prose.`;

export async function POST(request: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 });
  }
  const { text } = (await request.json()) as { text?: string };
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres.ca',
      'X-Title': 'CRES-CA Voice Booking',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Today: ${today}\nCommand: ${text}` },
      ],
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: 'LLM failed', detail: err.slice(0, 500) }, { status: 502 });
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content ?? '';
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return NextResponse.json({ error: 'no JSON', raw: out.slice(0, 300) }, { status: 502 });
  try {
    return NextResponse.json({ ok: true, result: JSON.parse(m[0]) });
  } catch {
    return NextResponse.json({ error: 'parse failed' }, { status: 502 });
  }
}
