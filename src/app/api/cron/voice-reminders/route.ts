/** --- YAML
 * name: Voice Reminders Cron
 * description: Sends Telegram notifications for due reminders. Looks up all linked Telegram chats via telegram_sessions.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find due reminders (due_at <= now, not completed)
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, text, due_at, master_id, master:masters!inner(profile_id, notify_telegram)')
    .eq('completed', false)
    .not('due_at', 'is', null)
    .lte('due_at', new Date().toISOString())
    .limit(50);

  if (error || !reminders?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;

  for (const r of reminders) {
    const master = r.master as unknown as { profile_id: string; notify_telegram: boolean };

    // Send to Telegram only if enabled
    if (master.notify_telegram !== false) {
      const { data: sessions } = await supabase
        .from('telegram_sessions')
        .select('chat_id')
        .eq('profile_id', master.profile_id);

      if (sessions?.length) {
        for (const s of sessions) {
          await sendMessage(
            s.chat_id,
            `🔔 <b>Напоминание</b>\n\n${r.text}`,
            { parse_mode: 'HTML' },
          );
        }
        sent++;
      }
    }

    // Mark as completed
    await supabase
      .from('reminders')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', r.id);
  }

  return NextResponse.json({ ok: true, sent });
}
