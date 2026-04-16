/** --- YAML
 * name: LiqPay Webhook
 * description: POST endpoint handling LiqPay payment callbacks — verifies signature and updates payment/appointment status
 * --- */

import { NextResponse } from 'next/server';
import { verifyCallback } from '@/lib/payments/liqpay';
import { createClient } from '@/lib/supabase/server';

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

  const supabase = await createClient();
  const orderId = callback.order_id;

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
