# PHASE 20: ADVANCED MARKETING & ANALYTICS

> Shared blacklist, top masters, burning slots, lost revenue AI, product storefront

- [x] **20.1 — Cross-platform client blacklist**
  - **Create:** `src/app/api/blacklist/check/route.ts`
  - **What:** On booking creation, server-side: aggregate `cancellation_count + no_show_count` across ALL `clients` rows with same `profile_id`. If total >= 3 in last 30 days → warning notification for master: "This client has cancelled/no-showed 3 times recently across the platform." Never reveal which masters or services — only aggregate count.
  - **Privacy:** Runs via server-side RPC function (service role), not exposed to client.

- [x] **20.2 — Top masters ranking**
  - **Create:** `src/components/shared/top-masters-row.tsx`
  - **What:** Horizontal scrollable row of circular avatars with gradient ring. Sorted by `rating * ln(review_count + 1)`. Gold gradient for top 3, accent for rest. No ring if no reviews.
  - **Placement:** Top of client Feed + Masters search + Map page.
  - **Data:** `masters` JOIN `profiles` WHERE `is_active = true AND rating >= 4.0` ORDER BY formula LIMIT 20.

- [x] **20.3 — "Burning slots" auto-promotions**
  - **Create:** `src/app/api/cron/burning-slots/route.ts`
  - **What:** Daily (20:00). For each master with Pro+:
    1. Calculate empty slots for next 24h
    2. If empty > 30% → create feed_post (type: 'burning_slot') with discount
    3. Push to followers: "Flash deal: {service} tomorrow at {time} with {discount}% off!"
    4. Temporary discount auto-expires after slot time passes
  - **Settings:** `burning_slots_enabled`, `burning_slots_discount (5-50)`, `burning_slots_auto`
  - **Gated by:** Pro+ tier

- [x] **20.4 — AI "Lost Revenue" analytics**
  - **Create:** `src/components/shared/lost-revenue-card.tsx` + `src/app/api/ai/lost-revenue/route.ts`
  - **What:** Weekly cron generates insights, Business tier only. Shows 2-3 actionable insights:
    - Schedule gaps: "80% bookings are Sat-Sun, Mondays 90% empty. Try a Monday discount."
    - Dormant clients: "5 regular clients haven't visited in 2x their usual interval. Reach out?"
    - Price optimization: "Avg check dropped 12% since adding budget services."
    - Upsell missed: "Only 8% of clients add upsell services. Top masters achieve 25%."
  - **Implementation:** Aggregate data → OpenRouter AI → structured JSON → cards with "Take Action" buttons.
  - **Gated by:** Business tier

- [x] **20.5 — Product storefront**
  - **Migration:** `supabase/migrations/00010_products.sql`:
    ```sql
    create table products (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null,
      description text,
      price numeric(10,2) not null,
      currency text not null default 'UAH',
      image_url text,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table product_recommendations (
      id uuid primary key default gen_random_uuid(),
      product_id uuid references products(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      message_template text
    );
    create table product_orders (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      product_id uuid references products(id) on delete cascade,
      quantity int not null default 1,
      total_price numeric(10,2) not null,
      payment_id uuid references payments(id),
      status text not null default 'pending' check (status in ('pending', 'paid', 'delivered', 'cancelled')),
      created_at timestamptz not null default now()
    );
    ```
  - **Master side:** `src/app/[locale]/(dashboard)/marketing/products/page.tsx` — CRUD. Link products to services.
  - **Client side:** `src/app/[locale]/(client)/shop/page.tsx` — Browse products from followed masters. Payment via LiqPay.
  - **Auto-recommendation:** After visit (12.4 cron), include product link in recommendation.
  - **Feed integration:** Auto-create feed_post (type: 'new_product') when master adds product.
  - **Gated by:** Pro+ tier with `storefront` feature flag

- [x] **20.6 — Verify Phase 20**
  - Blacklist warns on booking. Top masters row shows on feed/search/map. Burning slots auto-publish. AI insights generate weekly. Product shop works end-to-end.
  - `npm run build` passes
