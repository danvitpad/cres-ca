/** --- YAML
 * name: Appointment Notify
 * description: POST {triggeredBy} → flushes pending booking notifications
 *              created by DB trigger (dispatch_booking_notification) by sending
 *              Telegram messages immediately and marking them as 'sent'.
 *              The trigger handles both client and master notifications with
 *              correct copy based on booked_via. This endpoint just makes the
 *              dispatch immediate (default cron is up to 5 min).
 * created: 2026-04-30
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: appointmentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adm = admin();

  // Verify caller is master or client of this appointment
  const { data: apt } = await adm
    .from('appointments')
    .select('id, master_id, client_id')
    .eq('id', appointmentId)
    .maybeSingle();
  if (!apt) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: masterRow }, { data: clientRow }] = await Promise.all([
    adm.from('masters').select('profile_id').eq('id', apt.master_id).maybeSingle(),
    adm.from('clients').select('profile_id').eq('id', apt.client_id).maybeSingle(),
  ]);
  const masterProfileId = (masterRow as { profile_id: string } | null)?.profile_id ?? null;
  const clientProfileId = (clientRow as { profile_id: string | null } | null)?.profile_id ?? null;

  if (masterProfileId !== user.id && clientProfileId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Find all pending telegram notifications for this appointment
  const { data: pending } = await adm
    .from('notifications')
    .select('id, profile_id, title, body, status')
    .eq('channel', 'telegram')
    .eq('status', 'pending')
    .filter('data->>apt_id', 'eq', appointmentId);

  if (!pending || pending.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Fetch telegram_ids in one query
  const profileIds = Array.from(new Set(pending.map((n) => n.profile_id)));
  const { data: profiles } = await adm
    .from('profiles')
    .select('id, telegram_id')
    .in('id', profileIds);
  const tgByProfile = new Map<string, number | null>();
  (profiles ?? []).forEach((p: { id: string; telegram_id: number | string | null }) => {
    tgByProfile.set(p.id, p.telegram_id ? Number(p.telegram_id) : null);
  });

  let sent = 0;
  for (const n of pending) {
    const chatId = tgByProfile.get(n.profile_id);
    if (chatId) {
      const html = `<b>${escapeHtml(n.title)}</b>\n${escapeHtml(n.body)}`;
      try {
        await sendMessage(chatId, html, { parse_mode: 'HTML' });
        sent++;
      } catch {
        continue; // leave as pending; cron will retry
      }
    }
    // Mark sent regardless of telegram_id (no chatId → cron also can't send)
    await adm
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', n.id);
  }

  return NextResponse.json({ ok: true, sent });
}
