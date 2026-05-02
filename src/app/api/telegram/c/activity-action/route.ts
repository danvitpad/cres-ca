/** --- YAML
 * name: Telegram Client Activity Actions API
 * description: Cancel own appointment + notify master, or submit review.
 * created: 2026-04-17
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateInitData } from '@/lib/telegram/validate-init-data';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { initData, action, appointment_id } = body;
  if (!initData || !action || !appointment_id) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const result = validateInitData(initData);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', result.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 403 });

  const { data: clientRows } = await admin.from('clients').select('id').eq('profile_id', profile.id);
  const clientIds = (clientRows ?? []).map((c) => c.id);

  // Verify appointment ownership
  const { data: apt } = await admin
    .from('appointments')
    .select('id, master_id, service_id, price, starts_at, status, service:services(name), client_id')
    .eq('id', appointment_id)
    .maybeSingle();
  if (!apt || !clientIds.includes(apt.client_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (action === 'cancel') {
    // Идемпотентность: если запись уже отменена/завершена — не делаем
    // повторный update и НЕ шлём дубль TG-уведомления мастеру.
    // Раньше юзер мог отменить запись через TG-бот (inline-кнопка под
    // напоминалкой) → webhook отправлял мастеру первое уведомление.
    // Потом тот же клиент открывал Mini App → видел всё ещё активную
    // запись (страница не успела обновиться) → нажимал «Отменить» →
    // activity-action слал ВТОРОЕ уведомление с тем же действием.
    if (['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'completed', 'no_show'].includes(apt.status)) {
      return NextResponse.json({ ok: true, already_done: true });
    }

    const { error } = await admin
      .from('appointments')
      .update({
        status: 'cancelled_by_client',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
        cancellation_reason: 'client_miniapp',
      })
      .eq('id', appointment_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify master via TG direct (bypass daily cron)
    const { data: masterRow } = await admin
      .from('masters')
      .select('profile_id, profile:profiles!masters_profile_id_fkey(telegram_id)')
      .eq('id', apt.master_id)
      .maybeSingle();
    const masterProfileId = masterRow?.profile_id;
    const masterTg = (masterRow as { profile?: { telegram_id?: number | null } | null } | null)?.profile?.telegram_id;
    const svc = Array.isArray(apt.service) ? apt.service[0] : apt.service;
    // Указываем timeZone — на сервере по умолчанию UTC, без явной зоны
    // время записи рендерилось как 07:00 вместо 10:00 (Киев).
    const whenStr = new Date(apt.starts_at).toLocaleString('ru', {
      timeZone: 'Europe/Kyiv',
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    if (masterTg) {
      const { sendMessage } = await import('@/lib/telegram/bot');
      try {
        await sendMessage(masterTg as unknown as number,
          `<b>❌ Запись отменена клиентом</b>\n\n${svc?.name ?? 'Услуга'}\n${whenStr}`,
          { parse_mode: 'HTML' },
        );
      } catch { /* ignore */ }
    }
    if (masterProfileId) {
      await admin.from('notifications').insert({
        profile_id: masterProfileId,
        channel: 'telegram',
        title: '❌ Запись отменена',
        body: `${svc?.name ?? 'Услуга'} — ${whenStr}`,
        status: masterTg ? 'sent' : 'pending',
        sent_at: masterTg ? new Date().toISOString() : null,
        data: { type: 'appointment_cancelled', appointment_id, action_url: '/calendar' },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'review') {
    const { score, comment } = body;
    if (typeof score !== 'number' || score < 1 || score > 5) {
      return NextResponse.json({ error: 'invalid_score' }, { status: 400 });
    }
    const { error } = await admin.from('reviews').insert({
      appointment_id,
      reviewer_id: profile.id,
      target_type: 'master',
      target_id: apt.master_id,
      score,
      comment: (comment && comment.trim()) || null,
      is_published: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
