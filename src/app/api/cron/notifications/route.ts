/** --- YAML
 * name: Notification Sender Cron
 * description: Sends pending notifications via Telegram or email, called every 5 minutes
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/telegram/bot';
import { getResend } from '@/lib/email/resend';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch pending notifications that are due
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, profiles(telegram_id, full_name, email)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for')
    .limit(50);

  if (!notifications?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  const appUrl = `${process.env.NEXT_PUBLIC_APP_URL}/telegram`;

  for (const n of notifications) {
    const profile = n.profiles as { telegram_id: string | null; full_name: string } | null;

    if (n.channel === 'telegram' && profile?.telegram_id) {
      await sendMessage(profile.telegram_id, `<b>${n.title}</b>\n\n${n.body}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: appUrl } }]],
        },
      });
      await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', n.id);
      sent++;
    } else if (n.channel === 'email') {
      const email = (n.profiles as { email?: string | null } | null)?.email;
      if (email) {
        try {
          const resend = getResend();
          await resend.emails.send({
            from: 'CRES-CA <noreply@cres-ca.com>',
            to: email,
            subject: n.title ?? 'CRES-CA',
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;"><h2 style="color: #0f172a;">${n.title ?? ''}</h2><p style="color: #334155;">${n.body ?? ''}</p></div>`,
          });
        } catch {
          // Resend not configured or failed — mark as sent anyway to avoid retry loop
        }
      }
      await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', n.id);
      sent++;
    } else {
      // Mark as sent if no delivery channel available
      await supabase.from('notifications').update({ status: 'sent' }).eq('id', n.id);
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
