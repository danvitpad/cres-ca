# CLIENT SECTOR — Living Knowledge Base

> **This file is maintained by the Client Agent.** Every decision, style choice, Fresha analysis, improvement idea, and cross-sector connection is recorded here. This is the agent's memory and evolving brain.

---

## Reference: Fresha Client Experience
> Agent will analyze Fresha's client-facing booking flow and record findings here.

_(awaiting Fresha analysis session)_

---

## Design Decisions Log
> Every style, color, spacing, animation choice with reasoning.

_(no entries yet — agent will populate during work sessions)_

---

## Component Registry
> Every component in the client sector, its purpose, current state, and issues.

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Bottom Tab Bar | `(client)/layout.tsx` | exists | needs redesign Phase 17 |
| Feed Page | `(client)/feed/page.tsx` | exists | — |
| Booking Flow | `(client)/book/page.tsx` | exists | — |
| My Calendar | `(client)/my-calendar/page.tsx` | exists | — |
| Masters List | `(client)/masters/page.tsx` | exists | — |
| Master Profile | `(client)/masters/[id]/page.tsx` | exists | — |
| Map | `(client)/map/page.tsx` | stub | — |
| Shop | `(client)/shop/page.tsx` | exists | — |
| Profile | `(client)/profile/page.tsx` | exists | — |
| Family | `(client)/profile/family/page.tsx` | exists | — |
| History | `(client)/history/page.tsx` | stub | — |

---

## Cross-Sector Connections
> How client sector connects to master and salon sectors.

| Connection | From (Client) | To (Master/Salon) | Status |
|------------|---------------|-------------------|--------|
| Booking creates appointment | book/page.tsx | calendar/page.tsx | ? |
| Client follows master | masters/[id] | marketing/profile | ? |
| Review after visit | history | marketing/reviews | ? |
| Product purchase | shop | marketing/products | ? |
| Waitlist notification | my-calendar | calendar (slot freed) | ? |
| Referral link | profile | clients (new client) | ? |
| Gift certificate | profile | finance/gift-cards | ? |
| Family booking | profile/family | calendar (appointment) | ? |

---

## Improvement Ideas
> Agent's own analysis of what can be better.

_(agent will populate during analysis sessions)_

---

## Bugs & Issues Found
> Problems discovered during analysis or development.

_(agent will populate during work sessions)_

---

## Styles & Tokens
> Colors, fonts, spacing, animations specific to client sector.

| Token | Value | Usage |
|-------|-------|-------|
| Primary action | — | Book button, CTA |
| Tab bar height | — | Bottom navigation |
| Card radius | — | Master cards, service cards |
| Animation duration | — | Page transitions |
| Bottom sheet | — | Filters, details, confirmations |

_(to be filled from Fresha analysis + design decisions)_

---

## Session Log
> Chronological record of what was changed and why.

_(entries added automatically by agent during each work session)_
