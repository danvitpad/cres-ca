---
name: hyper-design
description: Unified design skill for CRES-CA. Synthesizes 7 design skills into one. Invoke before ANY UI work on dashboard or Mini App pages. Reads .interface-design/system.md as the single source of truth.
user-invocable: true
argument-hint: "[page-path or component-name]"
---

# CRES-CA Hyper-Design Skill

> Unified from: frontend-design, interface-design, emil-design-eng, impeccable, design-taste-frontend, high-end-visual-design, stitch-design-taste, polish.

## When invoked

1. **Read** `.interface-design/system.md` — the design system tokens, rules, anti-patterns
2. **Read** `.knowledge/design-md/linear.app/DESIGN.md` — brand reference for dashboard
3. **Identify surface:** dashboard (Linear.app tokens) or Mini App (Pinterest/Spotify tokens)
4. **Set dials:** Dashboard = VARIANCE 5, MOTION 5, DENSITY 6. Mini App = VARIANCE 7, MOTION 6, DENSITY 4.
5. **Check the page** against the Quality Checklist (system.md §10) before and after work

## Pre-Build Checkpoint

Before writing ANY component or page code, answer these silently:

- [ ] **Purpose:** What problem does this page solve? Who uses it?
- [ ] **Data:** What DB tables/columns does it need? Are they verified in the schema?
- [ ] **Translations:** Are all user-visible strings in `t('key')` with keys in ru.json + en.json?
- [ ] **Links:** Do all `href` values include `/${locale}/` prefix?
- [ ] **States:** Have I planned empty, loading, error, and populated states?
- [ ] **Motion:** Does each animation have a clear purpose? Is duration < 300ms?

## Build Rules (non-negotiable)

1. **Colors from system.md only** — no ad-hoc hex values
2. **Typography from system.md scale** — no invented sizes/weights
3. **Spacing from 4pt scale** — 4, 8, 12, 16, 20, 24, 32, 48, 64, 96
4. **`gap` not margins** for sibling spacing
5. **CSS Grid not flex-math** for layouts
6. **framer-motion** for entrance animations, CSS for hover/active
7. **Custom easing:** `cubic-bezier(0.23, 1, 0.32, 1)` for ease-out
8. **Button tactile:** `scale(0.97)` on `:active` / `active:scale-[0.97]`
9. **Never animate from scale(0)** — start from 0.95 with opacity 0
10. **Stagger:** 30-50ms between items

## Post-Build Polish

After the page works, run through:

1. **Alignment** — pixel-perfect, grid-snapped
2. **States** — all 7 interactive states on every element
3. **Responsive** — single column < 768px, 44px touch targets
4. **Motion** — smooth 60fps, only transform+opacity
5. **Accessibility** — contrast, focus rings, reduced-motion
6. **Code** — no console.log, no dead code, no `any`

## Anti-Slop Test

> If you showed this to someone and said "AI made this," would they believe you immediately? If yes, redesign.

The goal: someone asks "how was this made?" not "which AI made this?"
