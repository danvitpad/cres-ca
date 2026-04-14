# PHASE 6: MAP + MASTER SEARCH

> OpenStreetMap integration, geolocation, master search

- [x] **6.1 — Leaflet map component (dynamic import)**
  - **Create:** `src/components/shared/map-view.tsx`
  - **What:** Leaflet map wrapped in `dynamic(() => import(...), { ssr: false })` because Leaflet doesn't support SSR.
  - **Props:** `markers: Array<{ lat, lng, name, rating, masterId }>`, `center`, `zoom`
  - **Important:** Must import Leaflet CSS: `import 'leaflet/dist/leaflet.css'`

- [x] **6.2 — Map page with nearby masters**
  - **Modify:** `src/app/[locale]/(client)/map/page.tsx`
  - **What:**
    1. Request user's geolocation via `navigator.geolocation`
    2. Fetch masters within radius from Supabase (use `latitude`/`longitude` columns)
    3. Show markers on map with popups (name, rating, specialization, "View" link)
  - **Supabase geo query:**
    ```sql
    SELECT * FROM masters
    WHERE latitude BETWEEN $1 AND $2
    AND longitude BETWEEN $3 AND $4
    AND is_active = true
    ```

- [x] **6.3 — Master search page**
  - **Modify:** `src/app/[locale]/(client)/masters/page.tsx`
  - **What:** Search input (by name, phone, or invite code) + results list as cards.
  - **Each card:** Avatar, name, specialization, rating stars, city, distance (if geo available), "View" button

- [x] **6.4 — Verify Phase 6**
  - Map shows markers, geolocation works, search finds masters.
  - `npm run build` passes
