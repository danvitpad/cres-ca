/** --- YAML
 * name: AI Client Actions
 * description: POST — выполняет реальное действие из AI-чата клиента:
 *              - book: создаёт appointment у мастера на услугу/время
 *              - cancel: отменяет существующую запись
 *              - reschedule: переносит запись на новый слот
 *              - reminder: создаёт notification на будущую дату
 *              Все требуют user-сессию (cookie auth). Возвращает {ok, message}
 *              или {ok: false, error}.
 * created: 2026-04-26
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ActionInput {
  action: 'book' | 'cancel' | 'reschedule' | 'reminder';
  /** appointment-related */
  master_id?: string;
  service_id?: string;
  starts_at?: string; // ISO
  appointment_id?: string;
  new_starts_at?: string; // for reschedule
  /** reminder-related */
  remind_at?: string; // ISO
  reminder_text?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ActionInput | null;
  if (!body?.action) {
    return NextResponse.json({ ok: false, error: 'no_action' }, { status: 400 });
  }

  switch (body.action) {
    case 'book':
      return handleBook(supabase, user.id, body);
    case 'cancel':
      return handleCancel(supabase, user.id, body);
    case 'reschedule':
      return handleReschedule(supabase, user.id, body);
    case 'reminder':
      return handleReminder(supabase, user.id, body);
    default:
      return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }
}

async function handleBook(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ActionInput,
) {
  if (!input.master_id || !input.service_id || !input.starts_at) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  // Find or create client row for this user under master's CRM
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', userId)
    .maybeSingle();

  let clientId: string | null = null;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('master_id', input.master_id)
    .eq('profile_id', userId)
    .maybeSingle();
  if (existingClient) {
    clientId = existingClient.id as string;
  } else {
    const { data: newClient, error: cErr } = await supabase
      .from('clients')
      .insert({
        master_id: input.master_id,
        profile_id: userId,
        full_name: profile?.full_name ?? 'Клиент',
        phone: profile?.phone ?? null,
      })
      .select('id')
      .single();
    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    clientId = newClient.id as string;
  }

  // Get service details for duration + price
  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes, price, currency')
    .eq('id', input.service_id)
    .maybeSingle();
  if (!service) {
    return NextResponse.json({ ok: false, error: 'service_not_found' }, { status: 404 });
  }

  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(startsAt.getTime() + (service.duration_minutes ?? 60) * 60 * 1000);

  const { data: apt, error: aErr } = await supabase
    .from('appointments')
    .insert({
      client_id: clientId,
      master_id: input.master_id,
      service_id: input.service_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price ?? 0,
      currency: service.currency ?? 'UAH',
      status: 'booked',
      booked_via: 'ai_chat',
    })
    .select('id, starts_at, ends_at')
    .single();
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    appointment_id: apt.id,
    message: 'Запись создана. Мастер получит уведомление и подтвердит.',
  });
}

async function handleCancel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ActionInput,
) {
  if (!input.appointment_id) {
    return NextResponse.json({ ok: false, error: 'missing_appointment_id' }, { status: 400 });
  }

  // Verify ownership: appointment.client.profile_id == userId
  const { data: apt } = await supabase
    .from('appointments')
    .select('id, status, starts_at, client:clients(profile_id)')
    .eq('id', input.appointment_id)
    .maybeSingle();
  if (!apt) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  type ClientRef = { profile_id: string | null } | { profile_id: string | null }[] | null;
  const cl = (apt.client as ClientRef);
  const ownerId = Array.isArray(cl) ? cl[0]?.profile_id : cl?.profile_id;
  if (ownerId !== userId) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  // Don't cancel completed/already-cancelled
  if (['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master'].includes(apt.status)) {
    return NextResponse.json({ ok: false, error: 'already_done', message: 'Запись уже завершена или отменена.' }, { status: 400 });
  }

  const { error: uErr } = await supabase
    .from('appointments')
    .update({ status: 'cancelled_by_client' })
    .eq('id', input.appointment_id);
  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: 'Запись отменена.' });
}

async function handleReschedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ActionInput,
) {
  if (!input.appointment_id || !input.new_starts_at) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const { data: apt } = await supabase
    .from('appointments')
    .select('id, status, starts_at, ends_at, client:clients(profile_id)')
    .eq('id', input.appointment_id)
    .maybeSingle();
  if (!apt) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  type ClientRef = { profile_id: string | null } | { profile_id: string | null }[] | null;
  const cl = apt.client as ClientRef;
  const ownerId = Array.isArray(cl) ? cl[0]?.profile_id : cl?.profile_id;
  if (ownerId !== userId) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  if (['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master'].includes(apt.status)) {
    return NextResponse.json({ ok: false, error: 'already_done' }, { status: 400 });
  }

  const oldStart = new Date(apt.starts_at);
  const oldEnd = new Date(apt.ends_at);
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  const newStart = new Date(input.new_starts_at);
  const newEnd = new Date(newStart.getTime() + durationMs);

  const { error: uErr } = await supabase
    .from('appointments')
    .update({
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
      status: 'booked', // re-confirm cycle
    })
    .eq('id', input.appointment_id);
  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: 'Запись перенесена.' });
}

async function handleReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ActionInput,
) {
  if (!input.remind_at || !input.reminder_text) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const remindAt = new Date(input.remind_at);
  if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'bad_date' }, { status: 400 });
  }

  const { error: nErr } = await supabase.from('notifications').insert({
    profile_id: userId,
    channel: 'telegram',
    title: '⏰ Напоминание',
    body: input.reminder_text.slice(0, 500),
    scheduled_for: remindAt.toISOString(),
    data: { kind: 'ai_reminder' },
  });
  if (nErr) return NextResponse.json({ ok: false, error: nErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: 'Напоминание поставлено.' });
}
