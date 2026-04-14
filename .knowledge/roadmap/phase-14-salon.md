# PHASE 14: SALON MODE

> Multi-master management, roles, equipment sharing

- [x] **14.1 — Team management page**
  - **Create:** `src/app/[locale]/(dashboard)/settings/team/page.tsx`
  - **What:** Salon admin can: invite masters (via email or invite link), see team list, remove masters.
  - **Logic:** Insert into `masters` with salon_id. New master gets notification.
  - **Visible only if:** current user role is `salon_admin`

- [x] **14.2 — Equipment management (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/settings/equipment/page.tsx`
  - **What:** CRUD for shared equipment. Track resource usage (laser pulses, lamp hours).
  - **Alert:** When `used_resource > maintenance_threshold`, show warning notification.
  - **Booking conflict:** When creating appointment, check equipment availability at selected time.

- [x] **14.3 — Salon-wide analytics**
  - **Modify:** finance page
  - **What:** For salon_admin, show aggregate stats across all masters. Filter by master dropdown.

- [x] **14.4 — Verify Phase 14**
  - Salon admin can manage team. Equipment tracks resources. Analytics aggregate.
  - `npm run build` passes
