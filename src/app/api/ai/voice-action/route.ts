/** --- YAML
 * name: Voice Action API
 * description: Parses transcribed voice text for inventory deductions, reminders, and appointment references. No external AI — regex/keyword extraction only.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Deduction {
  item_name: string;
  item_id: string | null;
  quantity: number;
  unit: string;
  success: boolean;
  new_quantity?: number;
}

interface Reminder {
  text: string;
  scheduled_for: string;
}

interface VoiceActionResult {
  deductions: Deduction[];
  reminders: Reminder[];
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* Unit keyword map (Russian + English)                                */
/* ------------------------------------------------------------------ */

const UNIT_PATTERNS: { pattern: RegExp; unit: string }[] = [
  { pattern: /импульс(?:ов|а|ы)?/i, unit: 'impulses' },
  { pattern: /мл|миллилитр(?:ов|а|ы)?/i, unit: 'ml' },
  { pattern: /литр(?:ов|а|ы)?/i, unit: 'l' },
  { pattern: /шт(?:ук(?:и)?)?\.?/i, unit: 'pcs' },
  { pattern: /грамм(?:ов|а)?|г\b/i, unit: 'g' },
  { pattern: /капсул(?:ы|а)?/i, unit: 'capsules' },
  { pattern: /таблет(?:ок|ки|ка)?/i, unit: 'tablets' },
  { pattern: /ампул(?:ы|а)?/i, unit: 'ampoules' },
  { pattern: /пакет(?:ов|а|ы)?/i, unit: 'packs' },
  { pattern: /тюбик(?:ов|а|и)?/i, unit: 'tubes' },
  { pattern: /флакон(?:ов|а|ы)?/i, unit: 'bottles' },
  { pattern: /порци(?:й|и|ю)/i, unit: 'portions' },
  { pattern: /сеанс(?:ов|а|ы)?/i, unit: 'sessions' },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Parse "потратил 500 импульсов" / "списать 200 мл" / "использовал 3 шт геля" */
function parseInventoryUsages(text: string): { quantity: number; unitHint: string; itemHint: string }[] {
  const results: { quantity: number; unitHint: string; itemHint: string }[] = [];

  // Pattern: number + unit keyword + optional item name words
  // e.g. "500 импульсов", "200 мл геля", "3 шт перчаток"
  for (const { pattern, unit } of UNIT_PATTERNS) {
    // Build regex: (number) (unit) (optional trailing words up to punctuation/end)
    const fullPattern = new RegExp(
      `(\\d+(?:[.,]\\d+)?)\\s*${pattern.source}(?:\\s+([а-яёa-z][а-яёa-z\\s]{0,40}))?`,
      'gi',
    );
    let m: RegExpExecArray | null;
    while ((m = fullPattern.exec(text)) !== null) {
      const qty = parseFloat(m[1].replace(',', '.'));
      const itemHint = (m[2] || '').trim().replace(/\s+/g, ' ');
      if (qty > 0) {
        results.push({ quantity: qty, unitHint: unit, itemHint });
      }
    }
  }

  // Fallback: "потратил/использовал/списал <item words> <number>"
  const verbPattern = /(?:потратил[аи]?|использовал[аи]?|списал[аи]?|израсходовал[аи]?)\s+(.+?)(\d+(?:[.,]\d+)?)/gi;
  let vm: RegExpExecArray | null;
  while ((vm = verbPattern.exec(text)) !== null) {
    const itemHint = vm[1].trim().replace(/\s+/g, ' ');
    const qty = parseFloat(vm[2].replace(',', '.'));
    // Don't duplicate if already captured by unit patterns
    if (qty > 0 && !results.some((r) => r.quantity === qty && r.itemHint === itemHint)) {
      results.push({ quantity: qty, unitHint: '', itemHint });
    }
  }

  return results;
}

/** Parse reminder mentions: "напоминание через 2 дня", "в следующий раз через неделю" */
function parseReminders(text: string): { text: string; delayDays: number }[] {
  const reminders: { text: string; delayDays: number }[] = [];

  // "напоминание через X дней/недель"
  const reminderPattern = /(?:напоминани[ея]|напомни(?:ть)?|в следующий раз)\s+(?:через\s+)?(\d+)\s*(дн(?:ей|я|и)?|недел[юиь]|месяц(?:ев|а)?)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = reminderPattern.exec(text)) !== null) {
    const num = parseInt(rm[1]);
    const periodWord = rm[2].toLowerCase();
    let days = num;
    if (periodWord.startsWith('недел')) days = num * 7;
    else if (periodWord.startsWith('месяц')) days = num * 30;
    reminders.push({ text: `${rm[0].trim()}`, delayDays: days });
  }

  // Simple "напомнить завтра"
  if (/напомни(?:ть)?\s+завтра/i.test(text)) {
    reminders.push({ text: 'Напоминание на завтра', delayDays: 1 });
  }

  // "через неделю" without explicit number
  if (/(?:напомни|в следующий раз).*через\s+недел[юиь]/i.test(text) && !reminders.length) {
    reminders.push({ text: 'Напоминание через неделю', delayDays: 7 });
  }

  return reminders;
}

