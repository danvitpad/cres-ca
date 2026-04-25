/** --- YAML
 * name: Mini App — Parse Partnership Note via AI
 * description: Master Mini App version. Uses initData. Same Gemini prompt as web /api/partners/[id]/parse-note.
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';
import { aiComplete } from '@/lib/ai/openrouter';

interface ParseResult {
  notes_append?: string;
  contract_terms_append?: string;
  commission_percent?: number;
  promo_code?: string;
  cross_promotion?: boolean;
  summary?: string;
}

const SYSTEM_PROMPT = `Ты помощник CRES-CA. Мастер записывает свободным текстом информацию про партнёра — другого мастера или команду (салон, клинику), с которым у него есть договорённость о взаимной рекомендации/рекламе.

Верни строго JSON:

{
  "notes_append": "<заметки про сотрудничество>",
  "contract_terms_append": "<договорные условия, оплата, бренд>",
  "commission_percent": <0..100, если упоминается>,
  "promo_code": "<промокод партнёра для наших>",
  "cross_promotion": <true|false если сказано «включи/выключи рекламу»>,
  "summary": "<1-2 предложения, что добавлено>"
}

Все поля опциональны. summary всегда. Только JSON.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { initData?: string; partnership_id?: string; text?: string }
    | null;
  if (!body?.initData || !body?.partnership_id || !body?.text) {
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

  const { data: partnership } = await admin
    .from('master_partnerships')
    .select('id, master_id, partner_id, note, contract_terms, commission_percent, promo_code, cross_promotion')
    .eq('id', body.partnership_id)
    .maybeSingle();
  if (!partnership || (partnership.master_id !== master.id && partnership.partner_id !== master.id)) {
    return NextResponse.json({ error: 'partnership_not_found' }, { status: 404 });
  }

  let parsed: ParseResult = {};
  try {
    const raw = await aiComplete(SYSTEM_PROMPT, text);
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]) as ParseResult;
  } catch (e) {
    console.error('[miniapp parse-note partner] AI failed:', e);
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  const stamp = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (parsed.notes_append) {
    const existing = (partnership.note ?? '').trim();
    const block = `[${stamp}] ${parsed.notes_append}`;
    updates.note = existing ? `${existing}\n${block}` : block;
  }
  if (parsed.contract_terms_append) {
    const existing = (partnership.contract_terms ?? '').trim();
    const block = `[${stamp}] ${parsed.contract_terms_append}`;
    updates.contract_terms = existing ? `${existing}\n${block}` : block;
  }
  if (typeof parsed.commission_percent === 'number' && Number.isFinite(parsed.commission_percent)) {
    updates.commission_percent = Math.max(0, Math.min(100, parsed.commission_percent));
  }
  if (parsed.promo_code) updates.promo_code = parsed.promo_code.trim().slice(0, 64);
  if (typeof parsed.cross_promotion === 'boolean') updates.cross_promotion = parsed.cross_promotion;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ applied: false, summary: parsed.summary || 'Не нашёл что сохранить.' });
  }

  const { error } = await admin.from('master_partnerships').update(updates).eq('id', body.partnership_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    applied: true,
    summary: parsed.summary || 'Информация сохранена.',
    fields: Object.keys(updates),
  });
}
