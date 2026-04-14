# SALON/TEAM SECTOR — Living Knowledge Base

> **This file is maintained by the Salon Agent.** Every decision, style choice, Fresha analysis, improvement idea, and cross-sector connection is recorded here. This is the agent's memory and evolving brain.

---

## Reference: Fresha Team/Business Dashboard
> Agent will analyze Fresha's salon/team management features and record findings here.

_(awaiting Fresha analysis session)_

---

## Design Decisions Log
> Every style, color, spacing, layout choice with reasoning for team-specific features.

_(no entries yet — agent will populate during work sessions)_

---

## Component Registry — Team-Specific Features
> Components that ONLY exist in salon mode (on top of everything the master sector has).

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Multi-Master Calendar | `calendar/page.tsx` (team mode) | ? | Side-by-side view needed |
| Team Management | `settings/team/page.tsx` | exists | — |
| Shift Scheduling | `settings/team/shifts/page.tsx` | exists | — |
| Timesheets | `settings/team/timesheets/page.tsx` | exists | — |
| Payroll / Payrun | `settings/team/payrun/page.tsx` | exists | — |
| Equipment Management | `settings/equipment/page.tsx` | exists | Shared resource calendar |
| Multi-Location | `settings/locations/page.tsx` | exists | — |
| Queue / Walk-ins | `queue/page.tsx` | exists | — |
| Client Segments | `clients/segments/page.tsx` | exists | VIP, at-risk, new |
| Business Reports | `finance/reports/page.tsx` | exists | P&L, forecasts |
| Team KPI Dashboard | `dashboard/page.tsx` (team mode) | ? | Per-master comparison |
| Location Selector | `layout.tsx` (header) | ? | Multi-location switching |

---

## Cross-Sector Connections
> How salon sector connects to master and client sectors.

| Connection | From (Salon) | To (Master/Client) | Status |
|------------|-------------|-------------------|--------|
| Salon owner sees ALL clients | clients/ (salon view) | Master: clients/ (filtered) | ? |
| Multi-master calendar | calendar/ (team view) | Master: calendar/ (personal) | ? |
| Equipment blocks booking | settings/equipment | Client: booking flow | ? |
| Shift affects availability | settings/team/shifts | Client: sees free slots | ? |
| Payroll from appointments | settings/team/payrun | Master: completed appointments | ? |
| Team performance → marketing | finance/reports | marketing/campaigns | ? |
| Master within salon → limited view | layout.tsx (role check) | Master sector (filtered) | ? |
| Client segments → targeted campaigns | clients/segments | marketing/automation | ? |
| Membership revenue tracking | finance/memberships | Client: membership purchase | ? |
| Review management | marketing/reviews | Client: post-visit rating | ? |

---

## Permission Matrix
> Who sees what in the salon.

| Feature | salon_admin | master (in salon) | receptionist* |
|---------|:-----------:|:-----------------:|:-------------:|
| All clients | YES | Only their own | YES |
| All calendars | YES | Only their own | YES |
| Team management | YES | NO | NO |
| Shifts | YES | View own only | NO |
| Payroll | YES | View own only | NO |
| Finance (all) | YES | Own revenue only | Limited |
| Equipment | YES | View only | Book for clients |
| Settings | YES | Limited | NO |
| Marketing | YES | Limited | NO |

*receptionist role is future — design for it now

---

## Improvement Ideas

_(agent will populate during analysis sessions)_

---

## Bugs & Issues Found

_(agent will populate during work sessions)_

---

## Styles & Tokens (Salon-specific additions)
> On top of master sector tokens, salon adds:

| Token | Value | Usage |
|-------|-------|-------|
| Master color coding | auto-assigned | Each master gets a color in multi-calendar |
| Location badge | — | Header location selector |
| Team status indicator | green/yellow/red | Working / break / off |
| KPI card positive | — | Above target metrics |
| KPI card negative | — | Below target metrics |
| Equipment available | — | Free slot color |
| Equipment booked | — | Occupied slot color |

---

## Fresha Team Patterns to Clone / Improve

_(agent will analyze and populate)_

---

## Session Log

_(entries added automatically by agent during each work session)_
