/** --- YAML
 * name: Escrow state machine
 * description: Core escrow business logic — creating payment intents, transitioning states,
 *              computing platform fees, pulling config, calling provider for real refunds/payouts.
 * created: 2026-04-24
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getProvider, type ProviderName } from './provider';

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
  currency?: 'UAH' | 'USD' | 'EUR';
  description?: string;
  metadata?: Record<string, unknown>;
  /** Override default provider. */
  provider?: ProviderName;
}

export interface CreatedIntent {
  intentId: string;
  redirectUrl: string;
  orderId: string;
}

/**
 * Create a pending payment_intent and get the provider checkout URL.
 */
export async function createPaymentIntent(args: CreateIntentArgs): Promise<CreatedIntent> {
  const takeRate = await getTakeRatePercent(args.db);
  const amount = Math.round(args.amount * 100) / 100;
  const platformFee = Math.round(amount * (takeRate / 100) * 100) / 100;
  const masterNet = Math.round((amount - platformFee) * 100) / 100;
  const providerName = args.provider ?? 'hutko';
  const currency = args.currency ?? 'UAH';

  const { data: row, error } = await args.db
    .from('payment_intents')
    .insert({
      appointment_id: args.appointmentId,
      master_id: args.masterId,
      client_id: args.clientId,
      amount,
      currency,
      platform_fee: platformFee,
      master_net: masterNet,
      status: 'pending' as IntentStatus,
      provider: providerName,
      metadata: args.metadata ?? {},
    })
    .select('id')
    .single();

  if (error || !row) {
    throw new Error(`Failed to create payment_intent: ${error?.message ?? 'unknown'}`);
  }
  const orderId = row.id;

  await args.db
    .from('payment_intents')
    .update({ provider_order_id: orderId })
    .eq('id', row.id);

  const provider = await getProvider(providerName);
  const checkout = await provider.createCheckout({
    orderId,
    amount,
    currency,
    description: args.description ?? 'Предоплата визита',
    resultUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/return?i=${row.id}`,
    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
    metadata: args.metadata,
  });

  if (checkout.providerOrderId) {
    await args.db
      .from('payment_intents')
      .update({ provider_order_id: checkout.providerOrderId })
      .eq('id', row.id);
  }

  return {
    intentId: row.id,
    redirectUrl: checkout.redirectUrl,
    orderId,
  };
}

/** pending → held */
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
    .eq('status', 'pending')
    .select('id, appointment_id')
    .maybeSingle();

  if (!data) return false;
  if (data.appointment_id) {
    await db.from('appointments').update({ deposit_intent_id: intentId }).eq('id', data.appointment_id);
  }
  return true;
}

/**
 * held → released: master gets the money via provider.payout(), platform records commission.
 * Creates a master_payouts row for reconciliation.
 */
export async function release(db: SupabaseClient, intentId: string): Promise<boolean> {
  const { data: intent } = await db
    .from('payment_intents')
    .select(
      'id, master_id, amount, platform_fee, master_net, currency, status, provider, ' +
      'masters:master_id!payment_intents_master_id_fkey(payout_account, payout_display_name, payout_provider, is_active)'
    )
    .eq('id', intentId)
    .maybeSingle();

  type Loaded = {
    id: string;
    master_id: string;
    amount: number;
    platform_fee: number;
    master_net: number;
    currency: string;
    status: string;
    provider: ProviderName;
    masters: { payout_account: string | null; payout_display_name: string | null; payout_provider: string | null; is_active: boolean } | null;
  };
  const row = intent as unknown as Loaded | null;
  if (!row || row.status !== 'held') return false;

  const providerName = (row.masters?.payout_provider as ProviderName) ?? row.provider ?? 'hutko';
  const acct = row.masters?.payout_account;
  const recipient = row.masters?.payout_display_name ?? 'Master';

  const now = new Date().toISOString();
  const { data: updated } = await db
    .from('payment_intents')
    .update({ status: 'released', released_at: now })
    .eq('id', intentId)
    .eq('status', 'held')
    .select('id')
    .maybeSingle();
  if (!updated) return false;

  // Record commission for superadmin finance
  const takeRate = await getTakeRatePercent(db);
  await db.from('platform_earnings').insert({
    payment_intent_id: row.id,
    master_id: row.master_id,
    gross_amount: row.amount,
    fee_amount: row.platform_fee,
    fee_percent: takeRate,
    currency: row.currency,
  });

  // Create a master_payouts row (queued) if master has account configured
  if (acct) {
    const { data: payoutRow } = await db
      .from('master_payouts')
      .insert({
        master_id: row.master_id,
        provider: providerName,
        total_amount: row.master_net,
        platform_fee_amount: row.platform_fee,
        currency: row.currency,
        intent_ids: [row.id],
        status: 'queued',
      })
      .select('id')
      .single();

    // Trigger actual transfer via provider
    if (payoutRow?.id) {
      try {
        const provider = await getProvider(providerName);
        const resp = await provider.payout({
          accountNumber: acct,
          amount: row.master_net,
          currency: row.currency as 'UAH' | 'USD' | 'EUR',
          recipientName: recipient,
          description: `CRES-CA выплата · intent ${row.id.slice(0, 8)}`,
          referenceId: payoutRow.id,
        });
        await db
          .from('master_payouts')
          .update({
            provider_payout_id: resp.providerPayoutId || null,
            status: resp.status === 'completed' ? 'completed' : resp.status === 'pending' ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
            completed_at: resp.status === 'completed' ? new Date().toISOString() : null,
            error_message: resp.status === 'failed' ? resp.message ?? 'payout_failed' : null,
          })
          .eq('id', payoutRow.id);

        if (resp.providerPayoutId) {
          await db
            .from('payment_intents')
            .update({ provider_payout_id: resp.providerPayoutId })
            .eq('id', row.id);
        }
      } catch (e) {
        console.error('[escrow/release] payout call failed:', (e as Error).message);
        await db
          .from('master_payouts')
          .update({ status: 'failed', error_message: (e as Error).message })
          .eq('id', payoutRow.id);
      }
    }
  } else {
    console.warn('[escrow/release] master has no payout_account — released in DB only, manual settlement required', { master_id: row.master_id });
  }

  return true;
}

/** held → captured: no-show — master keeps the deposit (same payout flow as release) */
export async function capture(db: SupabaseClient, intentId: string): Promise<boolean> {
  const { data } = await db
    .from('payment_intents')
    .update({ status: 'captured', captured_at: new Date().toISOString() })
    .eq('id', intentId)
    .eq('status', 'held')
    .select('id')
    .maybeSingle();
  if (!data) return false;

  // Reuse release logic for actual payout
  // (we just updated status to 'captured' so can't go through release() again)
  // Directly do the payout work:
  const { data: intent } = await db
    .from('payment_intents')
    .select(
      'id, master_id, amount, platform_fee, master_net, currency, provider, ' +
      'masters:master_id!payment_intents_master_id_fkey(payout_account, payout_display_name, payout_provider)'
    )
    .eq('id', intentId)
    .maybeSingle();

  type Loaded = {
    id: string;
    master_id: string;
    amount: number;
    platform_fee: number;
    master_net: number;
    currency: string;
    provider: ProviderName;
    masters: { payout_account: string | null; payout_display_name: string | null; payout_provider: string | null } | null;
  };
  const row = intent as unknown as Loaded | null;
  if (!row) return true;

  const takeRate = await getTakeRatePercent(db);
  await db.from('platform_earnings').insert({
    payment_intent_id: row.id,
    master_id: row.master_id,
    gross_amount: row.amount,
    fee_amount: row.platform_fee,
    fee_percent: takeRate,
    currency: row.currency,
  });

  const acct = row.masters?.payout_account;
  if (!acct) return true;

  const providerName = (row.masters?.payout_provider as ProviderName) ?? row.provider ?? 'hutko';
  const { data: payoutRow } = await db
    .from('master_payouts')
    .insert({
      master_id: row.master_id,
      provider: providerName,
      total_amount: row.master_net,
      platform_fee_amount: row.platform_fee,
      currency: row.currency,
      intent_ids: [row.id],
      status: 'queued',
    })
    .select('id')
    .single();

  if (payoutRow?.id) {
    try {
      const provider = await getProvider(providerName);
      const resp = await provider.payout({
        accountNumber: acct,
        amount: row.master_net,
        currency: row.currency as 'UAH' | 'USD' | 'EUR',
        recipientName: row.masters?.payout_display_name ?? 'Master',
        description: `CRES-CA no-show · intent ${row.id.slice(0, 8)}`,
        referenceId: payoutRow.id,
      });
      await db
        .from('master_payouts')
        .update({
          provider_payout_id: resp.providerPayoutId || null,
          status: resp.status === 'completed' ? 'completed' : resp.status === 'pending' ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          completed_at: resp.status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', payoutRow.id);
    } catch (e) {
      await db.from('master_payouts').update({ status: 'failed', error_message: (e as Error).message }).eq('id', payoutRow.id);
    }
  }
  return true;
}

/**
 * held → refunded via real provider.refund() call. Money goes back to the client card.
 */
export async function refund(db: SupabaseClient, intentId: string, reason?: string): Promise<boolean> {
  const { data: intent } = await db
    .from('payment_intents')
    .select('id, amount, currency, status, provider, provider_payment_id')
    .eq('id', intentId)
    .maybeSingle();

  if (!intent) return false;
  if (intent.status !== 'held' && intent.status !== 'pending') return false;

  // Pending intents never charged the client → just mark refunded without provider call
  if (intent.status === 'pending') {
    const { data } = await db
      .from('payment_intents')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_reason: reason ?? null,
      })
      .eq('id', intentId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    return !!data;
  }

  // Held → call provider
  if (!intent.provider_payment_id) {
    console.error('[escrow/refund] intent held but provider_payment_id missing', { intentId });
    return false;
  }

  const provider = await getProvider(intent.provider as ProviderName);
  const resp = await provider.refund({
    providerPaymentId: intent.provider_payment_id,
    amount: intent.amount,
    currency: intent.currency as 'UAH' | 'USD' | 'EUR',
    reason: reason ?? 'refund_requested',
    referenceId: intent.id,
  });

  if (resp.status === 'failed') {
    await db.from('payment_intents').update({ error_message: resp.message ?? 'provider_refund_failed' }).eq('id', intentId);
    return false;
  }

  // Mark refunded (pending → status 'pending' remains until webhook; completed → immediate)
  const newStatus: IntentStatus = resp.status === 'completed' ? 'refunded' : 'held';
  await db
    .from('payment_intents')
    .update({
      status: newStatus,
      refunded_at: resp.status === 'completed' ? new Date().toISOString() : null,
      refund_reason: reason ?? null,
      refund_amount: intent.amount,
      provider_refund_id: resp.providerRefundId || null,
    })
    .eq('id', intentId);

  return true;
}

/* ─── Config helpers ─── */

export async function getTakeRatePercent(db: SupabaseClient): Promise<number> {
  const { data } = await db.from('platform_config').select('value').eq('key', 'take_rate_percent').maybeSingle();
  const raw = data?.value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 1.5;
}

export async function getAutoReleaseHours(db: SupabaseClient): Promise<number> {
  const { data } = await db.from('platform_config').select('value').eq('key', 'auto_release_hours').maybeSingle();
  const raw = data?.value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 24;
}

/** Helper for booking routes — returns { required, amount, reason } for a (service, client) pair. */
export async function computeDepositForBooking(
  db: SupabaseClient,
  opts: { serviceId: string; masterId: string; clientId: string },
): Promise<{ required: boolean; amount: number; reason: 'service' | 'gray_list' | null }> {
  const [{ data: service }, { data: depositFlag }] = await Promise.all([
    db.from('services').select('price, requires_prepayment, deposit_percent').eq('id', opts.serviceId).maybeSingle(),
    db.rpc('is_deposit_required', { p_master_id: opts.masterId, p_client_id: opts.clientId }),
  ]);

  if (!service) return { required: false, amount: 0, reason: null };

  const serviceFlag = Boolean(service.requires_prepayment);
  const grayListFlag = depositFlag === true;

  if (!serviceFlag && !grayListFlag) return { required: false, amount: 0, reason: null };

  const percent = service.deposit_percent ?? 30;
  const amount = Math.round(Number(service.price) * (percent / 100) * 100) / 100;
  return {
    required: amount > 0,
    amount,
    reason: grayListFlag ? 'gray_list' : 'service',
  };
}
