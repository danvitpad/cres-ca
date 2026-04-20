/** --- YAML
 * name: Hutko Webhook Endpoint
 * description: Phase 3 — stub. Accepts hutko.org subscription/invoice events and applies them to subscriptions/payment_history. Logic in place, but hutko.org integration is not live yet — production will start when HUTKO_WEBHOOK_SECRET is set and hutko begins sending events.
 * created: 2026-04-19
 * --- */

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const secret = process.env.HUTKO_WEBHOOK_SECRET;
  const signature = request.headers.get('x-hutko-signature') ?? '';
  const raw = await request.text();

  // Security: require configured secret. Previously accepted unsigned events
  // in stub mode — that meant anyone POSTing to /api/webhooks/hutko could
  // create payment_history rows and flip subscription status. Fixed 2026-04-20.
  if (!secret) {
    console.error('[hutko] HUTKO_WEBHOOK_SECRET not set — rejecting webhook');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log('[hutko] event received', event.type, event.data);

  switch (event.type) {
    case 'subscription.created': {
      const data = (event.data ?? {}) as { hutko_subscription_id?: string; hutko_customer_id?: string; profile_id?: string; period_end?: string };
      if (!data.profile_id) return NextResponse.json({ error: 'missing_profile_id' }, { status: 400 });
      await admin.from('subscriptions').update({
        status: 'active',
        hutko_subscription_id: data.hutko_subscription_id ?? null,
        hutko_customer_id: data.hutko_customer_id ?? null,
        current_period_end: data.period_end ?? null,
      }).eq('profile_id', data.profile_id);
      break;
    }
    case 'subscription.updated': {
      const data = (event.data ?? {}) as { hutko_subscription_id?: string; period_start?: string; period_end?: string };
      if (data.hutko_subscription_id) {
        await admin.from('subscriptions').update({
          current_period_start: data.period_start ?? null,
          current_period_end: data.period_end ?? null,
        }).eq('hutko_subscription_id', data.hutko_subscription_id);
      }
      break;
    }
    case 'subscription.cancelled': {
      const data = (event.data ?? {}) as { hutko_subscription_id?: string };
      if (data.hutko_subscription_id) {
        await admin.from('subscriptions').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }).eq('hutko_subscription_id', data.hutko_subscription_id);
      }
      break;
    }
    case 'invoice.paid': {
      const data = (event.data ?? {}) as { hutko_subscription_id?: string; profile_id?: string; amount?: number; currency?: string; hutko_payment_id?: string; invoice_url?: string };
      if (!data.profile_id) return NextResponse.json({ error: 'missing_profile_id' }, { status: 400 });
      const { data: sub } = await admin.from('subscriptions').select('id').eq('hutko_subscription_id', data.hutko_subscription_id ?? '').maybeSingle();
      await admin.from('payment_history').insert({
        subscription_id: sub?.id ?? null,
        profile_id: data.profile_id,
        amount: data.amount ?? 0,
        currency: data.currency ?? 'UAH',
        status: 'succeeded',
        provider: 'hutko',
        hutko_payment_id: data.hutko_payment_id ?? null,
        invoice_url: data.invoice_url ?? null,
      });
      break;
    }
    case 'invoice.payment_failed': {
      const data = (event.data ?? {}) as { hutko_subscription_id?: string; profile_id?: string; amount?: number; currency?: string; hutko_payment_id?: string };
      await admin.from('subscriptions').update({ status: 'past_due' }).eq('hutko_subscription_id', data.hutko_subscription_id ?? '');
      if (data.profile_id) {
        await admin.from('payment_history').insert({
          profile_id: data.profile_id,
          amount: data.amount ?? 0,
          currency: data.currency ?? 'UAH',
          status: 'failed',
          provider: 'hutko',
          hutko_payment_id: data.hutko_payment_id ?? null,
        });
      }
      break;
    }
    default:
      console.log('[hutko] ignoring unknown event type', event.type);
  }

  return NextResponse.json({ ok: true });
}
