# PHASE 8: PAYMENTS (LiqPay)

> Prepayment for appointments, subscription payment

- [x] **8.1 — LiqPay integration library**
  - **Create:** `src/lib/payments/liqpay.ts`
  - **What:** Helper functions:
    - `createPaymentForm(orderId, amount, currency, description)` → returns { data, signature } for LiqPay checkout
    - `verifyCallback(data, signature)` → validates LiqPay server callback
  - **LiqPay API:** Base64-encode JSON payload, sign with SHA1(private_key + data + private_key)
  - **Docs:** https://www.liqpay.ua/documentation/api/aquiring/checkout

- [x] **8.2 — Prepayment flow**
  - **Modify:** booking confirmation (5.4)
  - **What:** If service requires prepayment:
    1. Create `payments` record (status: 'pending')
    2. Generate LiqPay form data
    3. Show LiqPay checkout button (redirects to LiqPay)
    4. LiqPay callback → update payment status

- [x] **8.3 — LiqPay callback webhook**
  - **Create:** `src/app/api/payments/liqpay/route.ts`
  - **What:** POST endpoint that LiqPay calls after payment.
  - **Logic:**
    1. Verify signature
    2. Find payment by order_id
    3. Update payment status
    4. If successful, confirm appointment (status: 'confirmed')

- [x] **8.4 — Subscription payment flow**
  - **Add to settings:** "Change Plan" section with plan cards + "Subscribe" button
  - **Logic:** Create LiqPay subscription payment → on success, update `subscriptions` table

- [x] **8.5 — Verify Phase 8**
  - Prepayment works with LiqPay sandbox. Callback updates status. Subscription payment flow works.
  - `npm run build` passes
