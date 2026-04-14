# PHASE 5: CLIENT-FACING BOOKING

> Clients browse masters, select services, book appointments

- [x] **5.1 — Master public profile page**
  - **Create:** `src/app/[locale]/(client)/masters/[id]/page.tsx`
  - **What:** Public page showing master info: name, photo, specialization, bio, rating, reviews count. List of active services with prices. "Book" button on each service.
  - **Data:** Read from `masters` JOIN `profiles` JOIN `services` where `is_active = true`
  - **No auth required** to view. Auth required to book.

- [x] **5.2 — Booking flow page**
  - **Modify:** `src/app/[locale]/(client)/book/page.tsx`
  - **What:** Multi-step booking:
    1. **Step 1 — Service** (pre-selected if came from master profile)
    2. **Step 2 — Date** (calendar showing available dates based on master's working hours)
    3. **Step 3 — Time** (grid of available time slots for selected date)
    4. **Step 4 — Confirm** (summary + optional prepayment)
  - **Available slots calculation:**
    ```tsx
    // 1. Get master's working hours for selected weekday
    // 2. Get all appointments for that date
    // 3. Generate time slots (every 30min from start to end minus break)
    // 4. Filter out slots that overlap with existing appointments
    // 5. Filter out slots where remaining time < service duration
    ```
  - **Auto-upsell (Pro tier):** Show upsell checkboxes after service selection

- [x] **5.3 — Available slots API**
  - **Create:** `src/app/api/slots/route.ts`
  - **What:** GET endpoint: `/api/slots?master_id=X&date=YYYY-MM-DD&service_id=Y`
  - **Returns:** Array of available time strings `["09:00", "09:30", "10:00", ...]`
  - **Logic:** Same as 5.2 slot calculation but server-side for accuracy

- [x] **5.4 — Booking confirmation + prepayment**
  - **Create:** `src/components/booking/booking-summary.tsx`
  - **What:** Shows booking summary: service, date, time, price. If prepayment required, show LiqPay button (Phase 8). If no prepayment, just "Confirm" button.
  - **On confirm:**
    1. Insert into `appointments` (status: 'booked')
    2. Create `notifications` record for master (new booking alert)
    3. Create `notifications` record for client (booking confirmation)
    4. If client came via referral, track in `referrals` table

- [x] **5.5 — Waitlist (Pro tier)**
  - **Create:** `src/components/booking/waitlist-button.tsx`
  - **What:** If no slots available for desired date, show "Join Waitlist" button. Inserts into `waitlist` table.
  - **Gated by:** master must have Pro+ tier

- [x] **5.6 — Client booking history**
  - **Modify:** `src/app/[locale]/(client)/history/page.tsx`
  - **What:** List of all client's past and future appointments. Each shows: master name, service, date/time, status, price. "Repeat" button on completed ones.
  - **Data:** `appointments` WHERE `client_id IN (clients WHERE profile_id = current_user)`

- [x] **5.7 — Repeat booking (template)**
  - **Logic:** "Repeat" button on past appointment → navigates to booking flow with pre-filled master_id + service_id. Client only picks new date/time. Same flow as 5.2 but with pre-selection.

- [x] **5.8 — Verify Phase 5**
  - Client can browse masters, select service, pick date/time, book. History shows bookings. Repeat works.
  - `npm run build` passes
