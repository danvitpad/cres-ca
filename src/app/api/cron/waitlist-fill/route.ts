/** --- YAML
 * name: Waitlist Fill Cron
 * description: Runs every 5 minutes via Supabase pg_cron + cron-job.org redundancy.
 *              Finds appointments cancelled in the last 10 minutes, matches waiting
 *              clients in waitlist for the same master + service, and sends a
 *              Telegram push with a direct booking link.
 *              Idempotent: skips waitlist entries with notified_at already set.
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
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Find appointments cancelled in the last 10 minutes that are in the future
  const { data: cancelled } = await adm
    .from('appointments')
    .select('id, master_id, service_id, starts_at')
    .in('status', ['cancelled_by_client', 'cancelled'])
    .gte('updated_at', windowStart)
    .gt('starts_at', now);

  if (!cancelled?.length) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let notified = 0;

  for (const apt of cancelled) {
    // Find waiting clients for this master + matching service (or any service)
    const { data: entries } = await adm
      .from('waitlist')
      .select('id, client_profile_id, service_id, profiles:client_profile_id(telegram_id)')
      .eq('master_id', apt.master_id)
      .eq('status', 'waiting')
      .is('notified_at', null)
      .or(`service_id.eq.${apt.service_id},service_id.is.null`)
      .order('created_at', { ascending: true })
      .limit(3);

    if (!entries?.length) continue;

    for (const entry of entries as unknown as Array<{
      id: string;
      client_profile_id: string;
      service_id: string | null;
      profiles: { telegram_id: number | null } | null;
    }>) {
      const tgId = entry.profiles?.telegram_id;

      if (tgId && botToken) {
        const bookUrl = entry.service_id
          ? `${appUrl}/telegram/book?master=${apt.master_id}&service=${entry.service_id}`
          : `${appUrl}/telegram/book?master=${apt.master_id}`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgId,
            parse_mode: 'HTML',
            text: '🟢 <b>Слот открылся!</b>\n\nМастер освободился — успей записаться первым.',
            reply_markup: {
              inline_keyboard: [[{ text: '📅 Записаться', web_app: { url: bookUrl } }]],
            },
          }),
        }).catch(() => null);
      }

      // Mark as matched + set notified_at (even if no TG, prevents re-notify)
      await adm
        .from('waitlist')
        .update({ status: 'matched', notified_at: new Date().toISOString(), matched_appointment_id: apt.id })
        .eq('id', entry.id)
        .then(() => null, () => null);

      notified++;
    }
  }

  return NextResponse.json({ ok: true, notified, cancelledApts: cancelled.length });
}
