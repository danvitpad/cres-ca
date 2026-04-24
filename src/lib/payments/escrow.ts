/** --- YAML
 * name: Escrow state machine
 * description: Core escrow business logic — creating payment intents, transitioning states,
 *              computing platform fees, pulling config. Keeps DB + provider details in one place.
 * created: 2026-04-24
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createPaymentForm } from './liqpay';

export type IntentStatus =
  | 'pending'
  | 'held'
  | 'released'
  | 'captured'
  | 'refunded'
  | 'failed'
  | 'expired';

export interface CreateIntentArgs {
  db: SupabaseClient;
  appointmentId: string;
  masterId: string;
  clientId: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatedIntent {
  intentId: string;
  checkoutData: string;
  checkoutSignature: string;
  orderId: string;
}

/**
 * Create a pending payment_intent and return LiqPay checkout payload.
 * Client posts (data, signature) to https://www.liqpay.ua/api/3/checkout, or you can redirect
 * to a pre-built URL: `https://www.liqpay.ua/api/3/checkout?data=...&signature=...`.
 */
export async function createPaymentIntent(args: CreateIntentArgs): Promise<CreatedIntent> {
  const takeRate = await getTakeRatePercent(args.db);
  const amount = Math.round(args.amount * 100) / 100;
  const platformFee = Math.round(amount * (takeRate / 100) * 100) / 100;
  const masterNet = Math.round((amount - platformFee) * 100) / 100;

  const { data: row, error } = await args.db
    .from('payment_intents')
    .insert({
      appointment_id: args.appointmentId,
      master_id: args.masterId,
      client_id: args.clientId,
      amount,
      currency: args.currency ?? 'UAH',
      platform_fee: platformFee,
      master_net: masterNet,
      status: 'pending' as IntentStatus,
      provider: 'liqpay',
      metadata: args.metadata ?? {},
    })
    .select('id')
    .single();

  if (error || !row) {
    throw new Error(`Failed to create payment_intent: ${error?.message ?? 'unknown'}`);
  }

  // Use the intent id as provider_order_id for idempotency
  const orderId = row.id;
  await args.db
    .from('payment_intents')
    .update({ provider_order_id: orderId })
    .eq('id', row.id);

  const { data: formData, signature } = createPaymentForm({
    orderId,
    amount,
    currency: args.currency ?? 'UAH',
    description: args.description ?? 'Предоплата визита',
    resultUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/return?i=${row.id}`,
    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/liqpay/callback`,
  });

  return {
    intentId: row.id,
    checkoutData: formData,
    checkoutSignature: signature,
    orderId,
  };
}

/**
 * Transition pending → held. Called from LiqPay callback on successful payment.
 * Idempotent (already-held returns false without error).
 */
export async function markHeld(
  db: SupabaseClient,
  intentId: string,
  providerPaymentId: string,
  providerSignature: string,
): Promise<boolean> {
  const { data } = await db
    .from('payment_intents')
    .update({
      status: 'held',
      paid_at: new Date().toISOString(),
      provider_payment_id: providerPaymentId,
      provider_signature: providerSignature,
    })
    .eq('id', intentId)
    .eq('status', 'pending')  // concurrency guard
    .select('id, appointment_id')
    .maybeSingle();

  if (!data) return false;

  // Link appointment.deposit_intent_id if not set
  if (data.appointment_id) {
    await db
      .from('appointments')
      .update({ deposit_intent_id: intentId })
      .eq('id', data.appointment_id);
  }
  return true;
}

/**
 * held → released: master gets the money, platform records its fee.
 */
