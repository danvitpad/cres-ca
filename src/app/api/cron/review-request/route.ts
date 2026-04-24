/** --- YAML
 * name: Review-request cron
 * description: Hourly — finds completed appointments 24h-72h old that have no review request yet,
 *              sends TG message to the client with inline 1-5 star buttons.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
  const now = new Date();
  const from = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data } = await db
    .from('appointments')
    .select(
      'id, client_id, master_id, ends_at, ' +
      'clients:client_id!appointments_client_id_fkey(full_name, profile_id, profiles:profile_id(telegram_id)), ' +
      'masters:master_id!appointments_master_id_fkey(profile_id, profiles:profile_id(full_name)), ' +
      'services:service_id!appointments_service_id_fkey(name)'
    )
    .eq('status', 'completed')
    .is('review_requested_at', null)
    .gte('ends_at', from.toISOString())
    .lte('ends_at', to.toISOString())
    .limit(100);

  if (!data?.length) return NextResponse.json({ ok: true, sent: 0 });

  type Row = {
    id: string;
    client_id: string;
    master_id: string;
    ends_at: string;
    clients: { full_name: string; profile_id: string | null; profiles: { telegram_id: number | null } | null } | null;
    masters: { profile_id: string; profiles: { full_name: string | null } | null } | null;
    services: { name: string } | null;
  };

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ ok: true, sent: 0, reason: 'no_bot_token' });

  let sent = 0;
  for (const r of data as unknown as Row[]) {
    const tgId = r.clients?.profiles?.telegram_id;
    if (!tgId) continue;
    const masterName = r.masters?.profiles?.full_name ?? 'мастер';
    const serviceName = r.services?.name ?? 'услугу';

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          parse_mode: 'HTML',
          text: `⭐ Как прошёл визит к ${masterName} (${serviceName.toLowerCase()})?\n\nПоставь оценку — это помогает другим клиентам найти хорошего специалиста.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐', callback_data: `rv:${r.id}:1` },
                { text: '⭐⭐', callback_data: `rv:${r.id}:2` },
                { text: '⭐⭐⭐', callback_data: `rv:${r.id}:3` },
                { text: '⭐⭐⭐⭐', callback_data: `rv:${r.id}:4` },
                { text: '⭐⭐⭐⭐⭐', callback_data: `rv:${r.id}:5` },
              ],
            ],
          },
        }),
      });
      await db.from('appointments').update({ review_requested_at: now.toISOString() }).eq('id', r.id);
      sent++;
    } catch (e) {
      console.error('[review-request] send failed:', r.id, (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, sent, candidates: data.length });
}
