/** --- YAML
 * name: LiqPay Webhook
 * description: POST endpoint handling LiqPay payment callbacks. Routes by order_id:
 *              - UUID that matches payment_intents.id  → escrow deposit flow (Phase 2)
 *              - "sub_{profileId}_{tier}" format       → subscription flow
 *              - Otherwise                              → legacy payments table update
 *              Verifies HMAC signature in all paths.
 * --- */

import { NextResponse } from 'next/server';
import { verifyCallback, isSuccessStatus } from '@/lib/payments/liqpay';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { markHeld } from '@/lib/payments/escrow';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const data = formData.get('data') as string;
  const signature = formData.get('signature') as string;

  if (!data || !signature) {
    return NextResponse.json({ error: 'Missing data or signature' }, { status: 400 });
  }

  const callback = verifyCallback(data, signature);
  if (!callback) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const orderId = callback.order_id;

  // ─── Escrow deposit path: order_id is UUID of payment_intents ───
  if (UUID_RE.test(orderId)) {
    const db = admin();
    const { data: intent } = await db
      .from('payment_intents')
      .select('id, status')
      .eq('id', orderId)
      .maybeSingle();

    if (intent) {
      if (isSuccessStatus(callback.status)) {
        await markHeld(db, intent.id, String(callback.transaction_id ?? ''), signature);
      } else if (['failure', 'error'].includes(callback.status)) {
        await db
          .from('payment_intents')
          .update({ status: 'failed', error_message: callback.err_description ?? callback.status })
          .eq('id', intent.id)
          .eq('status', 'pending');
      } else if (['reversed', 'refund'].includes(callback.status)) {
        await db
          .from('payment_intents')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() })
          .eq('id', intent.id);
      }
      return NextResponse.json({ status: 'ok', path: 'escrow' });
    }
    // If UUID but not in payment_intents — fall through to legacy path
  }

  const supabase = await createClient();

  // Map LiqPay status to our payment status
  let paymentStatus: string;
  if (['success', 'sandbox'].includes(callback.status)) {
    paymentStatus = 'completed';
  } else if (['failure', 'error'].includes(callback.status)) {
    paymentStatus = 'failed';
  } else if (callback.status === 'reversed') {
    paymentStatus = 'refunded';
  } else {
    paymentStatus = 'pending';
  }

  // Update payment record
  const { data: payment } = await supabase
    .from('payments')
    .update({
      status: paymentStatus,
      liqpay_order_id: String(callback.transaction_id),
    })
    .eq('id', orderId)
    .select('appointment_id')
    .single();

  // If payment succeeded, confirm the appointment and log receipt URL
  if (paymentStatus === 'completed' && payment?.appointment_id) {
    await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', payment.appointment_id)
      .eq('status', 'booked');

    // Store receipt reference for the client (receipt is generated on-demand at /api/receipts/:apt_id)
    await supabase
      .from('payments')
      .update({
        description: `LiqPay tx:${callback.transaction_id} | receipt: /api/receipts/${payment.appointment_id}`,
      })
      .eq('id', orderId);
  }

  // Handle subscription payments
  if (callback.action === 'subscribe' && paymentStatus === 'completed') {
    // orderId format: sub_{profile_id}_{tier}
    const parts = orderId.split('_');
    if (parts[0] === 'sub' && parts.length >= 3) {
      const profileId = parts[1];
      const tier = parts[2];
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabase
        .from('subscriptions')
        .update({
          tier,
          status: 'active',
          current_period_end: periodEnd.toISOString(),
        })
        .eq('profile_id', profileId);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
