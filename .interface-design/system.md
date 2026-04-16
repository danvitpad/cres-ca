# CRES-CA Unified Design System

> **Hyper-skill** — synthesized from 7 sources: Linear.app DESIGN.md, frontend-design, interface-design, emil-design-eng, impeccable, design-taste-frontend, high-end-visual-design, stitch-design-taste, polish.
> Established 2026-04-16. Single source of truth for all UI work.

---

## 0. Design Dials (baseline — adapt per surface)

| Dial | Value | Meaning |
|------|-------|---------|
| DESIGN_VARIANCE | 5 | Dashboard = offset-asymmetric but functional, not artsy chaos |
| MOTION_INTENSITY | 5 | Fluid CSS transitions, staggered reveals. No cinematic excess |
| VISUAL_DENSITY | 6 | Between "daily app" and "cockpit" — data-rich but breathable |

Mini App (client-facing) dials: VARIANCE 7, MOTION 6, DENSITY 4 (airier, more expressive).

---

## 1. Atmosphere

**Dashboard:** Precision & density. A command center that whispers competence. Dark-mode native canvas where information emerges from near-black through luminance hierarchy. Every pixel communicates data, not decoration. Think Linear.app — extreme engineering aesthetic.

**Mini App:** Premium consumer feel. Pinterest/Spotify warmth on a dark canvas. Generous spacing, bold imagery, haptic feedback. Think Instagram stories meets Stripe checkout.

---

## 2. Color Tokens

### Dark (primary for both surfaces)

| Role | Name | Value | Usage |
|------|------|-------|-------|
| Page background | Void Black | `#08090a` | Base canvas |
| Card background | Panel Dark | `#0f1011` | Cards, containers |
| Card hover | Panel Hover | `#141516` | Hover/active states |
| Elevated surface | Surface Raised | `#191a1b` | Dropdowns, modals |
| Secondary surface | Surface Light | `#28282c` | Hover backgrounds |
| Primary text | Snow | `#f7f8f8` | Headlines, values |
| Secondary text | Silver | `#8a8f98` | Labels, descriptions |
| Tertiary text | Ash | `#62666d` | Metadata, timestamps |
| Brand accent | Indigo | `#5e6ad2` | CTAs, active states, links |
| Accent hover | Bright Indigo | `#828fff` | Hover on accent elements |
| Success | Emerald | `#10b981` | Positive values, active status |
| Warning | Amber | `#f59e0b` | Alerts, approaching limits |
| Danger | Coral | `#ef4444` | Errors, negative values |
| Border subtle | Whisper | `rgba(255,255,255,0.05)` | Default card/divider borders |
| Border standard | Outline | `rgba(255,255,255,0.08)` | Inputs, prominent separators |
| Line tint | Ghost | `#141516` | Subtlest divisions |

### Light

| Role | Name | Value |
|------|------|-------|
| Page background | Canvas | `#f7f8f8` |
| Card background | White | `#ffffff` |
| Card hover | Mist | `#f3f4f5` |
| Elevated surface | Fog | `#f3f4f5` |
| Primary text | Ink | `#0d0d0d` |
| Secondary text | Graphite | `#62666d` |
| Tertiary text | Slate | `#8a8f98` |
| Border subtle | Silk | `#e6e6e6` |
| Border standard | Steel | `#d0d6e0` |

**Rules:**
- Max 1 chromatic accent (Indigo). Everything else is achromatic
- Never use pure `#000000` — use Void Black `#08090a`
- Never use pure `#ffffff` for text — use Snow `#f7f8f8`
- Tint neutrals toward brand hue (indigo undertone at chroma 0.005)
- 60-30-10 visual weight: 60% surfaces, 30% secondary text/borders, 10% accent
- No purple gradients, no neon glows, no AI purple/blue aesthetic — our Indigo is structural, used sparingly

---

## 3. Typography

### Font Stack

