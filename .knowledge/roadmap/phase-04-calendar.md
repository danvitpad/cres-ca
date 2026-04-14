# PHASE 4: CALENDAR & APPOINTMENTS

> Visual calendar, booking, drag-and-drop, status management

- [x] **4.1 — Calendar data fetching hook**
  - **Create:** `src/hooks/use-appointments.ts`
  - **What:** Custom hook that fetches appointments for a given date range from Supabase.
  - **Pattern:**
    ```tsx
    export function useAppointments(masterId: string, startDate: Date, endDate: Date) {
      // Fetch from 'appointments' table with JOIN on clients and services
      // Return { appointments, isLoading, refetch }
    }
    ```

- [x] **4.2 — Day view calendar component**
  - **Create:** `src/components/calendar/day-view.tsx`
  - **What:** A vertical timeline from working hours start to end. Each appointment is a colored block showing:
    - Client name
    - Service name
    - Time (start-end)
    - Status badge (color-coded)
    - Red exclamation if client has health alert
  - **Time slots:** 30-minute grid lines
  - **Color coding:** Use service color from `services.color`
  - **Empty slots:** Shown as clickable areas → clicking opens "New Appointment" dialog

- [x] **4.3 — Week view calendar component**
  - **Create:** `src/components/calendar/week-view.tsx`
  - **What:** 7-column grid (Mon-Sun). Each column is a mini day-view. Appointments shown as compact blocks.
  - **Responsive:** On mobile, show horizontal scrollable view

- [x] **4.4 — Calendar page integration**
  - **Modify:** `src/app/[locale]/(dashboard)/calendar/page.tsx`
  - **What:** Replace stub with:
    - Day/Week toggle tabs
    - Date navigation (prev/next day/week, "Today" button)
    - DayView or WeekView component based on selected tab
    - "New Appointment" floating action button (mobile) or header button

- [x] **4.5 — New appointment dialog**
  - **Create:** `src/components/calendar/new-appointment-dialog.tsx`
  - **What:** Dialog/Sheet with form:
    1. Select client (searchable combobox from client list) OR "New Client" inline
    2. Select service (dropdown — auto-fills duration and price)
    3. Select date (calendar picker)
    4. Select time (time picker — only show available slots based on working hours and existing appointments)
    5. Notes (optional textarea)
    6. Confirm button → inserts into `appointments` table
  - **Auto-upsell (Pro tier):** After selecting a service, show upsell suggestions from `services.upsell_services[]` as checkboxes: "Add SPA care +15min +$X?"
  - **Equipment check (Business tier):** If service requires equipment, check `equipment` table for availability at selected time

- [x] **4.6 — Appointment status management**
  - **Create:** `src/components/calendar/appointment-actions.tsx`
  - **What:** Clicking an appointment in the calendar opens a popover/sheet with:
    - Client name + phone (clickable to open client card)
    - Service details
    - Status dropdown: booked → confirmed → in_progress → completed
    - Cancel button (sets status to 'cancelled', increments client's `cancellation_count`)
    - No-show button (sets status to 'no_show', increments `no_show_count`)
    - "Repeat" button → opens new appointment dialog pre-filled with same client+service
  - **On completion:** Update client stats (total_visits++, total_spent += price, recalc avg_check, last_visit_at)
  - **On completion + inventory (Pro tier):** If service has `inventory_recipe`, auto-deduct from `inventory_items`

- [x] **4.7 — Drag-and-drop rescheduling**
  - **Modify:** `src/components/calendar/day-view.tsx`
  - **What:** Appointments can be dragged to different time slots. On drop, update `starts_at` and `ends_at` in DB.
  - **Implementation:** Use mouse/touch events (no extra library). Track drag start position, show ghost element, calculate new time on drop.
  - **Constraints:** Cannot overlap with other appointments. Cannot exceed working hours. Snap to 15-minute grid.

- [x] **4.8 — Verify Phase 4**
  - Calendar shows appointments. Can create/edit/cancel. Day and week views work. Status transitions work. Drag-drop works.
  - `npm run build` passes
