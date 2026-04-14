# PHASE 17: UI/UX OVERHAUL — DESIGN SYSTEM

> Premium visual identity. Client app = Instagram-tier social experience. Master dashboard = Linear-tier CRM.

## Design philosophy
The original UI is functional stubs. This phase replaces them with a cohesive, premium design system. Two distinct but unified visual identities. **Reference:** Instagram mobile app for client UX, Linear/Raycast for master dashboard.

## Animation engine: Framer Motion (already installed)
- All page transitions: `<AnimatePresence>` with `motion.div` slide/fade
- Gesture animations: `whileTap={{ scale: 0.95 }}` on all interactive elements
- Layout animations: `layout` prop on lists that reorder (appointments, feed)
- Scroll-triggered: `whileInView` for lazy-loading cards
- Exit animations: `exit={{ opacity: 0, y: 20 }}` when removing items
- Spring physics: `transition={{ type: "spring", stiffness: 300, damping: 30 }}`

## Ready-made components reference
See `.knowledge/ui-libraries.md` for the full list of 107 snippets in `references/ui-snippets-21st/`.

## Client app (mobile-first, social-network feel)
_Layout: exactly like Instagram screenshot — stories row at top, feed below, 5-tab bottom nav._

- **Bottom tab bar** (5 tabs, fixed at bottom):
  - Home (house icon) — Feed of posts from followed masters
  - Calendar (calendar icon) — Client's unified appointment calendar
  - **+** (center, raised circle, accent bg) — Quick book action
  - Masters (users icon) — Search, map, followed masters list
  - Profile (user icon) — Settings, family, packages, referral
- **Tab behavior:** Active = filled icon + accent color + 3px dot below. Inactive = outline icon + muted. Center "+" is always accent-colored, slightly larger (56px vs 48px).
- **Tab transitions:** Content fades + slides horizontally (200ms ease-out). Use `<AnimatePresence mode="wait">` with `motion.div` and `key={activeTab}`.
- **Stories row** (top of Feed, horizontal scroll):
  - Circular avatars (64px) of followed masters
  - Gradient ring (conic-gradient pink→orange→purple) = master has new posts/promos
  - No ring = no new content
  - First circle = "Your story" placeholder (if master role) or "Discover" (search icon, for clients)
  - Tap → opens master's latest promo/post as a full-screen overlay (like Instagram Story) with "Book Now" CTA at bottom
- **Feed cards** (vertical infinite scroll):
  - Master avatar + name + specialization tag (top left)
  - "..." menu (top right) → Unfollow, Report, Share
  - Content area: image with rounded-xl, or text card with colored bg
  - Post types: `new_service`, `promotion`, `before_after`, `burning_slot`, `update`
  - Action bar: Heart (save/favorite) | Comment (future) | Share | Book (primary, right-aligned)
- **Pull-to-refresh:** Overscroll triggers spinner + haptic. Use `framer-motion` drag constraint.
- **Glassmorphism overlays:** All modals/sheets use `backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80`
- **Safe area:** `pb-[env(safe-area-inset-bottom)]` on tab bar for iPhone notch/home indicator
- **Hide tab bar on scroll down, show on scroll up** (like Instagram): track scroll direction, animate translateY

## Master dashboard (desktop-first, professional CRM)
_Layout: dark sidebar left, light content area right. Inspired by Linear + Notion but richer visually._

- **Sidebar** (left, 64px collapsed / 260px expanded):
  - Logo at top (CRES-CA wordmark when expanded, icon when collapsed)
  - Navigation items with icons: Calendar, Clients, Services, Queue (if queue_mode), Finance, Inventory, Marketing
  - Divider between main nav and settings
  - Bottom: user avatar (40px) + name + subscription badge (Starter=gray, Pro=blue, Business=gold) + settings gear
  - **Active state:** left accent bar (3px × 32px, var(--accent)), bg var(--accent-soft)
  - **Hover state:** bg zinc-100 dark:bg-zinc-800, 150ms transition
  - **Collapse toggle:** chevron at sidebar bottom, auto-collapse on screens < 1024px
  - **Mobile:** overlay drawer from left, backdrop blur, swipe-to-close
- **Top header bar:** page icon + title + breadcrumb | global search (Cmd+K) | notification bell + avatar dropdown
- **Content area patterns:**
  - **Overview/Dashboard:** Bento grid of stat cards. 2×3 grid on desktop, stack on mobile. Large metric number, label, trend badge (+12% green / -5% red), sparkline.
  - **List pages:** search bar top + filter pills + data table (sticky header) + floating "+" action button.
  - **Detail pages:** tabs header (Info | History | Health | Files) + content below.
  - **Calendar:** Full-width, no card wrapper. Time grid left, events as colored blocks. Mini-month calendar in sidebar.
- **Command palette** (Cmd+K / Ctrl+K):
  - Modal overlay with search input, categorized results: Recent, Clients, Services, Pages, Actions
  - Keyboard navigation (arrow keys + enter)
  - Simple fuzzy match on `string.toLowerCase().includes()`, no library needed
- **Notifications panel:** Click bell → dropdown (right, 380px wide, max-height 500px, scrollable). Icon + title + time ago + read/unread dot. "Mark all read" at top.
- **Data tables:** Zebra striping, hover row highlight, sticky header, column sorting, inline "quick edit" (click cell → input appears).