/* ------------------------------------------------------------------ */
/* Route handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { text, master_id }: { text?: string; master_id?: string } = body;

  if (!text || !master_id) {
    return NextResponse.json({ error: 'Missing text or master_id' }, { status: 400 });
  }

  // Verify master belongs to this user
  const { data: masterRow } = await supabase
    .from('masters')
    .select('id, profile_id')
    .eq('id', master_id)
    .single();

  if (!masterRow || masterRow.profile_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const result: VoiceActionResult = {
    deductions: [],
    reminders: [],
    errors: [],
  };

  /* ---- Inventory deductions ---- */
  const usages = parseInventoryUsages(text);

  for (const usage of usages) {
    // Try to find matching inventory item by name similarity or unit hint
    let query = admin
      .from('inventory_items')
      .select('id, name, quantity, unit')
      .eq('master_id', master_id);

    if (usage.itemHint) {
      // Try ILIKE match on item name
      query = query.ilike('name', `%${usage.itemHint}%`);
    } else if (usage.unitHint) {
      // Fall back to matching by unit
      query = query.eq('unit', usage.unitHint);
    }

    const { data: candidates } = await query.limit(5);

    if (!candidates || candidates.length === 0) {
      result.deductions.push({
        item_name: usage.itemHint || usage.unitHint,
        item_id: null,
        quantity: usage.quantity,
        unit: usage.unitHint,
        success: false,
      });
      result.errors.push(`Item not found: "${usage.itemHint || usage.unitHint}" (${usage.quantity})`);
      continue;
    }

    // Pick best match: prefer exact unit match, then first result
    const bestMatch = candidates.find((c) => c.unit === usage.unitHint) || candidates[0];
    const newQty = Math.max(0, Number(bestMatch.quantity) - usage.quantity);

    const { error: updateErr } = await admin
      .from('inventory_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', bestMatch.id);

    if (updateErr) {
      result.errors.push(`Failed to update "${bestMatch.name}": ${updateErr.message}`);
      result.deductions.push({
        item_name: bestMatch.name,
        item_id: bestMatch.id,
        quantity: usage.quantity,
        unit: bestMatch.unit,
        success: false,
      });
      continue;
    }

    // Record usage in inventory_usage
    await admin.from('inventory_usage').insert({
      item_id: bestMatch.id,
      quantity_used: usage.quantity,
      recorded_by: user.id,
    });

    result.deductions.push({
      item_name: bestMatch.name,
      item_id: bestMatch.id,
      quantity: usage.quantity,
      unit: bestMatch.unit,
      success: true,
      new_quantity: newQty,
    });
  }

  /* ---- Reminders ---- */
  const remindersParsed = parseReminders(text);

  for (const reminder of remindersParsed) {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + reminder.delayDays);

    const { error: notifErr } = await admin.from('notifications').insert({
      profile_id: user.id,
      channel: 'push',
      title: 'Voice reminder',
      body: reminder.text,
      data: { source: 'voice-action', original_text: text.slice(0, 200) },
      status: 'pending',
      scheduled_for: scheduledFor.toISOString(),
    });

    if (notifErr) {
      result.errors.push(`Failed to create reminder: ${notifErr.message}`);
    } else {
      result.reminders.push({
        text: reminder.text,
        scheduled_for: scheduledFor.toISOString(),
      });
    }
  }

  return NextResponse.json(result);
}
