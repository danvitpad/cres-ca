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

    // Триггер trg_booking_updated → dispatch_booking_notification('cancelled')
    // уведомит КЛИЕНТА (подтверждение). Мастеру дублируем здесь — иначе
    // master ничего не узнает, пока не откроет календарь.
    try {
      const { data: master } = await admin
        .from('masters').select('profile_id').eq('id', apt.master_id).maybeSingle();
      const masterProfileId = (master as { profile_id?: string } | null)?.profile_id;
      if (masterProfileId) {
        const svc = Array.isArray(apt.service) ? apt.service[0] : apt.service;
        const serviceName = (svc as { name?: string } | null)?.name || 'услугу';
        const { data: cli } = await admin
          .from('clients').select('full_name').eq('id', apt.client_id).maybeSingle();
        const clientName = (cli as { full_name?: string } | null)?.full_name || 'Клиент';
        const when = apt.starts_at
          ? new Date(apt.starts_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '';

        // Dedupe: skip if same kind already exists in last 5 min
        const { data: existing } = await admin
          .from('notifications').select('id')
          .eq('profile_id', masterProfileId)
          .filter('data->>apt_id', 'eq', appointment_id)
          .filter('data->>kind', 'eq', 'booking_cancelled_master')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();
        if (!existing) {
          await admin.from('notifications').insert({
            profile_id: masterProfileId,
            channel: 'telegram',
            status: 'pending',
            scheduled_for: new Date().toISOString(),
            title: '⚠️ Клиент отменил запись',
            body: `${clientName} отменил запись на ${serviceName} (${when}).`,
            data: { kind: 'booking_cancelled_master', apt_id: appointment_id, client_id: apt.client_id },
          });
        }
      }
    } catch { /* best-effort */ }

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
