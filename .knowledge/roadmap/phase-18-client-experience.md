# PHASE 18: CLIENT EXPERIENCE FEATURES

> Family accounts, client calendar, birthday greetings, before/after slider, cancellation policy, tips

- [x] **18.1 — Client unified calendar view**
  - **Create:** `src/app/[locale]/(client)/calendar/page.tsx` (second tab in bottom nav)
  - **What:** Monthly calendar grid. Days with appointments have colored dots (one per master, master's accent color). Tapping a day opens bottom sheet with appointment list. Each appointment card shows: master avatar, service name, time, status badge. "Add to phone calendar" button (generates .ics file).
  - **Week view toggle:** Strip at top showing current week.
  - **Data:** `appointments` JOIN `clients` WHERE `clients.profile_id = current_user`

- [x] **18.2 — Family accounts**
  - **Create:** `src/app/[locale]/(client)/profile/family/page.tsx`
  - **Migration:** `supabase/migrations/00005_family.sql`:
    ```sql
    create table family_links (
      id uuid primary key default gen_random_uuid(),
      parent_profile_id uuid references profiles(id) on delete cascade,
      member_name text not null,
      relationship text not null default 'child',
      linked_profile_id uuid references profiles(id),
      created_at timestamptz not null default now()
    );
    ```
  - **What:** "My Family" section. Add members (name + relationship). When booking, step 0: "Booking for: Me | [member name]". Appointment stores `family_member_id`. Notifications go to parent's Telegram. Family members without own account → separate `clients` rows linked to parent `profile_id`. If member creates own account later, link via `linked_profile_id`.
  - **Gated by:** Pro+ tier

- [x] **18.3 — Before/After photo slider**
  - **Create:** `src/components/client-card/before-after-slider.tsx`
  - **What:** Two photos side by side with draggable vertical divider. Left = "before", right = "after". One container, two absolutely positioned `<img>`, right image clipped with `clip-path: inset(0 0 0 ${percentage}%)` controlled by pointer/touch events. No extra library.
  - **Also:** Master can post before/after as feed_post (type: 'before_after').
  - **Gated by:** Business tier

- [x] **18.4 — Birthday greetings cron**
  - **Create:** `src/app/api/cron/birthdays/route.ts`
  - **What:** Daily (08:00). Query `clients.date_of_birth` and `profiles.date_of_birth` where month+day = today.
    - Client birthday → master gets notification "Today is {client}'s birthday!" + auto-send if master enabled. Client gets greeting with optional discount code.
    - Master birthday → platform sends greeting to master's Telegram.
  - **Settings:** `birthday_auto_greet: boolean`, `birthday_discount_percent: number (0-50)`

- [x] **18.5 — Configurable cancellation policy**
  - **Migration:** Add columns to `masters`:
    ```sql
    alter table masters add column cancellation_policy jsonb default '{"free_hours": 24, "partial_hours": 12, "partial_percent": 50}';
    ```
  - **What:** Master configures free window, partial refund window + percentage, no refund window. Client sees policy at booking.
    - `> free_hours` before → full refund
    - Between `partial_hours` and `free_hours` → partial refund (e.g., 50%)
    - `< partial_hours` → no refund, counts as cancellation
  - **UI:** "Free cancellation until {datetime}. After that, {percent}% fee applies."

- [x] **18.6 — Digital tips**
  - **Create:** `src/components/shared/tip-prompt.tsx`
  - **What:** After appointment 'completed', client sees: "How was your visit? Leave a tip for {master}!" Quick buttons: 5% / 10% / 15% / custom. Payment via LiqPay. Recorded in `payments` with `type = 'tip'`. Master sees tips separately in finance. Can be disabled in settings.
  - **Migration:** Add `'tip'` to payments type check constraint.

- [x] **18.7 — Verify Phase 18**
  - Client calendar shows all masters' appointments. Family booking works end-to-end. Before/After slider smooth. Birthday cron runs. Cancellation policy enforced. Tips process via LiqPay.
  - `npm run build` passes
