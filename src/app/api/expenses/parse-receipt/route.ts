/** --- YAML
 * name: Parse Receipt OCR
 * description: POST multipart/form-data with `file` (receipt image). Uses OpenRouter Vision model to extract amount, currency, category, vendor, date. Returns JSON.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import { NextRequest, NextResponse } from 'next/server';


const PROMPT = `Extract the total amount, currency, merchant name, date, and expense category from this receipt image. Return ONLY a compact JSON object with keys: amount (number), currency (ISO code like UAH/USD/EUR), vendor (string), date (YYYY-MM-DD), category (string, e.g. "Расходники", "Аренда", "Еда", "Транспорт", "Коммунальные", "Реклама", "Прочее"). If a field is missing, use null. No prose.`;

export async function POST(request: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OCR not configured' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = file.type || 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://cres.ca',
      'X-Title': 'CRES-CA Receipt OCR',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: 'OCR failed', detail: err.slice(0, 500) }, { status: 502 });
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'no JSON', raw: text.slice(0, 500) }, { status: 502 });
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, result: parsed });
  } catch {
    return NextResponse.json({ error: 'parse failed', raw: jsonMatch[0].slice(0, 500) }, { status: 502 });
  }
}
