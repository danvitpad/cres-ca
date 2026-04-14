# PHASE 22: PLATFORM INFRASTRUCTURE

> Calendar sync, web push, QR codes, auto-translation, multi-location

- [x] **22.1 — Google Calendar sync (one-way export)**
  - **Create:** `src/lib/calendar/ics.ts`
  - **What:** Generate .ics file for any appointment. "Add to Calendar" button on booking confirmation and appointment detail.
  - **Format:**
    ```
    BEGIN:VCALENDAR
    VERSION:2.0
    BEGIN:VEVENT
    DTSTART:20260415T140000
    DTEND:20260415T160000
    SUMMARY:Manicure - Master Anna
    LOCATION:Salon Address
    DESCRIPTION:Service details...
    END:VEVENT
    END:VCALENDAR
    ```
  - **Subscription feed:** `src/app/api/calendar/[userId]/feed.ics/route.ts` — all future appointments as .ics feed. User subscribes in Google Calendar → auto-syncs. Read-only.

- [x] **22.2 — Web Push notifications**
  - **Create:** `src/lib/notifications/web-push.ts`
  - **What:** For users on web (not Telegram). Service Worker registers push subscription. Server sends via Web Push API (`web-push` npm with VAPID keys).
  - **Create:** `public/sw.js` — Service Worker.
  - **Create:** `src/components/shared/push-permission.tsx` — "Enable notifications" prompt.
  - **Migration:** Add `push_subscription` JSONB to `profiles`.
  - **Notification sender (9.3) updated:** Telegram first, then Web Push, then email (Resend) fallback.
  - **Install:** `npm install web-push` + generate VAPID keys.

- [x] **22.3 — QR code for instant booking**
  - **Create:** `src/components/shared/qr-code.tsx`
  - **What:** Generate SVG QR code (no external API). Encodes master's booking URL. Master views in settings, downloads PNG, shares via Telegram.
  - **Also:** QR for specific service pre-selected.
  - **Install:** `npm install qrcode`

- [x] **22.4 — Auto-translation of service descriptions**
  - **What:** Master writes in their language. Client viewing in different locale → auto-translate via OpenRouter AI. Cached in DB.
  - **Migration:**
    ```sql
    create table translations_cache (
      id uuid primary key default gen_random_uuid(),
      source_table text not null,
      source_id uuid not null,
      source_field text not null,
      target_locale text not null,
      translated_text text not null,
      created_at timestamptz not null default now(),
      unique(source_table, source_id, source_field, target_locale)
    );
    ```
  - **Logic:** Check cache → if miss, call AI → store → return. Master can manually edit translations.
  - **Gated by:** Business tier (AI costs)

- [x] **22.5 — Multi-location for masters**
  - **Migration:**
    ```sql
    create table master_locations (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null,
      address text not null,
      city text,
      latitude double precision,
      longitude double precision,
      working_hours jsonb,
      is_default boolean not null default false,
      created_at timestamptz not null default now()
    );
    ```
  - **What:** Master adds each location with own address + working hours. Calendar shows which location each day. Booking flow shows "Location: [dropdown]" if multiple. Map shows each location as separate marker. Default location used when only one (backward compat with current `address` field).
  - **Gated by:** Pro+ tier

- [x] **22.6 — Verify Phase 22**
  - .ics download works. Calendar feed syncs to Google Calendar. Web Push arrives in browser. QR codes scan correctly. Auto-translations cache and display. Multi-location shows in booking and map.
  - `npm run build` passes
