/** --- YAML
 * name: LiqPay Integration
 * description: Helper functions for LiqPay payment processing — form generation and callback verification
 * --- */

import crypto from 'crypto';

const LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY!;
const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY!;

interface PaymentParams {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  resultUrl?: string;
  serverUrl?: string;
}

function sign(data: string): string {
  return crypto
    .createHash('sha1')
    .update(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY)
    .digest('base64');
}

export function createPaymentForm({
  orderId,
  amount,
  currency,
  description,
  resultUrl,
  serverUrl,
}: PaymentParams): { data: string; signature: string } {
  const params = {
    public_key: LIQPAY_PUBLIC_KEY,
    version: '3',
    action: 'pay',
    amount,
    currency,
    description,
    order_id: orderId,
    result_url: resultUrl || `${process.env.NEXT_PUBLIC_APP_URL}/history`,
    server_url: serverUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/liqpay`,
  };

  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = sign(data);

  return { data, signature };
}

export function createSubscriptionForm({
  orderId,
  amount,
  currency,
  description,
  subscribePeriodicity,
}: PaymentParams & { subscribePeriodicity: 'month' | 'year' }): { data: string; signature: string } {
  const params = {
    public_key: LIQPAY_PUBLIC_KEY,
    version: '3',
    action: 'subscribe',
    amount,
    currency,
    description,
    order_id: orderId,
    subscribe: '1',
    subscribe_date_start: new Date().toISOString().split('T')[0],
    subscribe_periodicity: subscribePeriodicity,
    result_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    server_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/liqpay`,
  };

  const data = Buffer.from(JSON.stringify(params)).toString('base64');
  const signature = sign(data);

  return { data, signature };
}

export interface LiqPayCallback {
  action: string;
  status: string;
  order_id: string;
  amount: number;
  currency: string;
  description: string;
  transaction_id: number;
  sender_phone?: string;
  err_code?: string;
  err_description?: string;
}

export function verifyCallback(data: string, receivedSignature: string): LiqPayCallback | null {
  const expectedSignature = sign(data);
  if (expectedSignature !== receivedSignature) return null;

  const decoded = Buffer.from(data, 'base64').toString('utf-8');
  return JSON.parse(decoded) as LiqPayCallback;
}
