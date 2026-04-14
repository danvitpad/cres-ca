---
name: full-clone
description: Create a complete working clone of any website — not just visual, but fully functional with forms, API endpoints, database, authentication, all pages (including dashboards and auth-protected areas), all interactive elements (dropdowns, modals, animations, carousels). The user can authenticate on the target site to give browser access to protected pages. Use when the user wants a "real clone", "working copy", "functional replica", or says they need forms, APIs, database, dashboards cloned. Provide target URL(s) as arguments.
argument-hint: "<url> [--auth] [--pages /path1,/path2] [--roles client,pro,team] [--skip-db] [--visual-only]"
user-invocable: true
---

# Full Website Clone — Pixel-Perfect & Functional

You are about to create a **complete, pixel-perfect functional clone** of `$ARGUMENTS`.

This is NOT a visual mockup. This is a working application where every form submits, every button works, every animation plays, and the design is an exact 1:1 copy.

## AUTONOMOUS MODE

**This skill runs with ZERO user involvement.** You are an obsessive, maniacal machine that will explore, click, extract, and replicate EVERYTHING without asking the user for permission, guidance, or confirmation.

The ONLY time you stop and wait for the user:
- **Authentication walls** — CAPTCHA, email verification, SMS codes, OAuth that requires real credentials. Navigate to the login/signup page, tell the user "Please log in / verify / enter the code — I'll wait," and resume the moment you detect the session is active.
- **Payment walls** — if a feature requires a paid plan, inform the user and skip that section.

Everything else — you do yourself. No questions. No "should I...?" No "would you like me to...?" Just do it.

**Registration:** Fill forms with random realistic data yourself (random name, random email like `testclone-{random}@test.com`, random phone, password `TestClone123!`). If the site rejects your data (real email required, phone verification), THEN ask the user to register manually. Otherwise, register every role yourself.

**Time:** Take as long as needed. This is not a quick task. A complex SaaS site may take hours of extraction. That's fine. Thoroughness over speed. Never cut corners to save time.

## Core Principles

1. **Visual extraction FIRST, build SECOND.** Never write a single line of code until you have exact computed CSS values, downloaded assets, and screenshots for reference.
2. **Inline styles with real values.** Use exact `getComputedStyle()` values — never approximate. `padding: 14px 18px` not `p-4`. Tailwind utilities only where they match exactly.
3. **Component-level extraction.** Don't just screenshot pages — extract each component's DOM tree with computed styles down to 4 levels deep.
4. **OBSESSIVE clicking.** You have a maniacal desire to click EVERY SINGLE THING on the site. Every button, every sub-button, every submenu item, every sidebar link, every icon, every dropdown option, every calendar cell, every table row, every notification bell, every settings toggle, every "..." menu. If it's clickable, you click it. If clicking it opens something, you click everything inside THAT too. Recursively. Until there is nothing left to click. A page is NOT "extracted" until you have clicked every interactive element and recorded what happened.
5. **Multi-role obsession.** If the site has 3 roles, you explore ALL 3. You register for each, log into each, and do the full obsessive click-through for each. Different roles see different sidebars, different dashboards, different menus — you capture EVERY difference.
6. **Map user flows, not just pages.** Features are multi-step sequences (click slot → modal → form → submit → result). Extract and build flows end-to-end, not page by page.
7. **Screenshot-driven QA.** After building each page, take a screenshot and compare side-by-side with the original. Fix differences immediately, don't accumulate.
8. **Assets are local.** Download every font, image, SVG, icon. No external CDN links in the clone.
9. **Sidebar-first exploration.** When you land on a logged-in dashboard: start with the sidebar/navigation. Click EVERY item. For each item that has sub-items or expandable sections, expand them ALL. Screenshot each destination page. Then go deep into each page. This is how you discover the full scope of the app.

## Pre-Flight

1. **Browser automation is required.** Check for Playwright MCP, Chrome DevTools MCP, or similar. If none available, tell the user to set one up.

2. **Verify the target URL** is accessible. Navigate to the site.

3. **Determine the output stack** based on what's in the current project. Default:
   - **Frontend:** Next.js App Router + TypeScript + Tailwind CSS
   - **Backend:** Next.js API routes
   - **Database:** Supabase (PostgreSQL) — use Supabase MCP if available
   - **Auth:** Supabase Auth or NextAuth.js
   - If there's already a project scaffolded in the working directory, use that stack.
   - Don't ask — just use what makes sense.

