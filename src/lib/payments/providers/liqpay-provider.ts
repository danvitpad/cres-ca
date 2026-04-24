/** --- YAML
 * name: LiqPay provider adapter
 * description: Wraps the existing liqpay.ts helpers in the PaymentProvider interface. Used as fallback
 *              when PAYMENT_PROVIDER=liqpay. Refund + payout go through LiqPay Server-to-Server API
 *              using action=refund and action=p2pcredit.
 * created: 2026-04-24
 * --- */

import type {
  PaymentProvider,
  CheckoutRequest,
  CheckoutResponse,
  RefundRequest,
  RefundResponse,
  PayoutRequest,
  PayoutResponse,
} from '../provider';
import { createPaymentForm } from '../liqpay';
import { createHash } from 'node:crypto';

const API_URL = 'https://www.liqpay.ua/api/request';

function sign(data: string): string {
  const key = process.env.LIQPAY_PRIVATE_KEY;
  if (!key) throw new Error('LIQPAY_PRIVATE_KEY not set');
  return createHash('sha1').update(key + data + key).digest('base64');
}

async function liqpayApi<T = Record<string, unknown>>(params: Record<string, unknown>): Promise<T | null> {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY;
  if (!publicKey) throw new Error('LIQPAY_PUBLIC_KEY not set');

  const payload = {
    version: 3,
    public_key: publicKey,
    ...params,
    ...(process.env.LIQPAY_SANDBOX === '1' ? { sandbox: 1 } : {}),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = sign(data);

  const form = new URLSearchParams();
  form.append('data', data);
  form.append('signature', signature);

  try {
    const res = await fetch(API_URL, { method: 'POST', body: form });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export class LiqPayProvider implements PaymentProvider {
  readonly name = 'liqpay' as const;

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const { data: formData, signature } = createPaymentForm({
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency,
      description: req.description,
      resultUrl: req.resultUrl,
      serverUrl: req.serverUrl,
    });
    const url =
      `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(formData)}` +
      `&signature=${encodeURIComponent(signature)}`;
    return { redirectUrl: url };
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    const resp = await liqpayApi<{
      status?: string;
      payment_id?: number;
      err_description?: string;
    }>({
      action: 'refund',
      order_id: req.referenceId ?? req.providerPaymentId,
      amount: req.amount,
      currency: req.currency,
    });
    if (!resp) return { providerRefundId: '', status: 'failed', message: 'network' };
    const status = resp.status === 'reversed' || resp.status === 'success' ? 'completed' : 'failed';
    return {
      providerRefundId: resp.payment_id ? String(resp.payment_id) : '',
      status,
      message: resp.err_description,
    };
  }

  async payout(req: PayoutRequest): Promise<PayoutResponse> {
    // LiqPay p2pcredit — transfers money from merchant account to a card.
    const resp = await liqpayApi<{
      status?: string;
      payment_id?: number;
      err_description?: string;
    }>({
      action: 'p2pcredit',
      order_id: req.referenceId,
      amount: req.amount,
      currency: req.currency,
      description: req.description,
      receiver_card: req.accountNumber,
      receiver_first_name: req.recipientName.split(' ')[0] ?? req.recipientName,
      receiver_last_name: req.recipientName.split(' ').slice(1).join(' ') || req.recipientName,
    });
    if (!resp) return { providerPayoutId: '', status: 'failed', message: 'network' };
    const status = resp.status === 'success' ? 'completed' : resp.status === 'processing' ? 'pending' : 'failed';
    return {
      providerPayoutId: resp.payment_id ? String(resp.payment_id) : '',
      status,
      message: resp.err_description,
    };
  }
}
