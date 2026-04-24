/** --- YAML
 * name: Rebook approve API
 * description: Master approves a pending rebook suggestion → sends TG message to client with 1-click buttons.
 *              Re-validates slot freshness (stale if something got booked meanwhile).
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = admin();

  // Fetch + verify master owns this suggestion
  const { data: s } = await db
    .from('rebook_suggestions')
    .select(
      'id, master_id, client_id, service_id, suggested_starts_at, suggested_duration_min, alt_slots, status, ' +
      'masters:master_id!rebook_suggestions_master_id_fkey(profile_id), ' +
      'clients:client_id!rebook_suggestions_client_id_fkey(full_name, profile_id, profiles:profile_id(telegram_id, full_name)), ' +
      'services:service_id!rebook_suggestions_service_id_fkey(name, price)',
    )
    .eq('id', id)
    .maybeSingle();

  type Loaded = {
    id: string;
    master_id: string;
    client_id: string;
    service_id: string | null;
    suggested_starts_at: string;
    suggested_duration_min: number;
    alt_slots: Array<{ starts_at: string }>;
    status: string;
    masters: { profile_id: string } | null;
    clients: {
      full_name: string;
      profile_id: string | null;
      profiles: { telegram_id: number | null; full_name: string } | null;
    } | null;
    services: { name: string; price: number } | null;
  };
  const row = s as unknown as Loaded | null;
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (row.masters?.profile_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (row.status !== 'pending_master') {
    return NextResponse.json({ error: 'wrong_state', status: row.status }, { status: 400 });
  }

  // Re-validate that suggested + alt slots are still free
  const allSlots = [
    { starts_at: row.suggested_starts_at },
    ...(row.alt_slots ?? []),
  ];
  const freshSlots: Array<{ starts_at: string }> = [];
  for (const slot of allSlots) {
    const { data: isFree } = await db.rpc('is_slot_free', {
      p_master_id: row.master_id,
      p_starts_at: slot.starts_at,
      p_duration_min: row.suggested_duration_min,
    });
    if (isFree === true) freshSlots.push(slot);
  }

  if (freshSlots.length === 0) {
    await db
      .from('rebook_suggestions')
      .update({ status: 'stale' })
      .eq('id', row.id);
    return NextResponse.json({ error: 'stale', message: 'Все предложенные слоты уже заняты' }, { status: 409 });
  }

  // Send TG message to client if linked
  const clientTg = row.clients?.profiles?.telegram_id;
  if (!clientTg) {
    return NextResponse.json({
      error: 'client_has_no_telegram',
      message: 'Клиент не связан с Telegram. Свяжись по телефону.',
    }, { status: 400 });
  }

  const serviceName = row.services?.name ?? 'услугу';
  const clientFirstName = (row.clients?.full_name ?? '').split(' ')[0] || 'Привет';

  // Build callback buttons. Format: rebook:<suggestionId>:<slotIndex>  (0,1,2) or rebook_no:<id>
  const slotButtons = freshSlots.slice(0, 3).map((slot, i) => ({
    text: formatSlotLabel(slot.starts_at),
    callback_data: `rb_yes:${row.id}:${i}`,
  }));

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: 'bot_not_configured' }, { status: 500 });

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: clientTg,
      parse_mode: 'HTML',
      text:
        `💅 <b>${clientFirstName}</b>, как насчёт ${serviceName.toLowerCase()}?\n\n` +
        `Выбери удобное время — запишу тебя одним кликом.`,
      reply_markup: {
        inline_keyboard: [
          ...slotButtons.map((b) => [b]),
          [{ text: '❌ Не сейчас', callback_data: `rb_no:${row.id}` }],
        ],
      },
    }),
  });
  const tgJson = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!tgJson.ok) {
    console.error('[rebook/approve] TG send failed:', tgJson.description);
    return NextResponse.json({ error: 'tg_send_failed', details: tgJson.description }, { status: 502 });
  }

  await db
    .from('rebook_suggestions')
    .update({
      status: 'sent_client',
      approved_by_master_at: new Date().toISOString(),
      sent_to_client_at: new Date().toISOString(),
      // store fresh slots back — client will pick from these
      suggested_starts_at: freshSlots[0].starts_at,
      alt_slots: freshSlots.slice(1),
    })
    .eq('id', row.id);

  return NextResponse.json({ ok: true });
}

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  const DOW = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const day = DOW[d.getDay()];
  const date = d.getDate();
  const month = d.toLocaleDateString('ru-RU', { month: 'long' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${date} ${month} · ${time}`;
}
