/** --- YAML
 * name: Create Payment
 * description: POST endpoint that creates a payment record and returns LiqPay form data
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPaymentForm, createSubscriptionForm } from '@/lib/payments/liqpay';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type } = body;

  if (type === 'prepayment') {
    const { appointmentId, amount, currency, description } = body;

    // Create payment record
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        appointment_id: appointmentId,
        amount,
        currency: currency || 'UAH',
        type: 'prepayment',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    const formData = createPaymentForm({
      orderId: payment.id,
      amount,
      currency: currency || 'UAH',
      description: description || 'Prepayment for appointment',
    });

    return NextResponse.json(formData);
  }

  if (type === 'subscription') {
    const { tier, amount, currency } = body;

    const formData = createSubscriptionForm({
      orderId: `sub_${user.id}_${tier}`,
      amount,
      currency: currency || 'UAH',
      description: `CRES-CA ${tier} subscription`,
      subscribePeriodicity: 'month',
    });

    return NextResponse.json(formData);
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
