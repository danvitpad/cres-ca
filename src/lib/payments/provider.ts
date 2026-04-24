/** --- YAML
 * name: Payment provider abstraction
 * description: Uniform interface for Hutko / LiqPay / future providers. Escrow business logic
 *              in escrow.ts calls only this interface — swapping providers is one-line change.
 * created: 2026-04-24
 * --- */

export type ProviderName = 'hutko' | 'liqpay' | 'manual';

export interface CheckoutRequest {
  orderId: string;                 // our payment_intents.id
  amount: number;
  currency: 'UAH' | 'USD' | 'EUR';
  description: string;
  resultUrl: string;               // client redirect after checkout
  serverUrl: string;               // webhook URL (server-to-server)
  metadata?: Record<string, unknown>;
}

export interface CheckoutResponse {
  /** Full URL to redirect the client browser to */
  redirectUrl: string;
  /** Provider-side order id if different from our orderId (for tracking) */
  providerOrderId?: string;
}

export interface RefundRequest {
  providerPaymentId: string;       // from payment_intents.provider_payment_id
  amount: number;
  currency: 'UAH' | 'USD' | 'EUR';
  reason?: string;
  referenceId?: string;            // our intent id for idempotency
}

export interface RefundResponse {
  providerRefundId: string;
  status: 'completed' | 'pending' | 'failed';
  message?: string;
}

export interface PayoutRequest {
  accountNumber: string;           // IBAN / card / wallet, from masters.payout_account
  amount: number;
  currency: 'UAH' | 'USD' | 'EUR';
  recipientName: string;           // masters.payout_display_name or master full_name
  description: string;             // "Выплата за X визитов, comm 1.5%"
  referenceId: string;             // our master_payouts.id for idempotency
}

export interface PayoutResponse {
  providerPayoutId: string;
  status: 'completed' | 'pending' | 'failed';
  message?: string;
}

export interface PaymentProvider {
  name: ProviderName;
  /** Build a hosted-checkout URL (provider collects the card). */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResponse>;
  /** Trigger a refund on an already-charged payment. Money goes back to the card. */
  refund(req: RefundRequest): Promise<RefundResponse>;
  /** Push money to a master's account (IBAN / card). */
  payout(req: PayoutRequest): Promise<PayoutResponse>;
}

/** Resolve provider by env / master settings. */
export async function getProvider(name?: ProviderName): Promise<PaymentProvider> {
  const resolved: ProviderName = name ?? (process.env.PAYMENT_PROVIDER as ProviderName) ?? 'hutko';
  switch (resolved) {
    case 'hutko': {
      const { HutkoProvider } = await import('./providers/hutko');
      return new HutkoProvider();
    }
    case 'liqpay': {
      const { LiqPayProvider } = await import('./providers/liqpay-provider');
      return new LiqPayProvider();
    }
    default:
      throw new Error(`Unknown payment provider: ${resolved}`);
  }
}