4. **Discover ALL roles/personas** — do this YOURSELF, don't ask the user:
   - Navigate to signup page, look for role selector or different signup paths
   - Check pricing page for tier-based roles
   - Check for different signup URLs (/signup/client, /signup/pro, /signup/business)
   - Run the Role Discovery script from `references/multi-role-extraction.md`
   - If `--roles` flag was passed, use only those. Otherwise clone ALL discovered roles.
   - **Inform the user** (don't ask): "Found X roles: [list]. Cloning all of them."

5. **Self-register for each role:**
   - For each role, open a clean browser context (incognito / new session)
   - Navigate to the signup page for that role
   - Fill ALL fields with random realistic data:
     - Name: random realistic name
     - Email: `testclone-{role}-{random4digits}@test.com`
     - Phone: random valid-format phone
     - Password: `CloneTest123!`
     - Business name (if needed): `Test Business {random}`
     - Any other fields: fill with plausible data
   - Submit the form
   - **IF blocked** (CAPTCHA, real email verification, SMS code, OAuth-only):
     - Tell the user: "I can't register as {role} automatically — [reason]. Please register at {URL} and log in. I'll wait."
     - Wait for the user to confirm, then detect the active session and continue
   - **IF registration succeeds:** proceed through onboarding wizard automatically, clicking "Next" / "Skip" / filling required fields with random data
   - Screenshot each step of registration and onboarding for reference
   - Save session/cookies for this role for later use

6. **For pre-login pages** (landing, pricing, features, blog, etc.) — extract these first, before any login. No auth needed, just navigate and extract.

5. **Create output directories:**
   ```
   docs/clone-research/
   docs/clone-research/pages/
   docs/clone-research/api/
   docs/clone-research/components/
   docs/clone-research/screenshots/original/
   docs/clone-research/screenshots/clone/
   docs/clone-research/assets/
   docs/clone-research/flows/
   docs/clone-research/roles/          # if multi-role
   docs/clone-research/roles/{role}/   # per-role extraction data
   scripts/
   ```

---

## Phase 1: Deep Extraction (The Most Critical Phase)

This phase determines clone quality. Spend most of your time here. Run all sub-steps per page.

### 1A: Sitemap Discovery

Crawl and map every reachable page:

1. Check `/sitemap.xml`, `/robots.txt`
2. Navigate to home page via browser MCP
3. Extract ALL internal links:
   ```javascript
   JSON.stringify([...new Set(
     [...document.querySelectorAll('a[href]')]
       .map(a => new URL(a.href, location.origin).pathname)
       .filter(p => p.startsWith('/'))
   )].sort());
   ```
4. Check navigation menus, sidebars, footers, mobile menus
5. If authenticated, explore dashboard/settings/profile areas
6. Build a complete page tree and save to `docs/clone-research/SITEMAP.md`

### 1B: Design System Extraction (Run Once)

Before touching individual pages, extract the global design system. This creates the foundation all pages build on.

1. **Design tokens** — Run the Design Tokens Extraction script from `references/visual-extraction.md`:
   - All colors (with CSS variable names)
   - All font families, sizes, weights
   - All spacing values
   - Border radii, shadows, transitions
   - CSS custom properties from `:root`

2. **Asset download** — Run the asset collection script from `references/asset-pipeline.md`:
   - Download ALL fonts → `public/fonts/`
   - Download ALL images → `public/images/`
   - Extract ALL inline SVGs → `public/svg/`
   - Download ALL icon files → `public/icons/`
   - Download favicon and apple-touch-icons

3. **Font mapping** — Run the Font Family Mapping script from `references/asset-pipeline.md`:
   - Map every font-family → source file
   - Record all weight/style variants used
   - Generate `@font-face` declarations for `globals.css`

4. **Tailwind theme** — Run the Tailwind Theme Generator from `references/asset-pipeline.md`:
   - Map CSS variables → Tailwind theme extensions
   - Generate exact color palette
   - Generate spacing scale

5. **Animation & keyframes** — Run the Animation Keyframes Extraction from `references/visual-extraction.md`:
   - Extract all `@keyframes` definitions
   - Map which elements use which animations
   - Record durations, timing functions, delays

6. **Responsive breakpoints** — Run the Responsive Breakpoints Detection from `references/visual-extraction.md`:
   - Extract all media queries
   - Rank by importance (rule count)

7. Save everything to `docs/clone-research/DESIGN_SYSTEM.md`

### 1C: Per-Page Deep Extraction

For EACH page in the sitemap, do ALL of the following:

#### Screenshots (3 breakpoints)
```
Navigate to page → wait for full load (networkidle)
Screenshot at 1440px → docs/clone-research/screenshots/original/<page>-desktop.png
Screenshot at 768px  → docs/clone-research/screenshots/original/<page>-tablet.png
Screenshot at 390px  → docs/clone-research/screenshots/original/<page>-mobile.png
```

#### Component Tree Extraction
For each visually distinct section (header, hero, sidebar, cards, forms, tables, footer):
1. Run the Per-Component Deep Extraction script from `references/visual-extraction.md`
2. Pass the section's CSS selector
3. Get computed styles 4 levels deep (tag, classes, rect, all CSS values, children)
4. Save to `docs/clone-research/components/<page>-<component>.json`

#### Hover / Focus / Active States
Run the Hover/Focus/Active State Capture script from `references/visual-extraction.md`:
- Record color, background, shadow, transform changes on hover
- Record focus ring styles
- Record active/pressed states
- Record transition properties

#### Network Traffic Capture
1. Inject the Network Capture script from `references/network-capture.md` BEFORE navigating
2. Navigate to the page
3. Interact: click tabs, submit forms, paginate, filter, sort
4. Collect all captured requests
5. Filter to API-only calls (exclude .js, .css, analytics)
6. Run the API Schema Inference script

#### Form Extraction
If the page has forms:
1. Run the Form Extraction script from `references/form-extraction.md`
2. Capture all fields, types, validation rules, labels
3. Run the Validation Rules script
4. Monitor form submit behavior

#### Interactive Elements
Run the State Extraction script from `references/state-extraction.md`:
- Map all dropdowns, modals, tabs, accordions, toggles, carousels
- Click through each state and screenshot
- Record open/close animations

#### URL State
Run the URL State Mapping script from `references/state-extraction.md`:
- Record which UI elements modify URL params
- Record pagination, search, sort, filter params

#### Data Tables
If the page has tables, run the Data Table Extraction from `references/state-extraction.md`:
- Extract headers (text, sortable, width)
- Extract sample rows (cell types: checkbox, avatar, badge, actions, text)
- Record pagination, search, bulk actions

#### Save Per-Page Spec

Save everything to `docs/clone-research/pages/<page-name>.md`:

```markdown
# Page: <PageName>
URL: /path
Auth required: yes/no
Screenshots: desktop.png, tablet.png, mobile.png

## Layout Structure
- [Component tree with exact dimensions from extraction]

## Computed Styles (key elements)
- [Paste the JSON from component extraction — these are the EXACT values to use]

## Hover/Focus States
- [Button hover: bg changes from X to Y, transition 150ms ease]
- [Link hover: color changes, text-decoration underline]

## API Calls Made
- GET /api/xxx → loads initial data (response shape: {...})
- POST /api/yyy → form submission (request shape: {...})

## Interactive Elements
- Dropdown: [selector] → options from API, filters table
- Modal: [trigger selector] → opens form, submits to POST /api/xxx
- Tabs: [selector] → switches content, may trigger API call

## Forms
- [Full form spec from extraction: fields, types, validation, submit endpoint]

## Data Tables
- [Full table spec: headers, column types, sort, pagination, bulk actions]

## Animations
- [Element]: [animation-name] [duration] [timing] [trigger]
```

### 1D: API Endpoint Summary

From all captured network traffic across all pages, compile `docs/clone-research/api/ENDPOINTS.md`:

For each unique endpoint:
- Method + URL pattern (identify dynamic segments: `/api/users/:id`)
- Request headers (auth token format)
- Request body shape (for POST/PUT)
- Response body shape (JSON with types)
- Query parameters
- Status codes observed

### 1E: Database Schema Inference

From API responses, infer the database schema and save to `docs/clone-research/DATABASE_SCHEMA.md`:

1. For each data entity (user, project, booking, etc.):
   - All fields from API responses with inferred types
   - Relationships (foreign keys)
   - Required vs optional
   - Unique constraints
2. Create SQL migration: `scripts/001_schema.sql`

### 1F: Authentication Flow Analysis

If the site has auth, document in `docs/clone-research/AUTH_FLOW.md`:
- Login form fields, endpoint, payload, response (JWT? cookie?)
- Signup flow
- Password reset flow
- OAuth providers (Google, GitHub, etc.)
- Token storage (cookie name, localStorage key)
- Session refresh mechanism
- Protected route patterns

### 1G: Deep Interaction Crawl (Click ABSOLUTELY EVERYTHING)

This is what makes the clone actually work, not just look right. You are OBSESSIVE. You click EVERYTHING. No element is left untouched.

**THE RULE: If you can see it and it might be interactive, click it. If clicking it reveals more things, click those too. Recurse until there is nothing left to discover.**

#### Sidebar / Navigation First (for logged-in pages)

When you land on any authenticated dashboard:

1. **Start with the sidebar/main navigation.** This is your TABLE OF CONTENTS for the entire app.
2. Click EVERY menu item, one by one, top to bottom.
3. For each item that has a chevron / arrow / expand indicator: expand it. Click every sub-item.
4. For each item that has a nested submenu on hover: hover and screenshot the submenu, then click each sub-item.
5. For each item that has a badge/counter (like "3 new"): note it — it indicates active features.
6. Screenshot each page that each menu item leads to.
7. This gives you the FULL map of the app before you go deep into any single page.

#### Per-Page Obsessive Crawl

For EACH page discovered from the navigation:

1. **Discover all clickable elements** — run the Clickable Discovery script from `references/deep-interaction-crawler.md`. This finds every button, link, slot, trigger, tab, card, icon — anything with `cursor: pointer` or interactive ARIA roles.

2. **Systematic click-through** — follow the Click-Through Protocol from `references/deep-interaction-crawler.md`:
   - For EVERY clickable element: click it, wait, detect what changed
   - If a modal/panel/dropdown opens: screenshot it, extract its content, find all clickable elements INSIDE it, recursively click those too (max depth 4)
   - If a dropdown has 10 options: record ALL 10. Don't sample 3.
   - If a "..." or kebab menu opens: click it, screenshot ALL options, then click EACH option to see what it does (cancel/close before destructive actions)
   - Record every interaction: what triggered, what appeared, what API calls fired
   - Close modals/panels after extraction, verify page returns to original state

3. **Don't skip ANYTHING:**
   - Header: logo (where does it link?), notification bell (what opens?), profile avatar (what menu?), search icon (what appears?), every single icon button
   - Toolbar/action bar: every button, every dropdown, every toggle, every icon
   - Cards: click the card itself, click every button inside the card, click every link inside
   - Lists: click each list item, click action buttons per item, test swipe on mobile
   - Settings: every toggle, every dropdown, every "Edit" link, every expandable section
   - Footer: every link, every icon

4. **Special handling for complex widgets:**
   - **Calendars** — follow the Calendar-Specific Deep Crawl protocol: test EVERY view (day/3-day/week/month/agenda), click empty slots, click existing events, test drag-to-create, test drag-to-reschedule, test resize, test prev/next/today, test date picker, test ALL filters (staff, service, status, location)
   - **Data tables** — click EVERY column header (sort asc, sort desc), test ALL pagination (first/prev/next/last/specific page), test search with actual text, test EVERY filter dropdown, test bulk select checkbox, test EVERY row action (edit/delete/view/duplicate), test row click
   - **Forms** — test EVERY field: type in text inputs, select every dropdown option (record all options), toggle every checkbox, test every radio group, test file upload UI, test date pickers, test color pickers, test rich text editors, test conditional fields (change one field → what other fields appear/disappear?)
   - **Navigation/Sidebar** — test collapsible sections (expand/collapse), nested menus (every level), hover states, active indicators, mobile hamburger/drawer, bottom navigation on mobile
   - **Tabs** — click EVERY tab, screenshot each tab panel, note if tab switch triggers API calls

5. **Save interaction map** to `docs/clone-research/pages/<page>-interactions.json`

6. **Generate INTERACTION_MAP.md** — consolidated map of ALL interactive elements across ALL pages (see template in `references/deep-interaction-crawler.md`)

### 1H: User Flow Mapping

Features are NOT individual pages — they are multi-step sequences. Map them.

1. **Identify all user flows** from the interaction crawl — see `references/user-flow-mapping.md` for flow types:
   - CREATE flows (new appointment, new client, new service)
   - READ/DETAIL flows (click item → detail view with tabs)
   - UPDATE flows (detail → edit → save)
   - DELETE flows (item → delete → confirm)
   - MULTI-STEP flows (booking wizard: service → staff → time → details → confirm)
   - CROSS-ROLE flows (client books → pro sees on calendar)

2. **Record each flow step-by-step** — follow the Flow Recording Protocol from `references/user-flow-mapping.md`:
   - For each step: what action, what trigger, what result, what API calls, what state changes
   - Screenshot each step
   - Record conditional branches (what if the slot is in the past? what if validation fails?)

3. **Document API call sequences per flow** — the exact order of API calls for each complete flow

4. **Map state transitions** — for complex features (appointment lifecycle, calendar views), draw state machine diagrams

5. **Save to `docs/clone-research/USER_FLOWS.md`** with flow dependency order (what to build first)

### 1I: Multi-Role Extraction (if multiple roles detected)

If the site has multiple user types (discovered and registered in Pre-Flight):

1. **Switch to each role's session** (already registered in Pre-Flight step 5). For each role:

2. **Per-role full extraction** — repeat the ENTIRE Phase 1 pipeline (1A through 1H) for THIS role:
   - Log in as this role
   - Start with sidebar — click every item, discover all pages this role can see
   - Full obsessive click-through of every page
   - Each role may see different pages, different navigation, different dashboard, different features
   - Save per-role data in `docs/clone-research/roles/{role}/`
   - Do this YOURSELF. Don't ask the user which pages to visit. Visit ALL of them.

3. **Role Comparison Matrix** — create `docs/clone-research/ROLE_MATRIX.md`:
   - Which pages are unique to each role
   - Which pages are shared but with different content/permissions
   - Which navigation items each role sees
   - Which components are shared vs role-specific
   - Database impact (role enum, role-specific tables, RLS policies)
   - Cross-role interactions (client books → pro sees event → team sees analytics)

---

## Phase 2: Architecture Design

Create `docs/clone-research/ARCHITECTURE.md` mapping extraction data to implementation:

1. **Route map** — every URL → Next.js route file path (grouped by role if multi-role)
2. **Layouts** — shared layouts (which pages share header/sidebar/footer), role-specific layouts
3. **Component list** — shared vs page-specific vs role-specific components
4. **API routes** — every captured endpoint → Next.js API route file path
5. **Database tables** — finalized schema (including role enum, role-specific tables if needed)
6. **Auth strategy** — provider, middleware, session hooks, role-based route protection
7. **State management** — React Query for server state, URL params for filters/sort/pagination
8. **User flows** — map each flow to the components + API routes it requires, determine build order (flows that depend on other flows being built first)
9. **Role routing** — if multi-role: middleware that checks role and redirects, route groups per role `/(client)/`, `/(pro)/`, `/(team)/`

---

## Phase 3: Foundation Build

Do this sequentially before any pages.

### 3A: Design System Implementation

1. **globals.css** — CSS variables from extraction, `@font-face` declarations with local fonts
2. **tailwind.config** — theme extension with exact values from Tailwind Theme Generator
3. **Layout components** — Header, Sidebar, Footer with exact computed styles from extraction
4. Copy all downloaded assets into `public/`

### 3B: Database Setup

If Supabase MCP available:
1. Create tables via `execute_sql` or `apply_migration`
2. Set up RLS policies
3. Seed with data from captured API responses
4. Generate TypeScript types

If no Supabase MCP:
1. Write migrations in `scripts/migrations/`
2. Create seed script `scripts/seed.ts`
3. Write TypeScript types manually

### 3C: Auth Setup

1. Configure auth provider
2. Create login/signup pages matching original's design exactly (use extracted computed styles)
3. Set up middleware for route protection
4. Create session hooks (`useUser`, `useAuth`)

### 3D: API Routes

For each endpoint in `ENDPOINTS.md`:
1. Create the API route file
2. Implement database query
3. Add zod validation matching captured request shapes
4. Add auth checks
5. Match response shape exactly to captured responses

---

## Phase 4: Page-by-Page Build

### Build Order
1. Auth pages (login, signup) — needed to test everything else
2. Main dashboard / home page
3. CRUD pages (lists, detail views, forms)
4. Settings/profile pages
5. Secondary pages

### Per-Page Build Process

For each page, the builder receives:
1. The page spec from `docs/clone-research/pages/` (with exact computed CSS values)
2. The component extraction JSON files
3. The screenshots for visual reference
4. The API endpoint specs

Builder instructions:
1. **Start with layout** — match the exact dimensions from component extraction
2. **Use extracted CSS values literally** — `padding: 14px 18px`, `border-radius: 8px`, `font-size: 14px`, `line-height: 20px`, `color: rgb(51, 51, 51)`. Use inline styles or exact Tailwind utilities.
3. **Implement all interactive elements** — dropdowns filter, modals open/close, tabs switch, forms submit
4. **Connect to real API routes** — forms POST, tables GET with pagination/filter/sort params
5. **Add hover/focus states** from extraction data
6. **Add animations** from keyframes extraction
7. **Handle loading, error, empty states**
8. **Verify with `npx tsc --noEmit`**

### Immediate Screenshot QA

After building EACH page:
1. Take screenshots at 1440px, 768px, 390px
2. Save to `docs/clone-research/screenshots/clone/<page>-*.png`
3. Compare visually with `docs/clone-research/screenshots/original/<page>-*.png`
4. Use the Visual Comparison Checklist from `references/visual-diff.md`
5. **Fix any differences NOW** — don't move to the next page with visual regressions

Parallel build: dispatch independent pages to worktree agents. Each agent gets the full page spec + design system + API specs.

### Cleanup Between Pages

**MANDATORY** — before starting work on the next page, clean up all temporary artifacts from the current page:

1. **Delete temporary extraction files:**
   - `docs/clone-research/components/<current-page>-*.json` — component extraction JSONs (already consumed during build)
   - Any temporary `.html` / `.txt` debug dumps created during extraction

2. **Delete clone QA screenshots** (keep originals for final QA):
   - `docs/clone-research/screenshots/clone/<current-page>-*.png` — intermediate comparison screenshots

3. **Delete network capture dumps:**
   - Any raw JSON dumps from `window.__netCapture` saved as temp files
   - Any raw form extraction dumps

4. **Keep permanently:**
   - `docs/clone-research/pages/<page>.md` — the page spec (compact, needed for reference)
   - `docs/clone-research/screenshots/original/<page>-*.png` — needed for final QA
   - `docs/clone-research/api/ENDPOINTS.md` — cumulative, used by all pages
   - `docs/clone-research/DESIGN_SYSTEM.md` — shared across all pages
   - All files in `public/` (fonts, images, icons — these are actual build assets)

5. **Verify cleanup:**
   ```bash
   # Check that no large temp files remain
   find docs/clone-research/components/ -name "<current-page>*" -type f
   # Should return nothing
   ```

This prevents the repo from bloating with hundreds of MB of intermediate screenshots and JSON dumps that are no longer needed. The page spec `.md` file contains everything needed for future reference in a compact form.

---

## Phase 5: Verification

### Functional Testing
1. **Forms** — submit every form, verify data persists
2. **Navigation** — click every link, verify routing
3. **Auth** — login, check protected routes redirect, logout
4. **CRUD** — create, read, update, delete on every entity
5. **Interactive elements** — test every dropdown, modal, accordion, tab
6. **URL state** — verify search, filter, sort, pagination sync with URL

### Visual QA (Screenshot Diff)

Use the workflow from `references/visual-diff.md`:

1. Take final screenshots of all clone pages (3 breakpoints each)
2. Run the Visual Comparison Checklist:
   - Layout (heights, widths, alignment, gaps)
   - Typography (family, size, weight, line-height, letter-spacing, color)
   - Colors (backgrounds, borders, buttons, links, badges, gradients)
   - Spacing (padding, margins, gaps)
   - Components (buttons, inputs, cards, badges, avatars, tables)
   - Interactions (hover, focus, active, transitions)
   - Responsive (breakpoint changes, hide/show, font scaling)
3. For pixel-level comparison, use the Canvas-based Pixel Comparison from `references/visual-diff.md`
4. Generate the Visual QA Report

### Fix Loop

For each difference found:
1. Identify the component and CSS property that differs
2. Go back to the original, re-extract the exact value with `getComputedStyle()`
3. Update the clone component with the exact value
4. Re-screenshot and verify

Target: **>95% pixel match** on all pages at all breakpoints.

---

## Phase 6: Polish & Edge Cases

1. **Scroll-triggered animations** — observe original scroll behavior, replicate with Intersection Observer or framer-motion
2. **Loading skeletons** — match original's skeleton/spinner patterns
3. **Error states** — 404 page, form validation errors, network errors
4. **Empty states** — tables with no data, search with no results
5. **Micro-interactions** — button press animations, toast notifications, progress bars
6. **Keyboard navigation** — tab order, enter to submit, escape to close modals
7. **Final build verification** — `npm run build` must pass cleanly

---

## Reference Scripts

| File | Purpose |
|------|---------|
| `references/visual-extraction.md` | Design tokens, per-component CSS extraction, hover/focus states, animations, breakpoints |
| `references/asset-pipeline.md` | Asset URL collection, font mapping, download instructions, Tailwind theme generation |
| `references/network-capture.md` | Fetch/XHR interception, API schema inference |
| `references/form-extraction.md` | Form fields, validation rules, submit behavior |
| `references/state-extraction.md` | Interactive elements mapping, URL state, data table structure |
| `references/visual-diff.md` | Screenshot comparison, pixel diff, QA checklist, region comparison, QA report template |
| `references/deep-interaction-crawler.md` | Discover ALL clickable elements, systematic click-through protocol, calendar/table/nav deep crawl |
| `references/multi-role-extraction.md` | Role discovery, per-role registration, per-role extraction, role comparison matrix |
| `references/user-flow-mapping.md` | Multi-step flow recording, conditional branches, API call sequences, state transitions |

---

## What NOT to Do

- **Don't approximate CSS values.** `padding: 16px` when the original is `14px` is wrong. Extract the real value.
- **Don't skip asset download.** External CDN fonts/images will break when the original changes.
- **Don't build before extracting.** The extraction data IS your spec. Without it you're guessing.
- **Don't move to the next page with visual bugs.** Fix each page before moving on.
- **Don't guess API shapes.** Capture real network traffic.
- **Don't skip auth-protected pages.** Ask the user to authenticate.
- **Don't hardcode data.** All dynamic content from database through API routes.
- **Don't approximate interactions.** A dropdown that filters a table must actually filter.
- **Don't skip error states.** Forms need validation errors, tables need empty states.
- **Don't ignore hover/focus states.** They are part of the design — extract and replicate them.
- **Don't use placeholder images.** Download the real ones or generate matching ones.
- **Don't skip clicking things.** If you didn't click a button, you don't know what it does. Click EVERYTHING.
- **Don't clone just one role.** If the site has client/pro/team views, you need ALL of them (or explicitly agree with user which ones).
- **Don't build page by page in isolation.** Build flows end-to-end: the "create appointment" flow spans calendar page + modal + API route + calendar refresh — build and test them together.
- **Don't ignore conditional branches.** "What if the time slot is taken?" "What if validation fails?" These paths are what make a clone feel real.

---

## Completion Report

```markdown
## Clone Complete

### Roles Cloned: X
- [x] Client (Y pages, Z flows)
- [x] Solo Pro (Y pages, Z flows)
- [x] Team (Y pages, Z flows)

### Visual Accuracy
- Desktop (1440px): XX.X% pixel match
- Tablet (768px): XX.X% pixel match
- Mobile (390px): XX.X% pixel match

### Pages: X/Y built (across all roles)
- [x] /login, /signup/client, /signup/pro, /signup/team
- [x] /(client)/bookings
- [x] /(pro)/calendar, /(pro)/clients, /(pro)/services
- [x] /(team)/calendar, /(team)/staff, /(team)/analytics
- ...

### User Flows: X/Y working end-to-end
- [x] Create appointment (calendar slot → modal → form → submit → event appears)
- [x] Reschedule appointment (event click → panel → reschedule → confirm)
- [x] Client booking (service → staff → time → details → confirm)
- [x] Cross-role: client books → pro sees on calendar
- ...

### Interactive Elements Verified
- Clicked and verified: X buttons, Y dropdowns, Z modals, W calendar interactions
- Calendar: day/week/month views, slot click, event click, drag, navigation
- Tables: sort, filter, paginate, bulk select, row actions
- Forms: conditional fields, validation, autocomplete, file upload

### API Routes: X endpoints implemented
### Database: X tables, Y seed records
### Auth: [provider] configured, X roles, role-based routing
### Animations: X keyframe animations, Y transitions
### Assets: X fonts, Y images, Z SVGs downloaded locally
### Build: npm run build [PASS/FAIL]
### Known Gaps: [list any features not replicated and why]
```
