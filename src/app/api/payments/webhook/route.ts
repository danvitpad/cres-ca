/** --- YAML
 * name: Payments unified webhook
 * description: Accepts Hutko + LiqPay escrow callbacks. Verifies signature, updates payment_intents state.
 *              Hutko: HMAC-SHA256 hex in `x-hutko-signature` of raw JSON body.
 *              LiqPay: base64 data + signature in form-data (legacy — handled by /api/payments/liqpay).
 *              This endpoint is the new canonical target; legacy route continues to handle subscriptions.
 * created: 2026-04-24
 * --- */

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { markHeld } from '@/lib/payments/escrow';


function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function verifyHutkoSignature(raw: string, signature: string): boolean {
  const secret = process.env.HUTKO_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface HutkoEvent {
  type: string;
  data?: {
    reference?: string;
    payment_id?: string;
    refund_id?: string;
    payout_id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    error?: string;
    message?: string;
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-hutko-signature') ?? '';

  if (!verifyHutkoSignature(raw, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: HutkoEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const db = admin();
  const data = event.data ?? {};
  const intentId = data.reference;  // we use payment_intents.id as reference

  console.log('[payments/webhook] event', event.type, 'ref:', intentId);

  // ── Checkout events ──
  if (event.type === 'checkout.succeeded' || event.type === 'payment.completed') {
    if (!intentId) return NextResponse.json({ ok: true, ignored: 'no_reference' });
    await markHeld(db, intentId, data.payment_id ?? '', signature);
    return NextResponse.json({ ok: true });
  }

  if (event.type === 'checkout.failed' || event.type === 'payment.failed') {
    if (intentId) {
      await db
        .from('payment_intents')
        .update({ status: 'failed', error_message: data.error ?? data.message ?? 'provider_failed' })
        .eq('id', intentId)
        .eq('status', 'pending');
    }
    return NextResponse.json({ ok: true });
  }

  // ── Refund events ──
  if (event.type === 'refund.completed') {
    if (data.refund_id) {
      await db
        .from('payment_intents')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('provider_refund_id', data.refund_id);
    } else if (intentId) {
      await db
        .from('payment_intents')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', intentId);
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === 'refund.failed') {
    if (data.refund_id) {
      await db
        .from('payment_intents')
        .update({ error_message: data.error ?? 'refund_failed' })
        .eq('provider_refund_id', data.refund_id);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Payout events (to master) ──
  if (event.type === 'payout.completed') {
    if (data.payout_id) {
      await db
        .from('master_payouts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('provider_payout_id', data.payout_id);
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === 'payout.failed') {
    if (data.payout_id) {
      await db
        .from('master_payouts')
        .update({ status: 'failed', error_message: data.error ?? 'payout_failed' })
        .eq('provider_payout_id', data.payout_id);
    }
    return NextResponse.json({ ok: true });
  }

  console.log('[payments/webhook] ignored event type:', event.type);
  return NextResponse.json({ ok: true, ignored: event.type });
}
