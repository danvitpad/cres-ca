# PHASE 21: FINANCE ADVANCED

> Per-procedure cost calculator, currency tracking, auto-reports, revenue goals, recurring expenses

- [x] **21.1 — Procedure cost calculator**
  - **Create:** `src/components/shared/cost-calculator.tsx`
  - **What:** On service edit form, expandable "Profitability" section:
    - List all `inventory_recipe` items with name × quantity × cost_per_unit = subtotal
    - Sum = total material cost
    - `price - material_cost = gross profit`
    - Margin % shown as colored badge (green >60%, yellow 30-60%, red <30%)
  - **Finance dashboard widget:** "Service profitability ranking" — bar chart sorted by margin. Red highlight on services at a loss.

- [x] **21.2 — Currency rate tracking**
  - **Create:** `src/lib/currency/rates.ts`
  - **What:** Fetch rates from NBU open API (`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json`) — free. Cache in Supabase (`currency_rates` table). Refresh daily.
  - **Migration:** Add `purchase_currency` to `inventory_items`.
  - **UI:** If `purchase_currency != master's default`, show converted: "Bought at 45 PLN = 495 UAH (rate: 11.0)". Warning if rate changed >10%.
  - **Gated by:** Business tier

- [x] **21.3 — Financial reports export**
  - **Create:** `src/app/api/reports/monthly/route.ts` — generates CSV with revenue by category, expenses by category, tax estimate (master's `tax_rate_percent`, default 5% for ФОП), net profit, inventory usage + cost.
  - **Create:** `src/app/[locale]/(dashboard)/finance/reports/page.tsx` — month picker, "Generate Report", download link. Last 12 months history.
  - **Monthly cron:** Auto-generate on 1st of each month.
  - **Note:** Only financial data exportable. Client lists/history/notes NOT exportable — platform-retained.
  - **Gated by:** Business tier

- [x] **21.4 — Revenue goals**
  - **Migration:** `alter table masters add column monthly_revenue_goal numeric(10,2);`
  - **Create:** `src/components/shared/revenue-goal.tsx`
  - **What:** Finance dashboard progress bar: "April goal: 32,000 / 50,000 UAH (64%)". Below: "You need ~7 more clients at your avg check of 2,571₴. You have 14 free slots remaining this month." Colors: green on track, yellow behind, red >30% behind.
  - **Gamification:** When goal reached, confetti + notification.

- [x] **21.5 — Recurring expenses**
  - **Migration:**
    ```sql
    alter table expenses add column is_recurring boolean not null default false;
    alter table expenses add column recurrence_interval text check (recurrence_interval in ('weekly', 'monthly', 'quarterly', 'yearly'));
    alter table expenses add column next_recurrence_date date;
    ```
  - **What:** Toggle "Recurring" on expense. Select interval. System auto-creates on each recurrence date. Master sees "Monthly total: X₴" summary. Can pause or stop.
  - **Cron:** `src/app/api/cron/recurring-expenses/route.ts` — daily.

- [x] **21.6 — Verify Phase 21**
  - Cost calculator shows per-service profitability. Currency rates fetch and display. Reports generate and download. Revenue goal progress bar works. Recurring expenses auto-create.
  - `npm run build` passes