export async function release(db: SupabaseClient, intentId: string): Promise<boolean> {
  const { data: intent } = await db
    .from('payment_intents')
    .select('id, master_id, amount, platform_fee, master_net, currency, status')
    .eq('id', intentId)
    .maybeSingle();

  if (!intent || intent.status !== 'held') return false;

  const now = new Date().toISOString();
  const { data } = await db
    .from('payment_intents')
    .update({ status: 'released', released_at: now })
    .eq('id', intentId)
    .eq('status', 'held')
    .select('id')
    .maybeSingle();

  if (!data) return false;

  // Record platform earnings (for superadmin finance)
  const takeRate = await getTakeRatePercent(db);
  await db.from('platform_earnings').insert({
    payment_intent_id: intent.id,
    master_id: intent.master_id,
    gross_amount: intent.amount,
    fee_amount: intent.platform_fee,
    fee_percent: takeRate,
    currency: intent.currency,
  });

  return true;
}

/**
 * held → captured: master keeps the deposit (no-show case).
 * Same as release but marks reason differently in UI.
 */
export async function capture(db: SupabaseClient, intentId: string): Promise<boolean> {
  const { data: intent } = await db
    .from('payment_intents')
    .select('id, master_id, amount, platform_fee, currency, status')
    .eq('id', intentId)
    .maybeSingle();

  if (!intent || intent.status !== 'held') return false;

  const { data } = await db
    .from('payment_intents')
    .update({ status: 'captured', captured_at: new Date().toISOString() })
    .eq('id', intentId)
    .eq('status', 'held')
    .select('id')
    .maybeSingle();

  if (!data) return false;

  const takeRate = await getTakeRatePercent(db);
  await db.from('platform_earnings').insert({
    payment_intent_id: intent.id,
    master_id: intent.master_id,
    gross_amount: intent.amount,
    fee_amount: intent.platform_fee,
    fee_percent: takeRate,
    currency: intent.currency,
  });
  return true;
}

/**
 * held → refunded: client gets money back (cancelled in time). No platform fee taken.
 * NOTE: this does NOT actually send money back through LiqPay (needs a separate refund API call
 * via `action: 'refund'`). For MVP this only updates our DB; operator handles the actual refund.
 */
export async function refund(db: SupabaseClient, intentId: string, reason?: string): Promise<boolean> {
  const { data } = await db
    .from('payment_intents')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      error_message: reason ?? null,
    })
    .eq('id', intentId)
    .in('status', ['held', 'pending'])
    .select('id')
    .maybeSingle();
  return !!data;
}

/**
 * Fetch take-rate % from platform_config (with fallback to 1.5%).
 */
export async function getTakeRatePercent(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from('platform_config')
    .select('value')
    .eq('key', 'take_rate_percent')
    .maybeSingle();
  const raw = data?.value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 1.5;
}

export async function getAutoReleaseHours(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from('platform_config')
    .select('value')
    .eq('key', 'auto_release_hours')
    .maybeSingle();
  const raw = data?.value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 24;
}

/**
 * Helper for booking routes — returns { required, amount } for a (service, client) pair.
 */
export async function computeDepositForBooking(
  db: SupabaseClient,
  opts: { serviceId: string; masterId: string; clientId: string },
): Promise<{ required: boolean; amount: number; reason: 'service' | 'gray_list' | null }> {
  const [{ data: service }, { data: depositFlag }] = await Promise.all([
    db.from('services').select('price, requires_prepayment, deposit_percent, currency')
      .eq('id', opts.serviceId).maybeSingle(),
    db.rpc('is_deposit_required', { p_master_id: opts.masterId, p_client_id: opts.clientId }),
  ]);

  if (!service) return { required: false, amount: 0, reason: null };

  const serviceFlag = Boolean(service.requires_prepayment);
  const grayListFlag = depositFlag === true;

  if (!serviceFlag && !grayListFlag) {
    return { required: false, amount: 0, reason: null };
  }

  const percent = service.deposit_percent ?? 30;
  const amount = Math.round(Number(service.price) * (percent / 100) * 100) / 100;
  return {
    required: amount > 0,
    amount,
    reason: grayListFlag ? 'gray_list' : 'service',
  };
}
