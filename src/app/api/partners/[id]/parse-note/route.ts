/** --- YAML
 * name: Parse Partnership Note via AI
 * description: Master writes free-form text about a partner → Gemini classifies and persists.
 *              Categories: notes (cooperation history, contacts, brand, vibe), contract_terms
 *              (commission, payment, branding rules), commission_percent, promo_code,
 *              cross_promotion (toggle).
 *              Returns { applied: { notes, contract_terms, ... }, summary }
 * created: 2026-04-25
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { aiComplete } from '@/lib/ai/openrouter';

interface ParseResult {
  notes_append?: string;          // freeform notes
  contract_terms_append?: string; // contract / branding / payout rules
  commission_percent?: number;    // % commission
  promo_code?: string;            // partner's promo code
  cross_promotion?: boolean;      // explicit toggle if user said "включи/выключи"
  summary?: string;
}

const SYSTEM_PROMPT = `Ты помощник CRES-CA. Мастер записывает свободным текстом информацию про партнёра — другого мастера или команду (салон, клинику), с которым у него есть договорённость о взаимной рекомендации/рекламе.

Твоя задача — классифицировать сказанное и вернуть строго JSON следующей формы:

{
  "notes_append": "<строка ДЛЯ заметок про сотрудничество: впечатления, общий клиент, контакты, бренд, что обсудили>",
  "contract_terms_append": "<договорные условия, оплата, правила брендинга, частота отчётов>",
  "commission_percent": <число от 0 до 100, если упоминается процент>,
  "promo_code": "<промокод который партнёр даёт нашим клиентам>",
  "cross_promotion": <true|false, если мастер сказал «включи/выключи рекламу»>,
  "summary": "<1-2 предложения по-русски, что добавлено>"
}

Правила:
- ВСЕ поля опциональны — добавляй только то, что реально вытекает из текста
- notes_append — связное предложение от 3-го лица («Делает скидку 10% нашим. Контакт: Telegram @oleg»). НЕ перефразируй мастера в стихи, кратко суммируй.
- contract_terms_append — только условия партнёрства (комиссия, выплаты, бренд, как считаем рекомендации). Если этого нет в тексте — не добавляй.
- commission_percent — только если явно сказано про процент («дам 10%», «комиссия 5», «без комиссии» → 0)
- promo_code — только реальный код («NAILS10», «promo_dental»)
- cross_promotion — true если мастер сказал «включи рекламу/рекомендацию», false если «выключи». Если ничего не сказано — не добавляй.
- summary всегда заполняй, 1-2 предложения, что добавлено
- Выводи ТОЛЬКО JSON, без markdown, без комментариев

Примеры:

Вход: "Олег стоматолог, договорились на взаимные рекомендации, у него промокод NAILS15 для наших"
Выход: {"notes_append":"Стоматолог Олег. Договорились о взаимных рекомендациях.","promo_code":"NAILS15","summary":"Сохранил договорённость и промокод NAILS15."}

Вход: "у клиники салон-стиль скидка нашим 10%, комиссия 5%, отчёт раз в месяц"
Выход: {"notes_append":"Клиника «Салон-Стиль» — скидка 10% нашим клиентам.","contract_terms_append":"Комиссия 5%. Отчёт раз в месяц.","commission_percent":5,"summary":"Записал условия партнёрства: комиссия 5%, скидка нашим 10%, ежемесячный отчёт."}

Вход: "пока выключи рекламу этого партнёра, спорный момент"
Выход: {"cross_promotion":false,"notes_append":"Реклама временно отключена — спорный момент.","summary":"Отключил кросс-рекламу для этого партнёра."}`;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: partnershipId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length < 2) {
    return NextResponse.json({ error: 'empty_text' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: master } = await admin
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!master) return NextResponse.json({ error: 'not_master' }, { status: 403 });

  const { data: partnership } = await admin
    .from('master_partnerships')
    .select('id, master_id, partner_id, note, contract_terms, commission_percent, promo_code, cross_promotion')
    .eq('id', partnershipId)
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
    console.error('[partner parse-note] AI failed:', e);
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  const stamp = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

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
  if (parsed.promo_code) {
    updates.promo_code = parsed.promo_code.trim().slice(0, 64);
  }
  if (typeof parsed.cross_promotion === 'boolean') {
    updates.cross_promotion = parsed.cross_promotion;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      applied: false,
      summary: parsed.summary || 'Не нашёл что сохранить — попробуй переформулировать.',
    });
  }

  const { error } = await admin
    .from('master_partnerships')
    .update(updates)
    .eq('id', partnershipId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    applied: true,
    summary: parsed.summary || 'Информация сохранена.',
    fields: Object.keys(updates),
  });
}
