# PHASE 15: CONSENT FORMS & DIGITAL SIGNATURES

> Digital consent before procedures

- [x] **15.1 — Consent form template**
  - **Create:** `src/components/shared/consent-form.tsx`
  - **What:** Auto-generated consent text based on: service name, client's allergies, risk description. Client checks a checkbox to agree.
  - **Save to:** `consent_forms` table with timestamp and client_ip.

- [x] **15.2 — Consent in booking flow**
  - **Modify:** booking confirmation (5.4)
  - **What:** If service requires consent (flag on service), show consent form before confirming.
  - **Gated by:** Pro+ tier

- [x] **15.3 — Verify Phase 15**
  - Consent form shows, client agrees, record saved in DB.
  - `npm run build` passes
