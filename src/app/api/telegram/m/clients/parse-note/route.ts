/** --- YAML
 * name: Mini App — Parse Client Note via AI
 * description: Master Mini App version of /api/clients/[id]/parse-note. Uses initData
 *              instead of Supabase cookie. Same Gemini prompt + same applied fields.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';
import { aiComplete } from '@/lib/ai/openrouter';

interface ParseResult {
  notes_append?: string;
  allergies_add?: string[];
  contraindications_add?: string[];
  summary?: string;
}

const SYSTEM_PROMPT = `Ты помощник CRES-CA. Мастер записывает свободным текстом информацию про клиента.
Твоя задача — классифицировать сказанное и вернуть строго JSON следующей формы:

{
  "notes_append": "<строка ДЛЯ заметок мастера: питомцы, хобби, семья, предпочтения, наблюдения, любые личные детали>",
  "allergies_add": ["<аллерген>", ...],
  "contraindications_add": ["<медицинское противопоказание>", ...],
  "summary": "<1-2 предложения по-русски, что добавлено>"
}

Правила:
- ВСЕ поля опциональны — добавляй только то, что реально вытекает из текста
- notes_append — связное предложение от 3-го лица (например "Собака — пудель, кличка Бакс. Двое детей")
- allergies_add — только аллергены/непереносимости (никотин, латекс, лидокаин, орехи)
- contraindications_add — только медицинские противопоказания (беременность, гипертония, диабет)
- НЕ изобретай. НЕ перефразируй мастера в notes — кратко суммируй
- summary всегда заполняй, 1-2 предложения, что добавлено
- Выводи ТОЛЬКО JSON, без markdown, без комментариев`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { initData?: string; client_id?: string; text?: string } | null;
  if (!body?.initData || !body?.client_id || !body?.text) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  const text = body.text.trim();
  if (text.length < 2) return NextResponse.json({ error: 'empty_text' }, { status: 400 });

  const result = validateInitData(body.initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'not_master' }, { status: 403 });
  const { data: master } = await admin.from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: client } = await admin
    .from('clients')
    .select('id, master_id, notes, allergies, contraindications')
    .eq('id', body.client_id)
    .maybeSingle();
  if (!client || client.master_id !== master.id) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  }

  let parsed: ParseResult = {};
  try {
    const raw = await aiComplete(SYSTEM_PROMPT, text);
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]) as ParseResult;
  } catch (e) {
    console.error('[miniapp parse-note client] AI failed:', e);
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.notes_append) {
    const existing = (client.notes ?? '').trim();
    const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const block = `[${stamp}] ${parsed.notes_append}`;
    updates.notes = existing ? `${existing}\n${block}` : block;
  }
  if (parsed.allergies_add?.length) {
    const existing = (client.allergies as string[] | null) ?? [];
    const set = new Set([...existing, ...parsed.allergies_add.map(s => s.toLowerCase().trim()).filter(Boolean)]);
    updates.allergies = Array.from(set);
    updates.has_health_alert = true;
  }
  if (parsed.contraindications_add?.length) {
    const existing = (client.contraindications as string[] | null) ?? [];
    const set = new Set([...existing, ...parsed.contraindications_add.map(s => s.toLowerCase().trim()).filter(Boolean)]);
    updates.contraindications = Array.from(set);
    updates.has_health_alert = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ applied: false, summary: parsed.summary || 'Не нашёл что сохранить.' });
  }

  const { error } = await admin.from('clients').update(updates).eq('id', body.client_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    applied: true,
    summary: parsed.summary || 'Информация сохранена.',
    fields: Object.keys(updates),
  });
}
