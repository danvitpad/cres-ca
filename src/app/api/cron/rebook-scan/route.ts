/** --- YAML
 * name: Rebook Scanner Cron
 * description: Daily scan that generates rebook suggestions for masters. For every client with established visit cadence (3+ completed visits), computes the median interval, finds the nearest free slot in master's calendar matching typical dow/hour, and creates a pending_master suggestion. Safe to re-run (idempotent via unique constraint).
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { scanRebookSuggestions } from '@/lib/rebook/scan';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = admin();
  const t0 = Date.now();

  try {
    const stats = await scanRebookSuggestions(db);
    const ms = Date.now() - t0;

    // Notify masters who got new suggestions — single TG-push
    if (stats.suggestionsCreated > 0) {
      await notifyMasters(db);
    }

    console.log('[rebook-scan] done in', ms, 'ms — ', JSON.stringify(stats));
    return NextResponse.json({ ok: true, ms, stats });
  } catch (e) {
    console.error('[rebook-scan] fatal:', e);
    return NextResponse.json({ error: 'scan_failed', message: (e as Error).message }, { status: 500 });
  }
}

/**
 * Finds masters with ≥1 fresh `pending_master` suggestion created in last 24h and sends them
 * ONE Telegram notification (not spam per client). They open dashboard to review.
 */
async function notifyMasters(db: ReturnType<typeof admin>) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from('rebook_suggestions')
    .select('master_id, masters:master_id(profile_id, profiles:profile_id(telegram_id))')
    .eq('status', 'pending_master')
    .gte('created_at', since);

  if (!rows?.length) return;

  // Group by telegram_id
  const byTg = new Map<number, number>();
  for (const r of rows as unknown as Array<{ masters: { profiles: { telegram_id: number | null } | null } | null }>) {
    const tgId = r.masters?.profiles?.telegram_id;
    if (tgId) byTg.set(tgId, (byTg.get(tgId) ?? 0) + 1);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await Promise.all(
    Array.from(byTg.entries()).map(([tgId, count]) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          parse_mode: 'HTML',
          text:
            `🔄 <b>Клиентам пора вернуться</b>\n\n` +
            `AI нашёл ${count} ${count === 1 ? 'клиент' : count < 5 ? 'клиентов' : 'клиентов'} которые обычно ` +
            `к тебе возвращаются сейчас. Проверь предложения и одобри в 1 клик.`,
          reply_markup: {
            inline_keyboard: [[{ text: '📋 Посмотреть', web_app: { url: `${appUrl}/telegram/m/rebook` } }]],
          },
        }),
      }).catch(() => null),
    ),
  );
}
