/** --- YAML
 * name: Master Reminders Cron
 * description: Каждую минуту (Supabase pg_cron + cron-job.org redundancy) шлёт мастеру
 *              напоминания, у которых наступило время (due_at <= now() AND completed=false).
 *              Текст с временем, источником, inline-кнопкой «✓ Готово» (callback в webhook).
 *              Помечает completed=true сразу после отправки чтобы не дублировать.
 * created: 2026-04-16
 * updated: 2026-05-05
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';


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
    .select('id, text, due_at, source, master_id, master:masters!inner(profile_id, notify_telegram)')
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
        // Время в Киевской зоне — мастер видит понятную локальную метку
        const dueDate = r.due_at ? new Date(r.due_at) : null;
        const timeLabel = dueDate
          ? dueDate.toLocaleTimeString('ru-RU', {
              timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit',
            })
          : '';
        const sourceLabel = r.source === 'voice'
          ? '🎤 голосом'
          : r.source === 'text'
            ? '💬 текстом'
            : '';
        const headerLine = timeLabel
          ? `🔔 <b>Напоминание · ${timeLabel}</b>`
          : '🔔 <b>Напоминание</b>';
        const footer = sourceLabel ? `\n\n<i>${sourceLabel}</i>` : '';
        const text = `${headerLine}\n\n${r.text}${footer}`;

        for (const s of sessions) {
          // Inline-кнопка «✓ Готово» — webhook ловит callback `done_reminder|<id>`
          // и пишет completed_at = now() (виджет на /today сразу обновится).
          await sendMessage(s.chat_id, text, {
            parse_mode: 'HTML',
            disable_notification: false,
            reply_markup: {
              inline_keyboard: [[
                { text: '✓ Готово', callback_data: `done_reminder|${r.id}` },
                { text: '↻ Через 1 час', callback_data: `snooze_reminder|${r.id}|60` },
              ]],
            },
          });
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
