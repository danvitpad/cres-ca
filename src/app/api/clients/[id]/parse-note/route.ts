/** --- YAML
 * name: Parse Client Note via AI
 * description: Master sends free-form text about a client → Gemini classifies and persists.
 *              Categories: notes (lifestyle/preferences/family), health (allergies/contraindications),
 *              personal (DOB hint), milestone (kid name, pet name).
 *              Returns { applied: { notes, allergies, contraindications, ... }, summary }
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { aiComplete } from '@/lib/ai/openrouter';

interface ParseResult {
  notes_append?: string;          // freeform text added to client.notes
  allergies_add?: string[];       // concrete allergens (peanut / lidocaine / etc)
  contraindications_add?: string[]; // health flags (pregnancy / hypertension / etc)
  summary?: string;               // short human-readable confirmation
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
- Выводи ТОЛЬКО JSON, без markdown, без комментариев

Примеры:

Вход: "у клиента собака пудель, зовут бакс"
Выход: {"notes_append":"Собака — пудель, кличка Бакс","summary":"Добавлена заметка про питомца."}

Вход: "аллергия на латекс"
Выход: {"allergies_add":["латекс"],"summary":"Добавлена аллергия: латекс."}

Вход: "беременная, второй триместр + муж зовут Олег, двое детей"
Выход: {"contraindications_add":["беременность"],"notes_append":"Беременность, второй триместр. Муж — Олег. Двое детей","summary":"Сохранил беременность как противопоказание + личные детали в заметках."}`;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length < 2) {
    return NextResponse.json({ error: 'empty_text' }, { status: 400 });
  }

  // Authorization: master must own this client
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin.from('masters').select('id').eq('profile_id', user.id).maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: client } = await admin
    .from('clients')
    .select('id, master_id, notes, allergies, contraindications, has_health_alert')
    .eq('id', id)
    .maybeSingle();
  if (!client || client.master_id !== master.id) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  }

  // Ask AI
  let parsed: ParseResult = {};
  try {
    const raw = await aiComplete(SYSTEM_PROMPT, text);
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]) as ParseResult;
  } catch (e) {
    console.error('[parse-note] AI parse failed:', e);
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }

  // Apply to DB
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
    return NextResponse.json({
      applied: false,
      summary: parsed.summary || 'Не нашёл что сохранить — попробуй переформулировать.',
    });
  }

  const { error } = await admin.from('clients').update(updates).eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    applied: true,
    summary: parsed.summary || 'Информация сохранена.',
    fields: Object.keys(updates),
  });
}
