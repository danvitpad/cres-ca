/** --- YAML
 * name: Abandoned Booking Recovery Cron
 * description: >
 *   Runs every 5 minutes via Supabase pg_cron + cron-job.org redundancy.
 *   Finds booking drafts created 30-90 minutes ago that were never confirmed
 *   (converted_at IS NULL) and sends a Telegram push to resume the booking.
 *   Idempotent: skips drafts with notified_at already set.
 * created: 2026-05-09
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const maxDuration = 60;

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

  const adm = admin();
  const now = Date.now();
  const windowStart = new Date(now - 90 * 60 * 1000).toISOString(); // 90 min ago
  const windowEnd = new Date(now - 30 * 60 * 1000).toISOString();   // 30 min ago

  // Drafts in the 30–90 min window: not yet converted, not yet notified, not expired
  const { data: drafts } = await adm
    .from('booking_drafts')
    .select('id, profile_id, master_id, service_id, slot_date, slot_time')
    .is('converted_at', null)
    .is('notified_at', null)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .gt('expires_at', new Date().toISOString())
    .limit(50);

  if (!drafts?.length) return NextResponse.json({ ok: true, notified: 0 });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let notified = 0;

  for (const draft of drafts) {
    // Get client's telegram_id
    const { data: profile } = await adm
      .from('profiles')
      .select('telegram_id')
      .eq('id', draft.profile_id)
      .maybeSingle<{ telegram_id: number | null }>();

    const tgId = profile?.telegram_id;

    if (tgId && botToken) {
      const bookUrl = draft.service_id
        ? `${appUrl}/telegram/book?master=${draft.master_id}&service=${draft.service_id}&date=${draft.slot_date}&time=${encodeURIComponent(draft.slot_time)}`
        : `${appUrl}/telegram/book?master=${draft.master_id}&date=${draft.slot_date}&time=${encodeURIComponent(draft.slot_time)}`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          parse_mode: 'HTML',
          text: '⏰ <b>Ти не завершив запис</b>\n\nВибраний слот ще вільний — заверши бронювання поки не зайняли.',
          reply_markup: {
            inline_keyboard: [[{ text: '📅 Продовжити запис', web_app: { url: bookUrl } }]],
          },
        }),
      }).catch(() => null);
    }

    // Mark as notified (even if no TG, prevents re-notification)
    await adm
      .from('booking_drafts')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', draft.id)
      .then(() => null, () => null);

    notified++;
  }

  return NextResponse.json({ ok: true, notified, total: drafts.length });
}
