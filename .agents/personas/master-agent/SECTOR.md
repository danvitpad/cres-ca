# MASTER (SOLO) SECTOR — Living Knowledge Base

> **This file is maintained by the Master Agent.** Every decision, style choice, Fresha analysis, improvement idea, and cross-sector connection is recorded here. This is the agent's memory and evolving brain.

---

## Reference: Fresha Dashboard
> Analyzed 2026-04-11 from partners.fresha.com

### Global Layout
- **Header**: 60px, dark (#0d0d0d). Logo "fresha" left, right: "Продолжить настройку" (purple CTA pill), Search (magnifier), Analytics (bar chart), Notifications (bell with red badge count), Avatar (circle with initials)
- **Sidebar**: 72px wide, dark (#0d0d0d on light / #000 on dark). Icon-only rail. Active state = purple (#6950f3) rounded square bg. Sidebar is FIXED, does not scroll with content
- **Content area**: full remaining width, scrollable. Background matches theme (white light / black dark)
- **Flyout menus**: hovering sidebar icon shows left-aligned flyout panel (~280px) with section title, grouped links with optional blue dots for notifications. Flyout has `<` close button

### Sidebar Navigation (exact order, top to bottom)
1. Home (house icon) → direct link to `/dashboard`
2. Calendar (calendar icon) → direct link to `/calendar`
3. Sales (tag icon) → flyout: Ежедневный отчет, Записи, Продажи, Платежи, Подарочные карты, Абонементы
4. Clients (smiley icon) → flyout: Список клиентов, Сегменты, Лояльность
5. Catalogue (book icon) → flyout: Меню услуг, Абонементы, Товары | Ассортимент: Инвентаризация, Заказы на запасы, Поставщики
6. Online Booking (frame icon) → flyout: Профиль на маркетплейсе, Забронировать через Google, Кнопки Facebook/Instagram, Конструктор ссылок
7. Marketing (megaphone icon) → flyout: Обмен сообщениями (Массовые кампании, Автоматизация, История) | Промоакция (Сделки, Умные расценки) | Engage (Отзывы)
8. Team (people icon, blue dot) → flyout: Участники команды, График смен, Табели, Прогоны платежей
9. Analytics (chart icon) → direct link to `/reports`
10. Add-ons (grid icon) → direct link to `/add-ons`
11. Settings (gear icon) → direct link to `/setup`
12. Help (? icon) → bottom of sidebar

### Calendar Page
- **Toolbar**: "Сегодня" pill | `<` `>` arrows | date label ("суб 11 апр.") | "Команда смены" dropdown | filter sliders icon | gear | calendar-copy icon | refresh | "День" dropdown (day/week) | "Добавить" button (primary, outlined)
- **Master header**: avatar circle (initials, colored ring) + name below, centered above column
- **Time column**: left side, ~100px, hours labeled "12:00 ночи", "1:00 ночи"... "5:00 вечера" etc.
- **Current time**: red horizontal line spanning full width + red pill with current time ("7:08")
- **Past time**: darker/grayed background vs future (lighter hatched pattern for non-working hours)
- **Grid**: 1-hour rows, light horizontal dividers. Click on empty slot to create appointment
- **No visible appointments** in demo — but Fresha shows colored blocks with service name, client name, duration

### Dashboard Page (2x3 card grid)
Row 1:
- **Последние продажи** (Recent Sales): period selector "Последние 7 дней", big number "0 BHD", "Записи 2, Стоимость визитов 145 BHD", line chart with two series (Продажи purple, Записи green), date labels on x-axis
- **Предстоящие визиты** (Upcoming Visits): period "Следующие 7 дней", empty state with bar chart icon + "Ваш график пуст" + guidance text

Row 2:
- **Записи** (Appointments): chronological list with date badge (number + month), time, status pill ("Забронировано" in blue), service name, client name + duration
- **Последующие визиты на сегодня** (Today's follow-ups): empty state with calendar-clock icon + "На сегодня визиты не запланированы" + link "календарь"

Row 3:
- **Популярные услуги** (Popular services): table with columns: Услуга, В этом месяце, Прошлый месяц
- **Лучший сотрудник** (Top employee): empty state with trend icon + "Нет продаж в этом месяце"

**Card style**: dark bg (#000), rounded corners ~12px, subtle border (~0.8px #1a1a1a), title bold 18px, subtitle gray 14px

### Clients Section
- **List page**: title "Список клиентов" + count badge (2), description text, "Варианты" dropdown + "Добавить" button
- **Import banner**: purple gradient banner with faces collage, "Импортируйте список клиентов", "Импортировать" + "Подробнее" buttons, X close
- **Search bar**: "Имя, эл. почта или телефон" + "Фильтры" button + sort dropdown "Дата создания (от новых к старым)"
- **Table columns**: checkbox | Имя клиента (avatar + name + email) | Номер мобильного | Отзывы | Продажи | Дата создания | arrow
- **Client card (drawer)**: slides from right, ~50% width. Center: avatar + name + email + "Действия" dropdown + "Забронировать" button + meta (pronouns, birthday, created date). Right panel tabs: Обзор | Записи | Продажи | Данные клиента | Позиции | Документы | Кошелек | Лояльность | Отзывы. Overview shows: Кошелек (баланс), Сводка (всего продаж, записи count, оценка, отменено, неявка) in 2x2 stat cards

### Sales/Finance
- **Daily sales**: title + description + date nav ("Сегодня" + date), "Экспорт" dropdown + "Добавить"
- **Two side-by-side tables**: "Сводка трансакций" (Тип позиции | К-во продаж | К-во возвратов | Совокупная сумма) with rows: Услуги, Дополнения к услугам, Товары, Отправка, Подарочные карты, Абонементы. "Сводка о движении наличных" (Тип платежа | Собранные платежи | Выплаченные возвраты) rows: Наличные, Другое, Подарочные карты, Собранные платежи, Из них чаевые

### Services (Catalogue → Menu)
- **Split layout**: left panel "Категории" list with counts (Все категории 5, Брови и ресницы 4, Удаление волос 1, + Добавить категорию), right panel: category title + "Действия" dropdown, service cards with left cyan border accent, name + duration, price + 3-dot menu
- **Services shown**: Классическая заливка (1ч, 60 BHD), Объемное заполнение (1ч 15мин, 85 BHD), Оттенок бровей (15мин, 20 BHD), Гибридная заливка (1ч 15мин, 95 BHD)

### Analytics/Reports
- **Full-page layout**: title "Отчетность и аналитика" + count (53), "Добавить" button
- **Left sidebar**: Все отчеты (53), Избранное (0), Рабочие столы (3), Стандарт (45), Премиум (8), Настроить (0), Цели + Папки section + data connector
- **Category tabs**: Все отчеты | Продажи | Финансы | Записи | Команда | Клиенты | Ассортимент
- **Report cards**: icon + title + description + star favorite. Some marked "Премиум"
- **Reports listed**: Панель производительности, Панель онлайн присутствия, Панель лояльности, Сводка эффективности (Премиум)

### Add-ons
- **Card grid (3 columns)**: icon (colored square) + title + description + "Посмотреть" button
- **Cards**: Платежи, Премиум-поддержка (Пробная версия badge), Прогнозы, Google Ratings Boost, Лояльность клиентов, Разъем для передачи данных

### Settings (Setup)
- **Tabs**: Настройки | Присутствие в интернете | Маркетинг | Другое
- **Настройки tab (card grid 3x3)**: Настройки бизнеса, Планирование, Продажи, Клиенты, Выставление счетов, Команда, Анкеты, Платежи
- **Присутствие tab**: Профиль на маркетплейсе, Забронировать через Google, Бронируйте через Facebook и Instagram, Конструктор ссылок — with purple borders and "Посмотреть →" links

### Key Design Patterns
- **Flyout submenu** pattern for sidebar groups (not page navigation — flyout overlays current page)
- **Drawer** pattern for client card (slides from right, doesn't navigate away)
- **Card grid** for dashboards and settings (2x3, 3x3)
- **Split panel** for catalogue (categories left, items right)
- **Table with row click** for lists (clients, appointments)
- **Period selector** with "Последние X дней" dropdown on chart cards
- **Status pills**: "Забронировано" (blue bg), inline badges
- **Empty states**: icon + bold message + helpful guidance text + optional link
- **"Добавить" button**: always top-right, outlined style with dropdown arrow
- **"Экспорт"/"Варианты" buttons**: outlined, with dropdown arrow

---

## CRES-CA vs Fresha — Gap Audit (2026-04-11)

### CRITICAL ISSUES (blocking / broken)
| # | Issue | Fresha | CRES-CA | Severity |
|---|-------|--------|---------|----------|
| 1 | **Dashboard page is BLANK** | 2x3 card grid with live data | Empty white page, no cards rendered at all | CRITICAL |
| 2 | **Calendar has no current-time indicator** | Red line + time pill | No indicator | HIGH |
| 3 | **Calendar has no appointment blocks** | Colored blocks with client+service+duration | Empty grid only | HIGH |
| 4 | **Sidebar has tooltips, not flyout menus** | Hover → grouped flyout panel with submenu links | Hover → tiny tooltip label, direct nav only | HIGH |
| 5 | **No client card drawer** | Click client → right drawer with tabs (Overview/Appointments/Sales/Data/Documents/Wallet/Loyalty/Reviews) | Click client → navigates to separate page | MEDIUM |
| 6 | **Finance page shows "Продажи"** | Sidebar: "Sales" flyout with Daily Report/Appointments/Sales/Payments/Gift Cards/Memberships | Single page with tabs, no daily summary view | MEDIUM |
| 7 | **No import banner for clients** | Purple gradient banner "Import your clients" | Just empty state text | LOW |

### STRUCTURAL DIFFERENCES
| Feature | Fresha | CRES-CA | Action Needed |
|---------|--------|---------|---------------|
| Sidebar groups | Flyout submenus with grouped links | Direct links + tooltips | Rebuild sidebar with flyout pattern |
| Dashboard | 2x3 cards: sales chart, upcoming, appointments, follow-ups, popular services, top employee | Blank page (code exists but doesn't render) | Fix dashboard rendering, connect to Supabase |
| Client card | Right-side drawer with 9 tabs | Separate page /clients/[id] | Consider drawer pattern or tabbed page |
| Service menu | Split panel: categories left, services right, cyan border accent | Split panel works (matches Fresha!) | OK - needs data |
| Finance | "Daily sales" with 2 side-by-side tables | "Продажи" with empty list | Add daily summary view |
| Analytics | 53 reports, category tabs, favorites, folders | None visible | Future phase |
| Settings | Tabbed card grid (Настройки/Присутствие/Маркетинг/Другое) | Need to check | Audit settings page |
| Add-ons | 3-column card grid with icons | Need to check | Audit addons page |
| Calendar toolbar | Today + nav + team selector + filters + gear + copy + refresh + view + add | Similar layout present | Compare details |

### WHAT CRES-CA ALREADY DOES WELL
1. Services split-panel layout matches Fresha's pattern
2. Clients page has search + filter tabs (Все/Недавние/Постоянные/Неактивные)  
3. Finance page has "Варианты" + "+ Добавить" buttons like Fresha
4. Calendar toolbar structure is close to Fresha (Today/nav/date/name/filters/view/add)
5. Sidebar icon rail with active purple state matches
6. Header layout (logo left, search/analytics/notifications/avatar right) matches
7. Empty states exist with guidance text ("Пока нет клиентов — Добавьте первого клиента")

### PRIORITY FIX ORDER (as the Master Agent, this is what I'd fix first)
1. **Dashboard rendering** — why is it blank? Fix immediately, it's the HOME page
2. **Calendar appointment blocks** — without visible appointments, the calendar is useless
3. **Calendar current-time indicator** — red line, essential for orientation
4. **Sidebar flyout menus** — the entire navigation experience differs from Fresha
5. **Client card enhancement** — drawer or at minimum tabbed layout
6. **Finance daily summary** — two-table layout like Fresha
7. **Role-based sidebar** — hide team items for solo masters

---

## Design Decisions Log
> Every style, color, spacing, layout choice with reasoning.

_(no entries yet — agent will populate during work sessions)_

---

## Component Registry
> Every component in the master sector, its purpose, current state, and issues.

### Sidebar & Header
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Dashboard Layout | `(dashboard)/layout.tsx` | done | Fresha-clone sidebar 72px, header 65px |
| Fresha Icons | `components/shared/fresha-icons.tsx` | done | Custom SVG icon set |
| Command Palette | `components/shared/primitives/command-palette.tsx` | done | Ctrl+K search |
| Onboarding Dialog | `components/shared/onboarding-dialog.tsx` | done | First-time setup |

### Main Pages
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Dashboard Overview | `(dashboard)/dashboard/page.tsx` | exists | Fresha-style cards, empty data |
| Calendar | `(dashboard)/calendar/page.tsx` | exists | Large file, needs analysis |
| Clients List | `(dashboard)/clients/page.tsx` | exists | Search, filters, table |
| Client Detail | `(dashboard)/clients/[id]/page.tsx` | exists | — |
| Client Loyalty | `(dashboard)/clients/loyalty/page.tsx` | exists | — |
| Client Segments | `(dashboard)/clients/segments/page.tsx` | exists | — |
| Services | `(dashboard)/services/page.tsx` | exists | — |
| Services Products | `(dashboard)/services/products/page.tsx` | exists | — |
| Services Memberships | `(dashboard)/services/memberships/page.tsx` | exists | — |
| Finance | `(dashboard)/finance/page.tsx` | exists | — |
| Finance Daily | `(dashboard)/finance/daily/page.tsx` | exists | — |
| Finance Payments | `(dashboard)/finance/payments/page.tsx` | exists | — |
| Finance Appointments | `(dashboard)/finance/appointments/page.tsx` | exists | — |
| Finance Reports | `(dashboard)/finance/reports/page.tsx` | exists | — |
| Finance Gift Cards | `(dashboard)/finance/gift-cards/page.tsx` | exists | — |
| Finance Memberships | `(dashboard)/finance/memberships/page.tsx` | exists | — |
| Inventory | `(dashboard)/inventory/page.tsx` | exists | — |
| Marketing Hub | `(dashboard)/marketing/page.tsx` | exists | — |
| Marketing Profile | `(dashboard)/marketing/profile/page.tsx` | exists | — |
| Marketing Reviews | `(dashboard)/marketing/reviews/page.tsx` | exists | — |
| Marketing Deals | `(dashboard)/marketing/deals/page.tsx` | exists | — |
| Marketing Social | `(dashboard)/marketing/social/page.tsx` | exists | — |
| Marketing Campaigns | `(dashboard)/marketing/campaigns/page.tsx` | exists | — |
| Marketing Automation | `(dashboard)/marketing/automation/page.tsx` | exists | — |
| Marketing Messages | `(dashboard)/marketing/messages/page.tsx` | exists | — |
| Marketing Links | `(dashboard)/marketing/links/page.tsx` | exists | — |
| Marketing Google | `(dashboard)/marketing/google/page.tsx` | exists | — |
| Marketing Pricing | `(dashboard)/marketing/pricing/page.tsx` | exists | — |
| Marketing Products | `(dashboard)/marketing/products/page.tsx` | exists | — |
| Settings | `(dashboard)/settings/page.tsx` | exists | — |
| Settings Team | `(dashboard)/settings/team/page.tsx` | exists | HIDE for solo |
| Settings Shifts | `(dashboard)/settings/team/shifts/page.tsx` | exists | HIDE for solo |
| Settings Timesheets | `(dashboard)/settings/team/timesheets/page.tsx` | exists | HIDE for solo |
| Settings Payrun | `(dashboard)/settings/team/payrun/page.tsx` | exists | HIDE for solo |
| Settings Equipment | `(dashboard)/settings/equipment/page.tsx` | exists | — |
| Settings Locations | `(dashboard)/settings/locations/page.tsx` | exists | HIDE for solo (1 location) |
| Queue | `(dashboard)/queue/page.tsx` | exists | — |
| Addons | `(dashboard)/addons/page.tsx` | exists | — |

---

## Cross-Sector Connections
> How master sector connects to client and salon sectors.

| Connection | From (Master) | To (Client/Salon) | Status |
|------------|---------------|-------------------|--------|
| Client books → appears on calendar | Client: book/ | calendar/page.tsx | ? |
| Appointment complete → client history | calendar | Client: history/ | ? |
| Service catalog → client sees services | services/ | Client: masters/[id] | ? |
| Review from client | Client: post-visit | marketing/reviews | ? |
| Product recommendation → client shop | marketing/products | Client: shop/ | ? |
| Burning slot promo → client notification | calendar (empty slot) | Client: feed/ | ? |
| Guild referral → cross-marketing | marketing/ | Other masters | ? |
| Upgrade to salon → salon agent takes over | settings/ | Salon sector | ? |
| Inventory auto-deduct → after appointment | inventory/ | calendar (complete) | ? |
| AI voice note → client card update | AI lib | clients/[id] | ? |

---

## Improvement Ideas

1. **Calendar should be the default landing page** — not dashboard. Most masters open app to check "who's next". Dashboard is secondary.
2. **Sidebar should hide team items for solo** — currently all flyout items show regardless of role. Team, Shifts, Payrun should be invisible for solo masters.
3. **Client card drawer needs tabs like Fresha** — our client/[id] is a separate page. Consider drawer pattern instead (or at minimum, tabbed layout on the page).
4. **Dashboard cards need real-time data** — currently all show empty. Need to connect to Supabase queries.
5. **Finance daily view should match Fresha's two-table layout** — transaction summary + cash flow summary side by side.
6. **Services page should use split layout** — categories left, services right (like Fresha), not a flat list.
7. **Add command palette (Ctrl+K) integration** — search across clients, services, appointments from anywhere.
8. **Calendar needs appointment blocks** — colored service blocks with client name, time, duration visible at a glance.
9. **Add "Burning slot" detection** — when calendar has gaps tomorrow, show alert on dashboard + suggest promo.
10. **Connect inventory to services** — auto-deduction recipes so finishing an appointment auto-decrements stock.
11. **AI voice notes button** — floating mic button in client card to record voice memo.
12. **"Repeat" button on completed appointments** — template with pre-filled client+service+duration.

---

## Bugs & Issues Found

1. **Dashboard shows all zeros** — no data queries connected, everything says "0" and "Ваш график пуст"
2. **Calendar page is very large file** — 16000+ tokens, potentially slow to render and hard to maintain
3. **Sidebar flyout behavior untested** — CRES-CA sidebar has flyouts but unclear if they work exactly like Fresha's hover pattern
4. **Dark theme color inconsistency** — dashboard cards use different dark values (#000 vs #0d0d0d) in different components
5. **No role-based sidebar filtering** — team items show for all users regardless of solo/salon role

---

## Styles & Tokens
> Colors, fonts, spacing specific to master dashboard.

| Token | Value | Usage |
|-------|-------|-------|
| Sidebar width | 72px | Collapsed sidebar rail |
| Header height | 65px | Top bar |
| Sidebar active bg | #6950f3 | Active nav item |
| Sidebar bg (light) | #0d0d0d | Dark sidebar on light theme |
| Sidebar bg (dark) | #000000 | Dark sidebar on dark theme |
| Font family | Roobert PRO, AktivGroteskVF | Primary font |
| Card border (light) | 0.8px solid #e0e0e0 | Dashboard cards |
| Card border (dark) | 0.8px solid #1a1a1a | Dashboard cards |
| Accent purple | #6950f3 | Links, active states |
| Success green | #22c55e | Positive metrics |
| Alert red | — | Health warnings, cancellations |

---

## Fresha Patterns to Clone / Improve

### CLONE (Fresha does this well)
1. **Sidebar flyout menus** — grouped submenu on hover, doesn't navigate away from current page. Clean, non-intrusive
2. **Client card as drawer** — right slide panel with tabs. User never leaves client list context
3. **Calendar current-time indicator** — red line + time pill, very visible
4. **Dashboard 2x3 card grid** — balanced, glanceable, each card has its own period selector
5. **Service catalogue split layout** — categories left, services right with accent border
6. **Empty states** — always icon + bold message + guidance + link to action. Never just "No data"
7. **Consistent "Добавить" button** — always top-right, always outlined, always with dropdown
8. **Status pills** — colored badges inline (Забронировано=blue, etc.)
9. **Table with row click → drawer** — client list click opens card without page change
10. **Reports with category tabs + search** — 53 reports organized into Продажи/Финансы/Записи/Команда/Клиенты/Ассортимент

### IMPROVE (where CRES-CA should be BETTER than Fresha)
1. **Calendar "Repeat" button** — Fresha doesn't have one-tap repeat for completed appointments. We do.
2. **Health alerts on calendar** — RED ! icon on appointments with client allergies/contraindications. Fresha doesn't do this.
3. **Voice notes → AI text** — Fresha has no voice input. We have AI transcription for lazy after-visit notes.
4. **Smart rebooking suggestions** — "Marina usually comes every 21 days, no booking yet" push. Fresha doesn't predict.
5. **Before/After photo slider** — AI-aligned comparison. Fresha only has basic file upload.
6. **Barcode scanning** — scan product ampule, save batch + expiry to client card. Fresha can't do this.
7. **Real profit calculator** — cost per drop of gel polish. Fresha's finance is revenue-only.
8. **Currency tracking** — auto-recalculate service cost when EUR/USD changes. Fresha doesn't track.
9. **Burning slots** — auto-detect empty slots → suggest promo. Fresha has "deals" but not auto-detection.
10. **Auto-upsell at booking** — McDonald's-style "add SPA hand care?" Fresha doesn't auto-suggest.
11. **Cross-marketing guilds** — masters recommend each other with automatic bonuses. Fresha has nothing like this.
12. **Client blacklist across masters** — "this client cancelled 3 times at other salons." Fresha is siloed.
13. **Telegram Mini App** — native mobile experience in Telegram. Fresha has no Telegram integration.
14. **Digital consent forms** — in-app signing before complex procedures with auto-allergy inclusion. Fresha has basic forms but not auto-allergy.
15. **Equipment resource tracking** — laser pulses, lamp hours with maintenance alerts. Fresha tracks inventory but not equipment lifecycle.

---

## Session Log

### 2026-04-11 — Initial Fresha Audit
- **What**: Full audit of Fresha partner dashboard (partners.fresha.com)
- **Screens analyzed**: Calendar (day view), Dashboard (2x3 cards), Clients (list + card drawer), Sales (daily report), Services (catalogue split), Online Booking (flyout), Marketing (flyout), Team (flyout), Analytics (53 reports page), Add-ons (card grid), Settings (tabbed card grid)
- **Key findings**: 12 sidebar items, flyout submenu pattern, client drawer pattern, 2x3 dashboard grid, split-panel catalogue
- **Recorded**: 10 patterns to clone, 15 improvements over Fresha, 12 improvement ideas, 5 bugs found
- **Next steps**: Audit CRES-CA current state vs Fresha findings, then start fixing top-priority issues
