---
name: Backlog — Client Feed & AI
description: Deferred ideas from Phase 7 client UX work, to slot into Phase 8+/12/18/23
status: backlog
created: 2026-04-12
---

# Backlog — Client Feed & AI Improvements

Captured during Phase 7 client UX overhaul (2026-04). All items are deferred from feed restyle work and need a target phase.

## Discovery & Feed

### "Открой для себя" — paid placement + geo ranking
- Combine geo-distance with paid promotion slots (not too far — radius cap)
- Need RPC `discover_masters(lat, lng, radius_km, slot_count)` returning ranked mix of organic + paid
- UI badge on paid: subtle "Реклама" hint at bottom of card (Instagram-style)
- **Target**: Phase 18 (client experience) + Phase 20 (advanced marketing)

### Promo posts inline
- Promotion type already renders inline with gradient badge in feed
- Need creator UI for masters to schedule promo posts
- **Target**: Phase 20

### Smart waitlist
- Client joins queue for fully-booked slot, gets push when someone cancels
- **Target**: Phase 18

### McDonalds-style upsell
- After choosing main service, suggest add-ons ("уход за 200₴?")
- **Target**: Phase 19 (service types) — config per service

### Equipment-based booking
- Book specific chair/station/machine, not just master
- **Target**: Phase 19

### Voice notes AI
- Client records voice memo with wishes, AI transcribes + tags
- **Target**: Phase 12 (AI)

### Cross-marketing bonuses
- Hairdresser gives discount voucher for partnered cosmetologist
- **Target**: Phase 20

### Family budget
- Shared wallet for family — kids/spouse spending
- **Target**: Phase 21 (finance advanced)

### Auto-sale 2h after visit
- Master tags products used in service photo, auto-DM to client with "buy"
- **Target**: Phase 18 + Phase 19

### Birthday congrats + bonus
- Auto greeting with personalized discount on user birthday
- **Target**: Phase 11 (marketing)

### Public no-show blacklist
- Client who no-shows 3+ times appears flagged to other masters (with appeal flow)
- **Target**: Phase 18 + Phase 15 (consent — needs careful legal review)

### Telegram bots — separate client/master
- Two distinct bots, deep linking
- **Target**: Phase 23 (telegram deep)

### Invitation links / referrals
- Master/client invite → bonus on first booking
- **Target**: Phase 20

### Social proof "X записались"
- Currently mocked from post.id charcode — need real bookings count
- **Target**: Phase 18 (cheap, 2h)

### Recommendation badge "Рекомендует Юля"
- When followed master likes another master, show in feed
- **Target**: Phase 18

## AI "Тебе пора" — improvements

Beyond simple 18-day rebooking analysis:

1. **Seasonality** — shorter summer cycles, winter dryness
2. **Weather context** — rainy week → manicure/pedicure for closed shoes; sunny → SPF reminder
3. **Calendar awareness** — read Google Calendar (with consent) for weddings/interviews → remind 7d before
4. **Repeating patterns** — client always books before NY → predict 10d ahead
5. **Cross-master AI** — "Yulia did color 3 weeks ago, brows usually next → remind"
6. **Sentiment guard** — if last review was cold, pause notifications, give cooldown
7. **Best-time-to-send** — learn when user opens Telegram, send then
8. **Life events** — pregnancy → no chemicals warning to colorist; new baby → home services suggestion
9. **Budget awareness** — if user has wallet balance, mention it in nudge ("у тебя есть 500₴ бонусов")
10. **Master availability** — only nudge for services where master has free slots in next 7d

**Target**: Phase 12 (AI) — combine with Phase 23 (Telegram) for delivery

## UX polish backlog

- Pull-to-refresh on feed (mobile)
- Skeleton states for "Свободные окна" / "Открой для себя"
- Empty states with personality (illustrations)
- Heart animation on save (pulse + count)
- Share sheet integration (native Web Share API)
- Long-press post → quick book menu

**Target**: Phase 17 (design system) + Phase 18
