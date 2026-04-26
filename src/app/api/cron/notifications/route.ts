/** --- YAML
 * name: Notification Sender Cron
 * description: Sends pending notifications via Telegram or email, called every 5 minutes
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage, sendDocument } from '@/lib/telegram/bot';

interface AttachmentRef { url: string; name?: string }
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

  let failed = 0;

  for (const n of notifications) {
    const profile = n.profiles as { telegram_id: string | null; full_name: string } | null;

    const attachments = (n.data as Record<string, unknown> | null)?.attachment_urls as AttachmentRef[] | undefined;

    // If the notification carries its own inline_keyboard (e.g. native TG review
    // with 5 star buttons) — use it instead of the default «✨ CRES-CA» web-app
    // button, otherwise users would see two keyboards stacked.
    const customKeyboard = (n.data as Record<string, unknown> | null)?.inline_keyboard as unknown[] | undefined;
    const replyMarkup = customKeyboard
      ? { inline_keyboard: customKeyboard }
      : { inline_keyboard: [[{ text: '✨ CRES-CA', web_app: { url: appUrl } }]] };

    if (n.channel === 'telegram' && profile?.telegram_id) {
      try {
        await sendMessage(profile.telegram_id, `<b>${n.title}</b>\n\n${n.body}`, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
        // Re-send each attached file as a separate document message.
        if (attachments?.length) {
          for (const a of attachments) {
            if (a?.url) {
              await sendDocument(profile.telegram_id, a.url, a.name).catch(() => null);
            }
          }
        }
        await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', n.id);
        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'send_failed';
        await supabase.from('notifications').update({
          status: 'failed',
          data: { ...(n.data as Record<string, unknown> | null ?? {}), error: errorMessage, failed_at: new Date().toISOString() },
        }).eq('id', n.id);
        failed++;
      }
    } else if (n.channel === 'email') {
      const email = (n.profiles as { email?: string | null } | null)?.email;
      if (email) {
        try {
          const resend = getResend();
          // Build attachment list: pass the public URL to Resend so it fetches & attaches.
          const resendAttachments = (attachments ?? [])
            .filter((a): a is AttachmentRef => Boolean(a?.url))
            .map((a) => ({ filename: a.name || 'attachment', path: a.url }));
          await resend.emails.send({
            from: 'CRES-CA <noreply@cres-ca.com>',
            to: email,
            subject: n.title ?? 'CRES-CA',
            html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;"><h2 style="color: #0f172a;">${n.title ?? ''}</h2><p style="color: #334155;">${n.body ?? ''}</p></div>`,
            ...(resendAttachments.length ? { attachments: resendAttachments } : {}),
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

  return NextResponse.json({ sent, failed });
}
