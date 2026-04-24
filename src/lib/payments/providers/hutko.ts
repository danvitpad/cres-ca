/** --- YAML
 * name: Hutko payment provider
 * description: Hutko.org integration for checkout / refund / payout. Webhook signatures use HMAC-SHA256 hex
 *              with header `x-hutko-signature` (consistent with existing /api/webhooks/hutko handler).
 *
 *              Endpoint base URLs come from env so they can be pointed at sandbox / production:
 *                HUTKO_API_URL           — default https://api.hutko.org/v1
 *                HUTKO_API_KEY           — Bearer token
 *                HUTKO_MERCHANT_ID       — account identifier
 *                HUTKO_WEBHOOK_SECRET    — HMAC key used to sign incoming webhooks
 *
 *              Hutko docs are NDA-only at the time of writing. Endpoint paths
 *              (/checkouts, /refunds, /payouts) are the standard PSP convention and
 *              can be overridden via HUTKO_PATH_* env vars if they differ in practice.
 * created: 2026-04-24
 * --- */

import type { PaymentProvider, CheckoutRequest, CheckoutResponse, RefundRequest, RefundResponse, PayoutRequest, PayoutResponse } from '../provider';

const DEFAULT_BASE = 'https://api.hutko.org/v1';

function baseUrl(): string {
  return process.env.HUTKO_API_URL?.replace(/\/+$/, '') ?? DEFAULT_BASE;
}

function requireKey(): string {
  const key = process.env.HUTKO_API_KEY;
  if (!key) throw new Error('HUTKO_API_KEY not set');
  return key;
}

async function hutkoRequest<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: T | null; status: number; error?: string }> {
  const url = `${baseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${requireKey()}`,
        ...(process.env.HUTKO_MERCHANT_ID ? { 'X-Merchant-Id': process.env.HUTKO_MERCHANT_ID } : {}),
      },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get('content-type') ?? '';
    const isJson = ct.includes('application/json');
    const data = (isJson ? await res.json().catch(() => null) : null) as T | null;
    if (!res.ok) {
      const message = (data as { message?: string; error?: string } | null)?.message
        ?? (data as { error?: string } | null)?.error
        ?? `HTTP ${res.status}`;
      console.error('[hutko]', path, 'failed:', res.status, message);
      return { ok: false, data, status: res.status, error: message };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    console.error('[hutko]', path, 'network error:', (e as Error).message);
    return { ok: false, data: null, status: 0, error: (e as Error).message };
  }
}

export class HutkoProvider implements PaymentProvider {
  readonly name = 'hutko' as const;

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const path = process.env.HUTKO_PATH_CHECKOUT ?? '/checkouts';
    // Convert to cents/kopiyky — most PSPs expect integer minor units
    const amountMinor = Math.round(req.amount * 100);

    const { ok, data, error } = await hutkoRequest<{
      id?: string;
      url?: string;
      payment_url?: string;
      checkout_url?: string;
    }>(path, {
      reference: req.orderId,
      amount: amountMinor,
      currency: req.currency,
      description: req.description,
      result_url: req.resultUrl,
      webhook_url: req.serverUrl,
      metadata: req.metadata ?? {},
    });

    if (!ok || !data) {
      throw new Error(`Hutko createCheckout failed: ${error ?? 'unknown'}`);
    }

    const redirectUrl = data.checkout_url ?? data.payment_url ?? data.url;
    if (!redirectUrl) {
      throw new Error('Hutko returned no checkout URL');
    }
    return { redirectUrl, providerOrderId: data.id };
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    const path = process.env.HUTKO_PATH_REFUND ?? '/refunds';
    const amountMinor = Math.round(req.amount * 100);

    const { ok, data, error } = await hutkoRequest<{
      id?: string;
      status?: 'completed' | 'pending' | 'failed' | 'succeeded' | 'processing';
      message?: string;
    }>(path, {
      reference: req.referenceId,
      payment_id: req.providerPaymentId,
      amount: amountMinor,
      currency: req.currency,
      reason: req.reason ?? 'refund_requested',
    });

    if (!ok || !data?.id) {
      return { providerRefundId: '', status: 'failed', message: error ?? 'refund_failed' };
    }
    // Normalise status
    const normStatus: RefundResponse['status'] =
      data.status === 'succeeded' || data.status === 'completed' ? 'completed'
      : data.status === 'processing' || data.status === 'pending' ? 'pending'
      : 'failed';
    return {
      providerRefundId: data.id,
      status: normStatus,
      message: data.message,
    };
  }

  async payout(req: PayoutRequest): Promise<PayoutResponse> {
    const path = process.env.HUTKO_PATH_PAYOUT ?? '/payouts';
    const amountMinor = Math.round(req.amount * 100);

    const { ok, data, error } = await hutkoRequest<{
      id?: string;
      status?: 'completed' | 'pending' | 'failed' | 'succeeded' | 'processing' | 'queued';
      message?: string;
    }>(path, {
      reference: req.referenceId,
      destination: {
        account: req.accountNumber,
        name: req.recipientName,
      },
      amount: amountMinor,
      currency: req.currency,
      description: req.description,
    });

    if (!ok || !data?.id) {
      return { providerPayoutId: '', status: 'failed', message: error ?? 'payout_failed' };
    }
    const normStatus: PayoutResponse['status'] =
      data.status === 'succeeded' || data.status === 'completed' ? 'completed'
      : data.status === 'processing' || data.status === 'pending' || data.status === 'queued' ? 'pending'
      : 'failed';
    return {
      providerPayoutId: data.id,
      status: normStatus,
      message: data.message,
    };
  }
}
