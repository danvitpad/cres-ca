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

type NoteCategory = 'personal' | 'family' | 'preferences' | 'health' | 'other';
const VALID_CATEGORIES: NoteCategory[] = ['personal', 'family', 'preferences', 'health', 'other'];

interface ParseNoteEntry {
  category: NoteCategory;
  text: string;
}

interface ParseResult {
  notes?: ParseNoteEntry[];        // freeform notes split by category
  allergies_add?: string[];        // concrete allergens (peanut / lidocaine / etc)
  contraindications_add?: string[]; // health flags (pregnancy / hypertension / etc)
  summary?: string;                // short human-readable confirmation
}

const SYSTEM_PROMPT = `Ты помощник CRESCA. Мастер записывает свободным текстом информацию про клиента.
Твоя задача — классифицировать сказанное и вернуть строго JSON следующей формы:

{
  "notes": [
    { "category": "family" | "preferences" | "personal" | "health" | "other", "text": "<краткая заметка одной строкой от 3-го лица>" }
  ],
  "allergies_add": ["<аллерген>", ...],
  "contraindications_add": ["<медицинское противопоказание>", ...],
  "summary": "<1-2 предложения по-русски, что добавлено>"
}

Категории:
- family — родственники / дети / питомцы / партнёр («Собака — пудель Бакс», «Муж Олег», «Двое детей: Маша и Петя»)
- preferences — вкусы / привычки / интересы / любимое ("Любит зелёный чай", "Любит Латвию", "Слушает рок")
- personal — биография / профессия / увлечения / другие персональные факты («Работает учителем», «Занималась балетом»)
- health — медицинские наблюдения, не классифицируемые как allergy/contraindication («Чувствительная кожа», «Низкое давление по утрам»)
- other — всё остальное, что не подходит ни в одну категорию

Правила:
- Если в одном сообщении несколько фактов — раздели на отдельные notes-объекты с правильной категорией каждый
- notes[].text — связное предложение от 3-го лица, краткое, без воды
- allergies_add — только аллергены/непереносимости (никотин, латекс, лидокаин, орехи) — НЕ дублируй в notes.health
- contraindications_add — только медицинские противопоказания (беременность, гипертония, диабет) — НЕ дублируй в notes.health
- НЕ изобретай. НЕ перефразируй ничего лишнего
- summary — 1-2 предложения по-русски о том, что добавлено
- Выводи ТОЛЬКО JSON, без markdown, без комментариев

Примеры:

Вход: "у клиента собака пудель, зовут бакс"
Выход: {"notes":[{"category":"family","text":"Собака — пудель, кличка Бакс"}],"summary":"Добавил заметку про питомца."}

Вход: "аллергия на латекс"
Выход: {"allergies_add":["латекс"],"summary":"Добавил аллергию: латекс."}

Вход: "беременная, второй триместр + муж зовут Олег, двое детей и она любит Латвию"
Выход: {
  "contraindications_add":["беременность"],
  "notes":[
    {"category":"family","text":"Муж — Олег. Двое детей"},
    {"category":"preferences","text":"Любит Латвию"}
  ],
  "summary":"Сохранил беременность в противопоказания, семью и предпочтения — в заметки."
}`;

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
  const newNotes: ParseNoteEntry[] = (parsed.notes ?? [])
    .filter((n): n is ParseNoteEntry => !!n && typeof n.text === 'string' && n.text.trim().length > 0)
    .map((n) => ({
      category: VALID_CATEGORIES.includes(n.category) ? n.category : 'other',
      text: n.text.trim(),
    }));
  if (newNotes.length) {
    const existing = (client.notes ?? '').trim();
    const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const blocks = newNotes.map((n) => `[${stamp}|${n.category}] ${n.text}`);
    updates.notes = existing ? `${existing}\n${blocks.join('\n')}` : blocks.join('\n');
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
