# PHASE 7: FINANCE & INVENTORY

> Revenue tracking, expense management, inventory auto-deduction

- [x] **7.1 — Finance dashboard**
  - **Modify:** `src/app/[locale]/(dashboard)/finance/page.tsx`
  - **What:** Cards showing: today's revenue, this week, this month. Table of recent payments. Revenue breakdown by service (bar chart or simple list).
  - **Data:** Aggregate from `payments` table where `master_id = current` and `status = 'completed'`
  - **Period selector:** Today / This Week / This Month / Custom range
  - **Charts:** Use a simple bar chart (can use CSS divs, no chart library needed)

- [x] **7.2 — Expense tracking**
  - **Add to finance page:** "Add Expense" button. Expenses table with: date, description, amount, category.
  - **Create:** `supabase/migrations/00003_expenses.sql` — new `expenses` table:
    ```sql
    create table expenses (
      id uuid primary key default uuid_generate_v4(),
      master_id uuid references masters(id) on delete cascade,
      salon_id uuid references salons(id) on delete cascade,
      description text not null,
      amount numeric(10,2) not null,
      currency text not null default 'UAH',
      category text,
      date date not null default current_date,
      created_at timestamptz not null default now()
    );
    ```
  - **Profit = Revenue - Expenses**

- [x] **7.3 — Inventory management**
  - **Modify:** `src/app/[locale]/(dashboard)/inventory/page.tsx`
  - **What:** Table of inventory items: name, quantity (with unit), cost/unit, low stock alert.
  - **Add item dialog:** name, quantity, unit (pcs/ml/g), cost_per_unit, low_stock_threshold, barcode (optional), expiry_date (optional)
  - **Low stock highlight:** If `quantity < low_stock_threshold`, show row in orange/red
  - **Gated by:** Pro+ tier

- [x] **7.4 — Auto-deduction on appointment completion**
  - **Modify:** appointment completion logic (from 4.6)
  - **What:** When appointment status → 'completed', read `services.inventory_recipe` and deduct from `inventory_items`.
  - **Recipe format:**
    ```json
    [
      { "item_id": "uuid-of-gel", "quantity": 2.5 },
      { "item_id": "uuid-of-gloves", "quantity": 2 }
    ]
    ```
  - **Insert into** `inventory_usage` for audit trail

- [x] **7.5 — Verify Phase 7**
  - Finance shows revenue. Expenses track. Inventory items CRUD. Auto-deduction works.
  - `npm run build` passes
