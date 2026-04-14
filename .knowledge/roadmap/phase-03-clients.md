# PHASE 3: CLIENT MANAGEMENT

> Client cards, search, allergies, notes, behavior indicators

- [x] **3.1 — Client list with search and pagination**
  - **Modify:** `src/app/[locale]/(dashboard)/clients/page.tsx`
  - **What:** Table of clients with columns: name, phone, total visits, avg check, last visit, rating
  - **Search:** Filter by name or phone (client-side filter for <100 clients, Supabase `ilike` for more)
  - **Pagination:** Load 20 at a time, "Load more" button
  - **Data:** `clients` table where `master_id = currentMasterId`
  - **"Add Client" button** opens a dialog with form: full_name, phone, email, date_of_birth, notes

- [x] **3.2 — Client card detail page**
  - **Create:** `src/app/[locale]/(dashboard)/clients/[id]/page.tsx`
  - **What:** Full client card with tabs:
    - **Info:** Name, phone, email, DOB, rating, behavior indicators (icons), referral code
    - **History:** List of past appointments (date, service, price, status) with "Repeat" button
    - **Notes:** Editable text area for freeform notes
    - **Health:** Allergies (tag input), contraindications (tag input), `has_health_alert` toggle
    - **Files:** (Business tier only) Upload/view photos and PDFs. Before/After pairing.
  - **Repeat booking button:** Clicking creates a new appointment pre-filled with same client + service + duration. User only picks date/time.
  - **Data:** Read from `clients` + `appointments` + `client_files` tables

- [x] **3.3 — Tag input component for allergies**
  - **Create:** `src/components/shared/tag-input.tsx`
  - **What:** A text input where you type and press Enter to add tags. Tags appear as removable badges. Returns `string[]`.
  - **Usage:** For allergies and contraindications on client card.

- [x] **3.4 — Behavior indicator icons**
  - **Create:** `src/components/shared/behavior-indicators.tsx`
  - **What:** Shows small icons next to client name (visible only to masters with Business tier):
    - `frequent_canceller` → red X icon with tooltip "Often cancels"
    - `often_late` → orange clock icon with tooltip "Often late"
    - `rude` → red warning icon with tooltip "Difficult client"
    - `excellent` → green star icon with tooltip "Excellent client"
  - **Gated by:** `canUse('behavior_indicators')`

- [x] **3.5 — Health alert indicator on calendar**
  - **What:** If a client has `has_health_alert = true`, show a red exclamation mark on their appointment in the calendar (implemented in Phase 4)
  - **For now:** Just ensure the client card correctly saves `has_health_alert` when allergies/contraindications are not empty

- [x] **3.6 — File upload for client card (Business tier)**
  - **Create:** `src/components/client-card/file-upload.tsx`
  - **What:** Upload photos/PDFs to Supabase Storage. Save reference in `client_files` table.
  - **Gated by:** `canUse('file_storage')`
  - **Storage bucket:** `client-files` (create in Supabase dashboard)
  - **Pattern:**
    ```tsx
    const { data, error } = await supabase.storage
      .from('client-files')
      .upload(`${clientId}/${Date.now()}_${file.name}`, file);
    ```

- [x] **3.7 — Verify Phase 3**
  - Can add/edit/search clients. Client card shows all tabs. Allergies save. Files upload (Business).
  - `npm run build` passes
