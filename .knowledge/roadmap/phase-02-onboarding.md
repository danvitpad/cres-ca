# PHASE 2: MASTER ONBOARDING + SERVICE CATALOG

> Masters configure their profile, working hours, and services

- [x] **2.1 — Master profile form**
  - **Modify:** `src/app/[locale]/(dashboard)/settings/page.tsx`
  - **What:** Form to edit master profile: specialization, bio, address, city, working hours (JSON editor or day-by-day picker), avatar upload.
  - **Data flow:** Read from `masters` table JOIN `profiles`. Save to both tables.
  - **Working hours format:**
    ```json
    {
      "monday": { "start": "09:00", "end": "18:00", "break_start": "13:00", "break_end": "14:00" },
      "tuesday": { "start": "09:00", "end": "18:00" },
      "wednesday": null,
      "thursday": { "start": "10:00", "end": "20:00" },
      "friday": { "start": "09:00", "end": "17:00" },
      "saturday": { "start": "10:00", "end": "15:00" },
      "sunday": null
    }
    ```
  - **UI:** Tabs component — "Profile", "Working Hours", "Subscription", "Team" (if salon)

- [x] **2.2 — Service management CRUD**
  - **Modify:** `src/app/[locale]/(dashboard)/services/page.tsx`
  - **What:** Full CRUD for services:
    - List all services in a table/card grid
    - "Add Service" button opens Dialog with form: name, category, duration (minutes), price, currency, color, prepayment toggle
    - Edit/delete buttons on each service
    - Service categories: create inline or from dropdown
  - **Data flow:** Insert/update/delete in `services` table filtered by current master's `master_id`
  - **Validation (Zod):**
    ```tsx
    const serviceSchema = z.object({
      name: z.string().min(1),
      duration_minutes: z.number().int().min(5).max(480),
      price: z.number().min(0),
      currency: z.string().default('UAH'),
      category_id: z.string().uuid().optional(),
      requires_prepayment: z.boolean().default(false),
      prepayment_amount: z.number().min(0).default(0),
    });
    ```

- [x] **2.3 — Service categories**
  - **Create:** `src/components/shared/category-manager.tsx`
  - **What:** A small component for creating/editing service categories (name + color). Used inside the services page.
  - **Data:** `service_categories` table

- [x] **2.4 — Invite link generation**
  - **Add to settings page:** Show master's invite link: `https://cres-ca.com/invite/{invite_code}`
  - **Also show:** Telegram deep link: `https://t.me/{BOT_USERNAME}?start=master_{invite_code}`
  - **Copy button** using navigator.clipboard
  - **Data:** Read `invite_code` from `masters` table

- [x] **2.5 — Verify Phase 2**
  - Master can log in, see settings, edit profile, add/edit/delete services, see invite link
  - `npm run build` passes
