/** --- YAML
 * name: Create deposit payment intent API
 * description: POST — called from booking flow when deposit is required. Creates pending intent
 *              and returns LiqPay checkout URL for client redirect.
 *              Body: { appointmentId }  — intent derived from appointment's service/client/master.
 *              Idempotent: returns existing usable intent if one already linked.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createPaymentIntent, computeDepositForBooking } from '@/lib/payments/escrow';

export const dynamic = 'force-dynamic';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { appointmentId?: string } | null;
  if (!body?.appointmentId) return NextResponse.json({ error: 'appointment_id_required' }, { status: 400 });

  const db = admin();

  const { data: appt } = await db
    .from('appointments')
    .select(
      'id, client_id, master_id, service_id, price, currency, deposit_intent_id, ' +
      'clients:client_id!appointments_client_id_fkey(profile_id, full_name), ' +
      'services:service_id!appointments_service_id_fkey(name, price, requires_prepayment, deposit_percent, currency)',
    )
    .eq('id', body.appointmentId)
    .maybeSingle();

  type Loaded = {
    id: string;
    client_id: string;
    master_id: string;
    service_id: string;
    price: number;
    currency: string;
    deposit_intent_id: string | null;
    clients: { profile_id: string | null; full_name: string } | null;
    services: { name: string; price: number; requires_prepayment: boolean; deposit_percent: number; currency: string } | null;
  };
  const row = appt as unknown as Loaded | null;
  if (!row) return NextResponse.json({ error: 'appointment_not_found' }, { status: 404 });

  // Permission: client (who owns the appointment) OR master can create the intent
  const { data: master } = await db
    .from('masters')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  const isMaster = master?.id === row.master_id;
  const isClient = row.clients?.profile_id === user.id;
  if (!isMaster && !isClient) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const deposit = await computeDepositForBooking(db, {
    serviceId: row.service_id,
    masterId: row.master_id,
    clientId: row.client_id,
  });
  if (!deposit.required) {
    return NextResponse.json({ error: 'deposit_not_required' }, { status: 400 });
  }

  if (row.deposit_intent_id) {
    const { data: existing } = await db
      .from('payment_intents')
      .select('id, status')
      .eq('id', row.deposit_intent_id)
      .maybeSingle();
    if (existing && (existing.status === 'pending' || existing.status === 'held')) {
      return NextResponse.json({
        ok: true,
        intentId: existing.id,
        status: existing.status,
        reuse: true,
      });
    }
  }

  const description = `Предоплата ${deposit.amount} ${row.currency} · ${row.services?.name ?? 'визит'}`;
  try {
    const intent = await createPaymentIntent({
      db,
      appointmentId: row.id,
      masterId: row.master_id,
      clientId: row.client_id,
      amount: deposit.amount,
      currency: row.currency,
      description,
      metadata: { reason: deposit.reason },
    });

    await db
      .from('appointments')
      .update({
        deposit_required: true,
        deposit_amount: deposit.amount,
        deposit_intent_id: intent.intentId,
      })
      .eq('id', row.id);

    return NextResponse.json({
      ok: true,
      intentId: intent.intentId,
      checkoutUrl:
        `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(intent.checkoutData)}` +
        `&signature=${encodeURIComponent(intent.checkoutSignature)}`,
      checkoutData: intent.checkoutData,
      checkoutSignature: intent.checkoutSignature,
    });
  } catch (e) {
    console.error('[payments/deposit/create] failed:', e);
    return NextResponse.json({ error: 'create_failed', message: (e as Error).message }, { status: 500 });
  }
}
