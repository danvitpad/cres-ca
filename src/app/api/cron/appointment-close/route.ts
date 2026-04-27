/** --- YAML
 * name: Appointment Close Cron
 * description: Runs every 30 min. For each ACTIVE appointment that has ended (booked/confirmed/in_progress, ends_at + grace <= now):
 *   - If master.appointment_close_mode = "auto" (default) → mark as completed immediately
 *   - If master.appointment_close_mode = "confirm" → send TG prompt "Подтвердить окончание" / "Не подтверждать"
 *   - If grace period (auto_close_hours, default 1h) passed without response → auto-close
 * created: 2026-04-17
 * updated: 2026-04-27
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


interface AppointmentCloseRow {
  id: string;
  master_id: string;
  starts_at: string;
  ends_at: string;
  price: number | null;
  status: string;
  close_pending_sent_at: string | null;
  service: { name: string } | null;
  client: { full_name: string } | null;
  master: {
    profile_id: string;
    appointment_close_mode: string;
    appointment_auto_close_hours: number;
  };
}

async function sendTelegramMessage(chatId: number, text: string, inlineKeyboard?: { text: string; callback_data: string }[][]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
      }),
    });
  } catch (e) {
    console.error('[appointment-close] TG send fail:', e);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const nowIso = new Date().toISOString();

  // Fetch all active appointments whose end time has passed
  const { data: appts, error } = await supabase
    .from('appointments')
    .select(`
      id, master_id, starts_at, ends_at, price, status, close_pending_sent_at,
      service:services(name),
      client:clients(full_name),
      master:masters!inner(profile_id, appointment_close_mode, appointment_auto_close_hours)
    `)
    .in('status', ['booked', 'confirmed', 'in_progress'])
    .lte('ends_at', nowIso)
    .limit(200);

  if (error || !appts?.length) {
    return NextResponse.json({ ok: true, closed: 0, prompted: 0 });
  }

  let closed = 0;
  let prompted = 0;

  for (const row of appts as unknown as AppointmentCloseRow[]) {
    const endMs = new Date(row.ends_at).getTime();
    const nowMs = Date.now();
    const hoursSinceEnd = (nowMs - endMs) / (1000 * 60 * 60);
    const mode = row.master.appointment_close_mode || 'auto';
    const graceHours = row.master.appointment_auto_close_hours || 1;

    // Case 1: auto mode — close after grace window expired (default 1h after ends_at).
    // Грейс нужен чтобы мастер успел поставить «Не пришёл» если клиент действительно
    // не появился. По умолчанию 1 час после конца.
    if (mode === 'auto') {
      if (hoursSinceEnd < graceHours) continue;
      await supabase.from('appointments')
        .update({
          status: 'completed',
          auto_closed_at: nowIso,
        })
        .eq('id', row.id);
      closed++;
      continue;
    }

    // Case 2: confirm mode
    // 2a: Haven't sent prompt yet → send it
    if (!row.close_pending_sent_at) {
      // Find master's TG session
      const { data: session } = await supabase
        .from('telegram_sessions')
        .select('chat_id')
        .eq('profile_id', row.master.profile_id)
        .maybeSingle();

      if (session?.chat_id) {
        const endStr = new Date(row.ends_at).toLocaleString('ru-RU', {
          timeZone: 'Europe/Kyiv',
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit',
        });
        const clientName = row.client?.full_name || 'Клиент';
        const serviceName = row.service?.name || 'Услуга';
        const price = Number(row.price) || 0;

        await sendTelegramMessage(
          session.chat_id,
          `🔔 <b>Запись завершилась</b>\n\n👤 ${clientName}\n💇 ${serviceName}\n⏰ ${endStr}\n💰 ${price} ₴\n\nПодтвердить что услуга состоялась?`,
          [
            [
              { text: '✅ Состоялась', callback_data: `close_ok:${row.id}` },
              { text: '❌ Не состоялась', callback_data: `close_no:${row.id}` },
            ],
          ],
        );
        prompted++;
      }

      // Mark prompt sent regardless (avoid spam if no TG session)
      await supabase.from('appointments')
        .update({ close_pending_sent_at: nowIso })
        .eq('id', row.id);
      continue;
    }

    // 2b: Prompt was sent earlier; if grace period expired → auto-close
    if (hoursSinceEnd >= graceHours) {
      await supabase.from('appointments')
        .update({
          status: 'completed',
          auto_closed_at: nowIso,
        })
        .eq('id', row.id);
      closed++;
    }
  }

  return NextResponse.json({ ok: true, closed, prompted });
}