## Shared design tokens
- Font: system font stack (`font-sans` — Inter web, SF Pro iOS, Roboto Android)
- Border radius: cards 16px (`rounded-2xl`), buttons 10px (`rounded-[10px]`), avatars 9999px, inputs 8px (`rounded-lg`)
- Shadows: cards `shadow-sm`, elevated `shadow-md`, overlays `shadow-xl`
- Transitions: all interactive `transition-all duration-200 ease-out`
- Colors: neutral base zinc, accent violet, semantic green/amber/red
- Spacing: 4px grid. Page padding 24px (`p-6`). Section gap 32px (`space-y-8`).

---

## Tasks

- [x] **17.1 — Design tokens & theme variables**
  - **Modify:** `src/app/globals.css`
  - **What:** Define CSS custom properties for the design system:
    ```css
    :root {
      /* Surfaces */
      --surface-primary: theme(colors.white);
      --surface-secondary: theme(colors.zinc.50);
      --surface-elevated: theme(colors.white);
      --surface-overlay: rgba(255, 255, 255, 0.8);

      /* Accent */
      --accent: theme(colors.violet.600);
      --accent-soft: theme(colors.violet.50);
      --accent-hover: theme(colors.violet.700);

      /* Semantic */
      --success: theme(colors.emerald.500);
      --warning: theme(colors.amber.500);
      --danger: theme(colors.red.500);

      /* Spacing */
      --space-page: 1.5rem;
      --space-section: 2rem;
      --space-card: 1rem;

      /* Radius */
      --radius-card: 1rem;
      --radius-button: 0.625rem;
      --radius-avatar: 9999px;

      /* Shadows */
      --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
      --shadow-elevated: 0 4px 12px rgba(0,0,0,0.08);
      --shadow-overlay: 0 8px 30px rgba(0,0,0,0.12);
    }
    .dark {
      --surface-primary: theme(colors.zinc.950);
      --surface-secondary: theme(colors.zinc.900);
      --surface-elevated: theme(colors.zinc.800);
      --surface-overlay: rgba(0, 0, 0, 0.7);
      --shadow-card: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-elevated: 0 4px 12px rgba(0,0,0,0.4);
    }
    ```
  - **Also:** define animation keyframes: `shimmer`, `slideUp`, `slideIn`, `fadeIn`, `scaleIn`, `confetti`

- [x] **17.2 — Shared primitive components**
  - **Create:** `src/components/shared/primitives/` with:
    - `stat-card.tsx` — Large number + label + trend arrow + optional sparkline
    - `avatar-ring.tsx` — Circular avatar with gradient ring or status dot
    - `bottom-sheet.tsx` — Draggable bottom sheet, snap points (25%/50%/90%)
    - `empty-state.tsx` — Illustration + title + description + CTA
    - `shimmer-skeleton.tsx` — Animated gradient shimmer
    - `trend-badge.tsx` — "+12%" pill with arrow icon
    - `command-palette.tsx` — Cmd+K modal with fuzzy search
  - **All components:** use design tokens from 17.1, support dark mode, YAML headers.

- [x] **17.3 — Client bottom tab bar redesign**
  - **Modify:** `src/app/[locale]/(client)/layout.tsx`
  - **What:** Instagram-style 5-tab bar. Center "+" raised. Safe area padding. Hide on scroll down, show on scroll up.

- [x] **17.4 — Client feed page (Home tab)**
  - **Create:** `src/app/[locale]/(client)/feed/page.tsx`
  - **What:** Vertical feed of "posts" from followed masters. Pull-to-refresh. Infinite scroll. Horizontal stories row at top.
  - **Migration:** `supabase/migrations/00004_feed.sql`:
    ```sql
    create table feed_posts (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      type text not null check (type in ('new_service', 'promotion', 'before_after', 'burning_slot', 'update')),
      title text,
      body text,
      image_url text,
      linked_service_id uuid references services(id),
      linked_product_id uuid,
      expires_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index idx_feed_posts_master on feed_posts(master_id);
    create index idx_feed_posts_created on feed_posts(created_at desc);
    ```

- [x] **17.5 — Master dashboard sidebar redesign**
  - **Modify:** `src/app/[locale]/(dashboard)/layout.tsx`
  - **What:** Collapsed (64px) / expanded (260px) sidebar with sections (Main / Business / Settings). Active accent bar. Cmd+K trigger. Top header with breadcrumb + search + bell + avatar dropdown.

- [x] **17.6 — Calendar visual overhaul**
  - **Modify:** `src/components/calendar/day-view.tsx` and `week-view.tsx`
  - **What:** Rounded-lg appointment blocks with colored left border. Current time indicator line. Drag ghost. Empty slot hover "+". Mini-calendar in sidebar. Mobile: swipe to change day.

- [x] **17.7 — Contact / Support page + footer**
  - **Create:** `src/app/[locale]/(landing)/contact/page.tsx`
  - **API:** `src/app/api/contact/route.ts` — rate-limited (3/hour/IP), sends via Resend.
  - **What:** Contact form (name, email, subject dropdown, message), Telegram support link, email `support@cres-ca.com`, FAQ link. Landing footer: About | Pricing | Contact | Terms | Privacy. Dashboard & client tabs link to `/contact`.
  - **i18n keys:** `contact.title`, `contact.form.*`, `contact.success`, `footer.*`, `nav.helpSupport`, `nav.support`

- [x] **17.8 — Verify Phase 17**
  - Design tokens applied. Client tab bar is Instagram-quality. Feed scrolls. Dashboard sidebar collapses. Calendar premium. Command palette works. Contact page and footer present.
  - `npm run build` passes
