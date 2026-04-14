# PHASE 11: MARKETING FEATURES

> Referrals, reviews, waitlist notifications, auto-upsell

- [x] **11.1 — Referral system (Pro tier)**
  - **Modify:** `src/app/[locale]/(client)/profile/page.tsx`
  - **What:** Show client's referral link + code. When someone registers with this link, both get bonus points.
  - **Track:** In `referrals` table. Update `referral_bonus_points` on both client records.
  - **Gated by:** master must have Pro+ tier

- [x] **11.2 — Review collection (after visit)**
  - **Create:** `src/app/api/cron/reviews/route.ts`
  - **What:** 2 hours after appointment completes, create notification asking client to rate (1-5 stars). If rating < 4, mark `is_published = false` and notify master privately.
  - **Create:** `src/components/shared/rating-stars.tsx` — reusable star rating component (1-5)

- [x] **11.3 — Waitlist notification on cancellation**
  - **Modify:** appointment cancellation logic (4.6)
  - **What:** When appointment is cancelled, check `waitlist` for matching master + date. Notify first matching client.

- [x] **11.4 — Gift certificates (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/certificates/page.tsx`
  - **What:** Master can create gift certificates (amount, expiry). Generates unique code. Client can buy and share via Telegram.
  - **Gated by:** Business tier

- [x] **11.5 — Cross-marketing / Guilds (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/guilds/page.tsx`
  - **What:** Master can create a guild, invite other masters. When guild member recommends a client, both get bonus.
  - **Gated by:** Business tier

- [x] **11.6 — Verify Phase 11**
  - Referral links work. Reviews collect. Waitlist notifies. Certificates generate.
  - `npm run build` passes