**Primary:** `Inter, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- OpenType features: `cv01`, `ss03` — geometric alternates, cleaner appearance
- **Why Inter:** deliberate Linear.app brand reference, not a lazy default. The `cv01`+`ss03` features + signature weight 510 differentiate it from generic Inter usage

**Monospace:** `"Berkeley Mono", "JetBrains Mono", ui-monospace, "SF Mono", monospace`
- For code blocks, tabular data, timestamps

### Scale

| Role | Size | Weight | Letter-spacing | Line-height |
|------|------|--------|---------------|-------------|
| Page title | 24px | 600 | -0.4px | 32px |
| Card title | 16px | 600 | -0.2px | 24px |
| Section label | 14px | 600 | -0.2px | 20px |
| Metric label | 11-12px | 500 | 0.5px (uppercase) | 16px |
| Big number | 22-28px | 700 | -0.5 to -0.8px | 1.2 |
| Body | 14px | 400-500 | normal | 20px |
| Body small | 13px | 400-500 | normal | 18px |
| Caption | 12px | 400-500 | normal | 16px |
| Micro | 11px | 500 | normal | 14px |

**Rules:**
- Tabular nums on all numeric data: `font-variant-numeric: tabular-nums`
- Negative letter-spacing scales with size (bigger = more negative)
- Cap body text at 65-75ch line length
- For light-on-dark: add 0.05 to line-height for readability
- Never use serif fonts on dashboard
- Fixed `rem` scale for app UI — no fluid `clamp()` (that's for marketing)

---

## 4. Spacing

- **4pt scale:** 4, 8, 12, 16, 20, 24, 32, 48, 64, 96
- Page padding: `28px 36px` (desktop), `16px` (mobile)
- Max content width: `1120px`
- Card padding: `20px` (standard), `16px` (compact)
- Card border-radius: `10px`
- Card border: `1px solid var(--border)` — no thick borders, no box-shadows
- Section gap: `24px`
- Card gap: `16px` within grid
- Inner item gap: `12px`
- Use `gap` (not margins) for sibling spacing
- Vary spacing for hierarchy — heading with more space above reads as more important

---

## 5. Motion (framer-motion + CSS)

### Decision Framework (Emil Kowalski)

| Frequency | Animation |
|-----------|-----------|
| 100+/day (keyboard, command palette) | None. Ever. |
| Tens/day (hover, list nav) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare/first-time (onboarding, celebrations) | Can add delight |

### Easing

```css
/* UI interactions — starts fast, feels responsive */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* On-screen movement — natural accel/decel */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* Drawer/sheet curve (iOS-like) */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Never** use `ease-in` for UI — it starts slow, feels sluggish.
**Never** use `linear` for UI — reserved for progress bars only.
**Never** use bounce/elastic easing — feels dated.

### Duration

| Element | Duration |
|---------|----------|
| Button press | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-400ms |
| Page entrance stagger | delay: i * 40ms, duration: 350ms |

**All UI animations under 300ms.** Faster feels more responsive.

### Rules

- Only animate `transform` and `opacity` — everything else triggers layout/paint
- Never animate from `scale(0)` — start from `scale(0.95)` + `opacity: 0`
- Stagger delays: 30-50ms between items (short — long delays feel slow)
- framer-motion shorthand (`x`, `y`, `scale`) is NOT hardware-accelerated — use `transform: "translateX()"` for perf-critical animations
- `prefers-reduced-motion`: keep opacity transitions, remove movement
- CSS transitions > keyframes for interruptible UI
- Isolate perpetual/infinite animations in their own React component (prevent parent re-renders)

### Button Tactile Feedback

```css
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.97); }
```

Every pressable element needs active-state scale (0.95-0.98).

---

## 6. Component Patterns

### Card

```
background: var(--bg-card)
border-radius: 10px
border: 1px solid var(--border)
padding: 20px
```

No box-shadows on cards — border only. No cards inside cards. Use cards ONLY when elevation communicates hierarchy — otherwise use spacing/dividers.

### Metric Card (compact KPI)

