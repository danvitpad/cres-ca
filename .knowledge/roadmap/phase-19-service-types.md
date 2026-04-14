# PHASE 19: SERVICE TYPE ENHANCEMENTS

> Recurring bookings, live queue, group bookings, packages, mobile masters, price variations

- [x] **19.1 — Recurring bookings**
  - **Migration:** `supabase/migrations/00006_recurring.sql`:
    ```sql
    create table recurring_bookings (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      master_id uuid references masters(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      interval_days int not null,
      preferred_day_of_week int,
      preferred_time time,
      next_booking_date date not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    ```
  - **Create:** `src/components/booking/recurring-toggle.tsx`
  - **What:** After completing a booking: "Make this recurring? Every [1 week / 2 weeks / 3 weeks / month]". Auto-creates next appointment. If slot taken, notifies: "Your usual Thursday 14:00 is taken. Nearest: Thursday 15:00. Confirm?" Shown with "repeat" icon overlay.
  - **Cron:** `src/app/api/cron/recurring/route.ts` — daily.

- [x] **19.2 — Live queue (walk-in mode)**
  - **Migration:** `supabase/migrations/00007_queue.sql`:
    ```sql
    create table queue_entries (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      client_id uuid references clients(id),
      client_name text,
      service_id uuid references services(id),
      position int not null,
      status text not null default 'waiting' check (status in ('waiting', 'in_service', 'completed', 'cancelled', 'no_show')),
      estimated_start timestamptz,
      joined_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz
    );
    ```
  - **Create:** `src/app/[locale]/(dashboard)/queue/page.tsx` — Master view: list of queued clients, "Next" button, timer. "Add walk-in" button.
  - **Create:** `src/components/shared/queue-status.tsx` — Client view: "You are #4. Est. wait: ~35 min". Push when "You're next!"
  - **Master setting:** `queue_mode: boolean` — enables queue tab, hides calendar-based booking.

- [x] **19.3 — Group bookings**
  - **Migration:** `supabase/migrations/00008_groups.sql`:
    ```sql
    alter table services add column is_group boolean not null default false;
    alter table services add column max_participants int default 1;
    alter table services add column min_participants int default 1;
    alter table appointments add column group_session_id uuid;
    create table group_sessions (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      max_participants int not null,
      current_participants int not null default 0,
      status text not null default 'open' check (status in ('open', 'full', 'confirmed', 'cancelled', 'completed')),
      min_participants int not null default 1,
      auto_cancel_if_below_min boolean not null default true,
      created_at timestamptz not null default now()
    );
    ```
  - **What:** Master creates group service (yoga, workshop, group training) with max/min participants. Clients see "3/10 spots remaining" and book individual slots. If below min 24h before start → auto-cancel + notify. Each participant has own `appointments` row via `group_session_id`.

- [x] **19.4 — Service packages / Subscriptions**
  - **Migration:** `supabase/migrations/00009_packages.sql`:
    ```sql
    create table service_packages (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null,
      description text,
      service_id uuid references services(id) on delete cascade,
      total_visits int not null,
      bonus_visits int not null default 0,
      price numeric(10,2) not null,
      currency text not null default 'UAH',
      validity_days int not null default 90,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table client_packages (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      package_id uuid references service_packages(id) on delete cascade,
      visits_remaining int not null,
      purchased_at timestamptz not null default now(),
      expires_at timestamptz not null,
      payment_id uuid references payments(id)
    );
    ```
  - **What:** "10 massages for price of 9". Client buys → `client_packages` created. On each booking, visits_remaining decremented. Notify 7 days before expiry. Master sees "Package: 6/10 remaining, expires 15.06".
  - **Gated by:** Pro+ tier

- [x] **19.5 — Mobile master (on-site visits)**
  - **Migration:** Add columns:
    ```sql
    alter table masters add column is_mobile boolean not null default false;
    alter table masters add column service_radius_km int default 15;
    alter table masters add column travel_fee_fixed numeric(10,2) default 0;
    alter table masters add column travel_fee_per_km numeric(10,2) default 0;
    alter table appointments add column client_address text;
    alter table appointments add column client_lat double precision;
    alter table appointments add column client_lng double precision;
    alter table appointments add column travel_time_minutes int;
    ```
  - **What:** Master marks "I travel to clients". Sets radius + travel fee. Client enters address → geocode via OpenStreetMap Nominatim (free). Calculate distance, add travel fee, block travel time before/after. Master sees address with "Open in Maps" link.

- [x] **19.6 — Price variations per service**
  - **Migration:**
    ```sql
    create table service_variations (
      id uuid primary key default gen_random_uuid(),
      service_id uuid references services(id) on delete cascade,
      name text not null,
      price numeric(10,2) not null,
      duration_minutes int not null,
      sort_order int not null default 0
    );
    ```
  - **What:** "Haircut → Short hair 300₴/30min | Long hair 500₴/45min". Client picks variation → price/duration auto-fill. If variations exist, base price hidden.

- [x] **19.7 — Verify Phase 19**
  - Recurring bookings auto-create. Queue works for walk-in masters. Group sessions manage participants. Packages track visits. Mobile masters show radius + travel fee. Price variations change booking flow.
  - `npm run build` passes
