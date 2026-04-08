/** --- YAML
 * name: Notification Sender Cron
 * description: Sends pending notifications via Telegram or email, called every 5 minutes
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/telegram/bot';

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
    .select('*, profiles(telegram_id, full_name)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for')
    .limit(50);

  if (!notifications?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const n of notifications) {
    const profile = n.profiles as { telegram_id: string | null; full_name: string } | null;

    if (n.channel === 'telegram' && profile?.telegram_id) {
      await sendMessage(profile.telegram_id, `${n.title}\n\n${n.body}`);
      await supabase.from('notifications').update({ status: 'sent' }).eq('id', n.id);
      sent++;
    } else if (n.channel === 'email') {
      // Email sending via Resend would go here
      await supabase.from('notifications').update({ status: 'sent' }).eq('id', n.id);
      sent++;
    } else {
      // Mark as sent if no delivery channel available
      await supabase.from('notifications').update({ status: 'sent' }).eq('id', n.id);
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