```
padding: 16px
Label: 11px uppercase weight-500 tracking-0.5px color: var(--text-tertiary)
Value: 22px weight-700 tracking-neg color: var(--text)
Sub-text: 12px color: var(--text-secondary)
Progress bar: 4px height, rounded-2, animated width
```

### List Item

```
padding: 12px 8px
border-bottom: 1px solid var(--border) (except last)
transition: background-color 0.15s
```

### Quick Action Button

```
padding: 10px 12px
border-radius: 8px
background: var(--bg-elevated) or var(--accent) for primary
font-size: 13px, weight: 500
icon: 15px, opacity: 0.8
active: scale(0.97)
```

### Interactive States (ALL elements must have):

1. **Default** — resting
2. **Hover** — subtle color/bg shift (desktop only: `@media (hover: hover)`)
3. **Focus** — visible focus ring (never remove)
4. **Active** — scale(0.97) or translate(-1px)
5. **Disabled** — opacity 0.5, pointer-events none
6. **Loading** — skeleton matching layout dimensions (never spinner)
7. **Empty** — composed state that teaches usage, never just "nothing here"

### Touch Targets

Minimum 44px on mobile. No exceptions.

---

## 7. Anti-Patterns (BANNED)

### Visual
- No generic box-shadows on cards — use border only
- No neon/outer glows
- No gradient text (`background-clip: text` + gradient = banned)
- No side-stripe borders (`border-left: 3px+ solid color` = banned)
- No pure `#000000` or pure `#ffffff`
- No `backdrop-blur` on scrolling containers (fixed/sticky only)
- No grain/noise on scrolling containers (fixed pseudo-elements only)
- No glassmorphism as decoration — use purposefully or not at all

### Typography
- No Inter as lazy default (our Inter is deliberate + cv01+ss03 customized)
- No serif fonts on dashboard
- No oversized H1s that scream — control with weight and color
- No monospace as lazy "developer vibes"

### Layout
- No 3 equal cards in a row (vary sizes or use asymmetric grid)
- No center-aligned everything (left-align with asymmetric space)
- No cards inside cards
- No `h-screen` — use `min-h-[100dvh]` (iOS Safari)
- No flexbox percentage math — use CSS Grid
- No arbitrary `z-index` spam

### Content
- No generic names ("John Doe", "Acme") in test data
- No round numbers (99.99%, 50%) in mock data
- No AI copywriting ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No emojis in code or UI text
- No broken Unsplash links — use `picsum.photos` or SVG avatars

### Motion
- No `transition: all` — specify exact properties
- No `ease-in` for UI animations
- No `linear` for UI animations (only progress bars)
- No bounce/elastic easing
- No animations on keyboard-triggered actions
- No `duration > 300ms` on UI elements
- No animating `top/left/width/height` — only `transform` and `opacity`

---

## 8. Responsive

- Mobile-first collapse at `768px` — single column, `px-4`
- Typography scales: headlines via fixed rem (not clamp for app UI)
- Touch targets: 44px minimum
- No horizontal scroll — ever
- Section gaps reduce: `clamp(1.5rem, 4vw, 3rem)`
- Images: aspect-ratio set, lazy-loaded, no layout shift

---

## 9. Accessibility

- WCAG AA contrast on all text
- `prefers-reduced-motion`: fade only, no movement
- `@media (hover: hover) and (pointer: fine)` for hover effects
- Semantic HTML (headings, landmarks, lists)
- Keyboard navigation: logical tab order, visible focus
- ARIA labels on icon-only buttons
- Never disable focus outline without replacement

---

## 10. Quality Checklist (before shipping any page)

- [ ] All queries verified against real DB schema
- [ ] All translation keys exist in ru.json and en.json
- [ ] All links include `/${locale}/` prefix
- [ ] Staggered entrance animations present
- [ ] Every interactive element has all 7 states
- [ ] Touch targets 44px+ on mobile
- [ ] No `console.log`, no dead code, no `any` types
- [ ] Contrast meets WCAG AA
- [ ] No layout shift on load
- [ ] Responsive: single column below 768px
- [ ] `prefers-reduced-motion` respected
