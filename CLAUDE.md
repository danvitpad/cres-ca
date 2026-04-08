cla# CRES-CA — Project Bible

> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> This document is the single source of truth for the CRES-CA project.
> Every AI agent, every developer, every session starts here.

---

## QUICK START — What Is This Project?

**CRES-CA** (cres-ca.com) is a **universal CRM platform for ANY service industry** — beauty salons, nail artists, dentists, massage therapists, plumbers, tutors. It connects **clients** with **masters** (service providers) and **salons** (multi-master businesses).

**We are a middleman.** We charge masters/salons a monthly subscription for the platform. Clients use it for free.

**Two interfaces:**
1. **Web app** (Next.js) — full-featured for all roles
2. **Telegram Mini App** — same web app loaded inside Telegram WebView

---

## HOW TO CONTINUE WORK

**CRITICAL: Before writing ANY code, do these steps:**

1. Read the **TASK TRACKER** section below
2. Find the first unchecked task (`- [ ]`)
3. Read its description completely
4. Implement ONLY that task
5. After implementation, mark it `- [x]` and verify with `npm run build`
6. Move to the next unchecked task

**DO NOT skip tasks. DO NOT reorder tasks. They have dependencies.**

**After completing a task, run:**
```bash
cd D:/Claude.cres-ca/app && npm run build 2>&1 | tail -20
```
If the build fails, fix ALL errors before moving to the next task.

---

## TECH STACK (exact versions — DO NOT change)

| What | Package | Version |
|------|---------|---------|
| Framework | `next` | 16.2.2 |
| React | `react` / `react-dom` | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | `tailwindcss` | 4.x |
| UI Kit | `shadcn` (base-ui) | 4.2.0 |
| Database | `@supabase/supabase-js` | 2.102.x |
| SSR Auth | `@supabase/ssr` | 0.10.x |
| i18n | `next-intl` | 4.9.x |
| State | `zustand` | 5.x |
| Validation | `zod` | 4.x |
| Icons | `lucide-react` | 1.7.x |
| Maps | `leaflet` + `react-leaflet` | 1.9.x / 5.x |
| Dates | `date-fns` | 4.x |
| Toasts | `sonner` | 2.x |
| Payments | LiqPay (custom integration) | — |
| AI | OpenRouter API (free models) | — |
| Telegram | Bot API + Mini App SDK | — |

---

## CRITICAL RULES — READ BEFORE EVERY TASK

### shadcn/ui v4 — NO asChild!
This project uses **shadcn v4 with @base-ui/react**. The `asChild` prop **DOES NOT EXIST**.

**WRONG:**
```tsx
<Button asChild><Link href="/x">Click</Link></Button>
```

**CORRECT — use `buttonVariants` for links:**
```tsx
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

<Link href="/x" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
  Click
</Link>
```

**CORRECT — use `render` prop for polymorphic rendering:**
```tsx
<Button render={<Link href="/x" />}>Click</Button>
```

### Next.js 16 — middleware → proxy
Next.js 16 shows warning: `"middleware" file convention is deprecated, use "proxy"`. **IGNORE this warning for now** — `next-intl` still uses middleware. This will be migrated later.

### next-intl — how to use translations
```tsx
// In Server Components:
import { useTranslations } from 'next-intl';
export default function Page() {
  const t = useTranslations('dashboard');
  return <h1>{t('title')}</h1>;
}

// In Client Components ('use client'):
import { useTranslations } from 'next-intl';
// Works the same way — next-intl v4 supports both
```

### Supabase — two clients, NEVER mix them
```tsx
// BROWSER (Client Components):
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// SERVER (Server Components, API routes, middleware):
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();  // NOTE: await!
```

### Subscription gating pattern
Every feature that is tier-limited MUST check the subscription:
```tsx
// Client Component:
import { useSubscription } from '@/hooks/use-subscription';
function MyFeature() {
  const { canUse } = useSubscription();
  if (!canUse('ai_features')) return <UpgradePrompt feature="ai_features" />;
  return <ActualFeature />;
}

// Server-side (API route):
import { hasFeature } from '@/types';
if (!hasFeature(userTier, 'ai_features')) {
  return Response.json({ error: 'Upgrade required' }, { status: 403 });
}
```

### File naming conventions
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase` in code, `kebab-case` filename
- All code, variables, comments: **English**
- All UI text: **NEVER hardcoded** — always through i18n: `t('key')`

### Import paths — always use `@/`
```tsx
import { Button } from '@/components/ui/button';  // YES
import { Button } from '../../../components/ui/button';  // NO
```

### Every new file MUST have a YAML header
```tsx
/** --- YAML
 * name: ComponentName
 * description: What this component does in one sentence
 * --- */
```

---

## PROJECT STRUCTURE

```
D:/Claude.cres-ca/app/          ← project root (run all commands here)
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── globals.css         ← Tailwind + shadcn theme (DO NOT modify unless changing colors)
│   │   ├── layout.tsx          ← Root HTML layout (fonts, metadata)
│   │   ├── [locale]/           ← i18n dynamic segment (uk/ru/en)
│   │   │   ├── layout.tsx      ← NextIntlClientProvider wrapper
│   │   │   ├── (landing)/      ← Public pages (no auth required)
│   │   │   │   └── page.tsx    ← Landing page [DONE]
│   │   │   ├── (auth)/         ← Login/Register pages
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/    ← Master/Salon admin panel (auth required)
│   │   │   │   ├── layout.tsx  ← Sidebar navigation [DONE]
│   │   │   │   ├── calendar/page.tsx   [STUB]
│   │   │   │   ├── clients/page.tsx    [STUB]
│   │   │   │   ├── services/page.tsx   [STUB]
│   │   │   │   ├── finance/page.tsx    [STUB]
│   │   │   │   ├── inventory/page.tsx  [STUB]
│   │   │   │   ├── marketing/page.tsx  [STUB]
│   │   │   │   └── settings/page.tsx   [STUB]
│   │   │   └── (client)/      ← Client-facing pages (auth required)
│   │   │       ├── layout.tsx  ← Bottom nav [DONE]
│   │   │       ├── book/page.tsx       [STUB]
│   │   │       ├── history/page.tsx    [STUB]
│   │   │       ├── masters/page.tsx    [STUB]
│   │   │       ├── map/page.tsx        [STUB]
│   │   │       └── profile/page.tsx    [STUB]
│   │   └── api/               ← API Route Handlers
│   │       ├── auth/callback/  ← Supabase auth callback
│   │       ├── telegram/       ← Bot webhook + Mini App validation
│   │       ├── payments/       ← LiqPay webhook
│   │       ├── ai/            ← OpenRouter proxy
│   │       └── cron/          ← Scheduled tasks
│   ├── components/
│   │   ├── ui/                ← shadcn components (auto-generated, don't edit)
│   │   ├── calendar/          ← Calendar components
│   │   ├── client-card/       ← Client card components
│   │   ├── booking/           ← Booking flow components
│   │   ├── landing/           ← Landing page sections
│   │   └── shared/            ← Shared: UpgradePrompt, FeatureGate, RatingStars, etc.
│   ├── lib/
│   │   ├── supabase/client.ts ← Browser Supabase client [DONE]
│   │   ├── supabase/server.ts ← Server Supabase client [DONE]
│   │   ├── supabase/admin.ts  ← Service-role client (for cron/webhooks)
│   │   ├── ai/               ← OpenRouter integration
│   │   ├── payments/          ← LiqPay integration
│   │   ├── telegram/          ← Telegram Bot + Mini App helpers
│   │   ├── i18n/config.ts    ← Locale list [DONE]
│   │   ├── i18n/request.ts   ← next-intl server config [DONE]
│   │   └── utils.ts          ← cn() utility [DONE]
│   ├── stores/
│   │   └── auth-store.ts     ← Zustand auth store [DONE]
│   ├── hooks/
│   │   └── use-subscription.ts ← Subscription check hook [DONE]
│   ├── types/
│   │   ├── index.ts           ← Core types + subscription config [DONE]
│   │   └── database.ts        ← Supabase generated types (auto)
│   ├── messages/
│   │   ├── uk.json            ← Ukrainian translations [DONE]
│   │   ├── ru.json            ← Russian translations [DONE]
│   │   └── en.json            ← English translations [DONE]
│   └── middleware.ts          ← next-intl locale routing [DONE]
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql  ← Full DB schema [DONE]
├── public/
├── next.config.ts             ← Next.js + next-intl config [DONE]
├── package.json
└── tsconfig.json
```

---

## DATABASE TABLES (reference)

All defined in `supabase/migrations/00001_initial_schema.sql`:

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | User accounts (extends auth.users) | role, full_name, phone, telegram_id, locale |
| `salons` | Multi-master businesses | owner_id, name, address, lat/lng |
| `subscriptions` | Subscription tracking | profile_id OR salon_id, tier, status, trial_ends_at |
| `masters` | Service providers | profile_id, salon_id?, specialization, rating, invite_code |
| `service_categories` | Groups for services | master_id/salon_id, name, color |
| `services` | Service catalog | master_id, name, duration_minutes, price, upsell_services, inventory_recipe |
| `clients` | Client cards (per master) | profile_id?, master_id, full_name, allergies[], behavior_indicators[] |
| `appointments` | Bookings | client_id, master_id, service_id, starts_at, ends_at, status |
| `equipment` | Shared resources (lasers etc.) | salon_id, name, total_resource, used_resource |
| `inventory_items` | Stock/consumables | master_id, name, quantity, unit, cost_per_unit |
| `inventory_usage` | Auto-deduction log | item_id, appointment_id, quantity_used |
| `payments` | Payment records | appointment_id, amount, type, status, liqpay_order_id |
| `reviews` | Anonymous ratings | target_type (master/client), score (1-5) |
| `referrals` | Referral tracking | referrer_client_id, referred_client_id, bonus_points |
| `consent_forms` | Digital consent | client_id, form_text, client_agreed |
| `client_files` | Photos/PDFs (Business tier) | client_id, file_url, is_before_photo, paired_with |
| `waitlist` | Slot waitlist | client_id, master_id, desired_date |
| `gift_certificates` | Gift codes | code, amount, is_redeemed |
| `guilds` | Master cross-marketing groups | name, created_by |
| `guild_members` | Guild membership | guild_id, master_id |
| `notifications` | Notification queue | profile_id, channel, title, body, status |
| `client_master_links` | Client follows master | profile_id, master_id |

---

## SUBSCRIPTION TIERS

| Feature | Starter $12 | Pro $29 | Business $49 |
|---------|:-----------:|:-------:|:------------:|
| Max clients | 50 | 300 | Unlimited |
| Max masters | 1 | 3 | Unlimited |
| Calendar + booking | YES | YES | YES |
| Client cards (basic) | YES | YES | YES |
| Reminders (24h, 2h) | YES | YES | YES |
| Basic finance stats | YES | YES | YES |
| Waitlist | — | YES | YES |
| Auto-upsell | — | YES | YES |
| Referral system | — | YES | YES |
| Inventory | — | YES | YES |
| Consent forms | — | YES | YES |
| Allergies tracking | — | YES | YES |
| Extended analytics | — | YES | YES |
| Auto-messages | — | YES | YES |
| AI features | — | — | YES |
| Behavior indicators | — | — | YES |
| File storage | — | — | YES |
| Equipment booking | — | — | YES |
| Cross-marketing | — | — | YES |
| Auto-reports | — | — | YES |
| Currency tracking | — | — | YES |
| Before/After slider | — | — | YES |
| Gift certificates | — | — | YES |

**Trial = 14 days with ALL features unlocked.**

Subscription config is in `src/types/index.ts` — `SUBSCRIPTION_CONFIG` object.

---

## ENVIRONMENT VARIABLES

Create `.env.local` in project root (`D:/Claude.cres-ca/app/.env.local`):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=CresCABot

# LiqPay
LIQPAY_PUBLIC_KEY=sandbox_...
LIQPAY_PRIVATE_KEY=sandbox_...

# Resend (email)
RESEND_API_KEY=re_...

# OpenRouter (AI)
OPENROUTER_API_KEY=sk-or-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=uk
```

---

## ============================================================
## TASK TRACKER — THE MASTER PLAN
## ============================================================

**STATUS LEGEND:**
- `[x]` = DONE and verified with `npm run build`
- `[ ]` = TODO — implement in order

**RULES:**
1. Complete tasks **in order** — they have dependencies
2. After each task, run `npm run build` — fix ALL errors
3. Mark completed tasks with `[x]`
4. If a task says "create file X" — check if X already exists first
5. NEVER delete or rename existing working files without explicit instruction

---

### PHASE 0: FOUNDATION (COMPLETED)
> Project setup, config, skeleton pages

- [x] **0.1** Initialize Next.js 15 project with TypeScript, Tailwind, ESLint
- [x] **0.2** Install dependencies: supabase, next-intl, zustand, zod, leaflet, date-fns, lucide-react
- [x] **0.3** Initialize shadcn/ui and add base components
- [x] **0.4** Configure next-intl (config, request, middleware)
- [x] **0.5** Create translation files (uk.json, ru.json, en.json)
- [x] **0.6** Create root layout + locale layout with NextIntlClientProvider
- [x] **0.7** Create Supabase client (browser) and server helpers
- [x] **0.8** Create TypeScript types (roles, subscriptions, features)
- [x] **0.9** Create auth Zustand store + useSubscription hook
- [x] **0.10** Create landing page with hero, features, pricing
- [x] **0.11** Create dashboard layout (sidebar nav)
- [x] **0.12** Create client layout (bottom nav)
- [x] **0.13** Create stub pages for all routes
- [x] **0.14** Create database migration SQL (all tables, indexes, RLS)
- [x] **0.15** Verify build passes

---

### PHASE 1: AUTH SYSTEM
> User registration, login, session management, role routing

- [x] **1.1 — Auth layout page**
  - **Create:** `src/app/[locale]/(auth)/layout.tsx`
  - **What:** A centered card layout for login/register pages. No sidebar, no bottom nav. Just a centered container with CRES-CA logo on top.
  - **Pattern:**
    ```tsx
    export default function AuthLayout({ children }: { children: React.ReactNode }) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">CRES-CA</h1>
            </div>
            {children}
          </div>
        </div>
      );
    }
    ```

- [x] **1.2 — Register page**
  - **Create:** `src/app/[locale]/(auth)/register/page.tsx`
  - **What:** Registration form with: full_name, email, password, role selector (client/master/salon_admin), phone (optional). Uses Supabase `auth.signUp()`.
  - **UI:** Use Card, Input, Label, Select from shadcn. All text through `t('auth.xxx')`.
  - **Logic:**
    1. Call `supabase.auth.signUp({ email, password, options: { data: { full_name, role, phone } } })`
    2. On success, show "Check your email" message (Supabase sends confirmation)
    3. On error, show error via `sonner` toast
  - **Add translations** to all 3 locale files: `auth.fullName`, `auth.phone`, `auth.selectRole`, `auth.roleMaster`, `auth.roleClient`, `auth.roleSalon`, `auth.checkEmail`

- [x] **1.3 — Login page**
  - **Create:** `src/app/[locale]/(auth)/login/page.tsx`
  - **What:** Login form with email + password. Link to register. Link to forgot password.
  - **Logic:**
    1. Call `supabase.auth.signInWithPassword({ email, password })`
    2. On success, redirect based on role:
       - `client` → `/book`
       - `master` → `/calendar`
       - `salon_admin` → `/calendar`
    3. Read role from `profiles` table after login
  - **Pattern for redirect after login:**
    ```tsx
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'client') router.push('/book');
    else router.push('/calendar');
    ```

- [x] **1.4 — Auth callback route**
  - **Create:** `src/app/api/auth/callback/route.ts`
  - **What:** Handles Supabase email confirmation callback. Exchanges code for session.
  - **Exact code:**
    ```tsx
    import { createClient } from '@/lib/supabase/server';
    import { NextResponse } from 'next/server';

    export async function GET(request: Request) {
      const { searchParams, origin } = new URL(request.url);
      const code = searchParams.get('code');
      const next = searchParams.get('next') ?? '/';

      if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
    ```

- [x] **1.5 — Profile auto-creation trigger**
  - **Create:** `supabase/migrations/00002_auth_trigger.sql`
  - **What:** After a user signs up in Supabase Auth, auto-create a row in `profiles` table with their role and name from auth metadata.
  - **SQL:**
    ```sql
    create or replace function public.handle_new_user()
    returns trigger as $$
    begin
      insert into public.profiles (id, role, full_name, phone)
      values (
        new.id,
        coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'),
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        new.raw_user_meta_data->>'phone'
      );
      -- If role is master, also create a master record
      if (new.raw_user_meta_data->>'role') = 'master' then
        insert into public.masters (profile_id)
        values (new.id);
      end if;
      -- If role is salon_admin, create salon + master record
      if (new.raw_user_meta_data->>'role') = 'salon_admin' then
        declare
          new_salon_id uuid;
        begin
          insert into public.salons (owner_id, name)
          values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'My Salon'))
          returning id into new_salon_id;

          insert into public.masters (profile_id, salon_id)
          values (new.id, new_salon_id);
        end;
      end if;
      -- Create trial subscription
      insert into public.subscriptions (profile_id, tier, status, trial_ends_at, current_period_end)
      values (new.id, 'trial', 'active', now() + interval '14 days', now() + interval '14 days');
      return new;
    end;
    $$ language plpgsql security definer;

    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    ```

- [x] **1.6 — Auth state provider**
  - **Create:** `src/components/shared/auth-provider.tsx`
  - **What:** A client component that wraps the app and:
    1. On mount, calls `supabase.auth.getSession()`
    2. Fetches profile + subscription from DB
    3. Sets Zustand auth store (userId, role, tier)
    4. Listens to `onAuthStateChange` for login/logout events
  - **Pattern:**
    ```tsx
    'use client';
    import { useEffect } from 'react';
    import { createClient } from '@/lib/supabase/client';
    import { useAuthStore } from '@/stores/auth-store';

    export function AuthProvider({ children }: { children: React.ReactNode }) {
      const { setAuth, clearAuth, setLoading } = useAuthStore();

      useEffect(() => {
        const supabase = createClient();

        async function loadSession() {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles').select('role').eq('id', session.user.id).single();
            const { data: sub } = await supabase
              .from('subscriptions').select('tier').eq('profile_id', session.user.id).single();
            if (profile && sub) {
              setAuth(session.user.id, profile.role, sub.tier);
            }
          } else {
            clearAuth();
          }
        }

        loadSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) clearAuth();
          else loadSession();
        });

        return () => subscription.unsubscribe();
      }, [setAuth, clearAuth, setLoading]);

      return <>{children}</>;
    }
    ```
  - **Then:** Add `<AuthProvider>` to `src/app/[locale]/layout.tsx` wrapping children inside `<NextIntlClientProvider>`.

- [x] **1.7 — Route protection middleware**
  - **Modify:** `src/middleware.ts`
  - **What:** After locale routing, check if user is authenticated for protected routes (`/calendar`, `/clients`, `/finance`, `/book`, etc.). Redirect to `/login` if not.
  - **Important:** The current middleware handles i18n only. We need to ALSO check Supabase session. Use `@supabase/ssr` `createServerClient` in middleware.
  - **Protected route groups:** `(dashboard)/*` and `(client)/*`
  - **Public routes:** `(landing)/*`, `(auth)/*`, `/api/*`

- [x] **1.8 — Sign out functionality**
  - **Add** a sign-out button to dashboard layout (sidebar bottom) and client layout (profile page)
  - **Logic:** `await supabase.auth.signOut()` then `router.push('/login')`

- [x] **1.9 — Verify auth flow end-to-end**
  - **Test:** Register → Confirm email → Login → See dashboard/client UI → Logout → Redirected to login
  - **Build:** `npm run build` must pass

---

### PHASE 2: MASTER ONBOARDING + SERVICE CATALOG
> Masters configure their profile, working hours, and services

- [x] **2.1 — Master profile form**
  - **Modify:** `src/app/[locale]/(dashboard)/settings/page.tsx`
  - **What:** Form to edit master profile: specialization, bio, address, city, working hours (JSON editor or day-by-day picker), avatar upload.
  - **Data flow:** Read from `masters` table JOIN `profiles`. Save to both tables.
  - **Working hours format:**
    ```json
    {
      "monday": { "start": "09:00", "end": "18:00", "break_start": "13:00", "break_end": "14:00" },
      "tuesday": { "start": "09:00", "end": "18:00" },
      "wednesday": null,
      "thursday": { "start": "10:00", "end": "20:00" },
      "friday": { "start": "09:00", "end": "17:00" },
      "saturday": { "start": "10:00", "end": "15:00" },
      "sunday": null
    }
    ```
  - **UI:** Tabs component — "Profile", "Working Hours", "Subscription", "Team" (if salon)

- [x] **2.2 — Service management CRUD**
  - **Modify:** `src/app/[locale]/(dashboard)/services/page.tsx`
  - **What:** Full CRUD for services:
    - List all services in a table/card grid
    - "Add Service" button opens Dialog with form: name, category, duration (minutes), price, currency, color, prepayment toggle
    - Edit/delete buttons on each service
    - Service categories: create inline or from dropdown
  - **Data flow:** Insert/update/delete in `services` table filtered by current master's `master_id`
  - **Validation (Zod):**
    ```tsx
    const serviceSchema = z.object({
      name: z.string().min(1),
      duration_minutes: z.number().int().min(5).max(480),
      price: z.number().min(0),
      currency: z.string().default('UAH'),
      category_id: z.string().uuid().optional(),
      requires_prepayment: z.boolean().default(false),
      prepayment_amount: z.number().min(0).default(0),
    });
    ```

- [x] **2.3 — Service categories**
  - **Create:** `src/components/shared/category-manager.tsx`
  - **What:** A small component for creating/editing service categories (name + color). Used inside the services page.
  - **Data:** `service_categories` table

- [x] **2.4 — Invite link generation**
  - **Add to settings page:** Show master's invite link: `https://cres-ca.com/invite/{invite_code}`
  - **Also show:** Telegram deep link: `https://t.me/{BOT_USERNAME}?start=master_{invite_code}`
  - **Copy button** using navigator.clipboard
  - **Data:** Read `invite_code` from `masters` table

- [x] **2.5 — Verify Phase 2**
  - Master can log in, see settings, edit profile, add/edit/delete services, see invite link
  - `npm run build` passes

---

### PHASE 3: CLIENT MANAGEMENT
> Client cards, search, allergies, notes, behavior indicators

- [x] **3.1 — Client list with search and pagination**
  - **Modify:** `src/app/[locale]/(dashboard)/clients/page.tsx`
  - **What:** Table of clients with columns: name, phone, total visits, avg check, last visit, rating
  - **Search:** Filter by name or phone (client-side filter for <100 clients, Supabase `ilike` for more)
  - **Pagination:** Load 20 at a time, "Load more" button
  - **Data:** `clients` table where `master_id = currentMasterId`
  - **"Add Client" button** opens a dialog with form: full_name, phone, email, date_of_birth, notes

- [x] **3.2 — Client card detail page**
  - **Create:** `src/app/[locale]/(dashboard)/clients/[id]/page.tsx`
  - **What:** Full client card with tabs:
    - **Info:** Name, phone, email, DOB, rating, behavior indicators (icons), referral code
    - **History:** List of past appointments (date, service, price, status) with "Repeat" button
    - **Notes:** Editable text area for freeform notes
    - **Health:** Allergies (tag input), contraindications (tag input), `has_health_alert` toggle
    - **Files:** (Business tier only) Upload/view photos and PDFs. Before/After pairing.
  - **Repeat booking button:** Clicking creates a new appointment pre-filled with same client + service + duration. User only picks date/time.
  - **Data:** Read from `clients` + `appointments` + `client_files` tables

- [x] **3.3 — Tag input component for allergies**
  - **Create:** `src/components/shared/tag-input.tsx`
  - **What:** A text input where you type and press Enter to add tags. Tags appear as removable badges. Returns `string[]`.
  - **Usage:** For allergies and contraindications on client card.

- [x] **3.4 — Behavior indicator icons**
  - **Create:** `src/components/shared/behavior-indicators.tsx`
  - **What:** Shows small icons next to client name (visible only to masters with Business tier):
    - `frequent_canceller` → red X icon with tooltip "Often cancels"
    - `often_late` → orange clock icon with tooltip "Often late"
    - `rude` → red warning icon with tooltip "Difficult client"
    - `excellent` → green star icon with tooltip "Excellent client"
  - **Gated by:** `canUse('behavior_indicators')`

- [x] **3.5 — Health alert indicator on calendar**
  - **What:** If a client has `has_health_alert = true`, show a red exclamation mark on their appointment in the calendar (implemented in Phase 4)
  - **For now:** Just ensure the client card correctly saves `has_health_alert` when allergies/contraindications are not empty

- [x] **3.6 — File upload for client card (Business tier)**
  - **Create:** `src/components/client-card/file-upload.tsx`
  - **What:** Upload photos/PDFs to Supabase Storage. Save reference in `client_files` table.
  - **Gated by:** `canUse('file_storage')`
  - **Storage bucket:** `client-files` (create in Supabase dashboard)
  - **Pattern:**
    ```tsx
    const { data, error } = await supabase.storage
      .from('client-files')
      .upload(`${clientId}/${Date.now()}_${file.name}`, file);
    ```

- [x] **3.7 — Verify Phase 3**
  - Can add/edit/search clients. Client card shows all tabs. Allergies save. Files upload (Business).
  - `npm run build` passes

---

### PHASE 4: CALENDAR & APPOINTMENTS
> Visual calendar, booking, drag-and-drop, status management

- [x] **4.1 — Calendar data fetching hook**
  - **Create:** `src/hooks/use-appointments.ts`
  - **What:** Custom hook that fetches appointments for a given date range from Supabase.
  - **Pattern:**
    ```tsx
    export function useAppointments(masterId: string, startDate: Date, endDate: Date) {
      // Fetch from 'appointments' table with JOIN on clients and services
      // Return { appointments, isLoading, refetch }
    }
    ```

- [x] **4.2 — Day view calendar component**
  - **Create:** `src/components/calendar/day-view.tsx`
  - **What:** A vertical timeline from working hours start to end. Each appointment is a colored block showing:
    - Client name
    - Service name
    - Time (start-end)
    - Status badge (color-coded)
    - Red exclamation if client has health alert
  - **Time slots:** 30-minute grid lines
  - **Color coding:** Use service color from `services.color`
  - **Empty slots:** Shown as clickable areas → clicking opens "New Appointment" dialog

- [x] **4.3 — Week view calendar component**
  - **Create:** `src/components/calendar/week-view.tsx`
  - **What:** 7-column grid (Mon-Sun). Each column is a mini day-view. Appointments shown as compact blocks.
  - **Responsive:** On mobile, show horizontal scrollable view

- [x] **4.4 — Calendar page integration**
  - **Modify:** `src/app/[locale]/(dashboard)/calendar/page.tsx`
  - **What:** Replace stub with:
    - Day/Week toggle tabs
    - Date navigation (prev/next day/week, "Today" button)
    - DayView or WeekView component based on selected tab
    - "New Appointment" floating action button (mobile) or header button

- [x] **4.5 — New appointment dialog**
  - **Create:** `src/components/calendar/new-appointment-dialog.tsx`
  - **What:** Dialog/Sheet with form:
    1. Select client (searchable combobox from client list) OR "New Client" inline
    2. Select service (dropdown — auto-fills duration and price)
    3. Select date (calendar picker)
    4. Select time (time picker — only show available slots based on working hours and existing appointments)
    5. Notes (optional textarea)
    6. Confirm button → inserts into `appointments` table
  - **Auto-upsell (Pro tier):** After selecting a service, show upsell suggestions from `services.upsell_services[]` as checkboxes: "Add SPA care +15min +$X?"
  - **Equipment check (Business tier):** If service requires equipment, check `equipment` table for availability at selected time

- [x] **4.6 — Appointment status management**
  - **Create:** `src/components/calendar/appointment-actions.tsx`
  - **What:** Clicking an appointment in the calendar opens a popover/sheet with:
    - Client name + phone (clickable to open client card)
    - Service details
    - Status dropdown: booked → confirmed → in_progress → completed
    - Cancel button (sets status to 'cancelled', increments client's `cancellation_count`)
    - No-show button (sets status to 'no_show', increments `no_show_count`)
    - "Repeat" button → opens new appointment dialog pre-filled with same client+service
  - **On completion:** Update client stats (total_visits++, total_spent += price, recalc avg_check, last_visit_at)
  - **On completion + inventory (Pro tier):** If service has `inventory_recipe`, auto-deduct from `inventory_items`

- [x] **4.7 — Drag-and-drop rescheduling**
  - **Modify:** `src/components/calendar/day-view.tsx`
  - **What:** Appointments can be dragged to different time slots. On drop, update `starts_at` and `ends_at` in DB.
  - **Implementation:** Use mouse/touch events (no extra library). Track drag start position, show ghost element, calculate new time on drop.
  - **Constraints:** Cannot overlap with other appointments. Cannot exceed working hours. Snap to 15-minute grid.

- [x] **4.8 — Verify Phase 4**
  - Calendar shows appointments. Can create/edit/cancel. Day and week views work. Status transitions work. Drag-drop works.
  - `npm run build` passes

---

### PHASE 5: CLIENT-FACING BOOKING
> Clients browse masters, select services, book appointments

- [x] **5.1 — Master public profile page**
  - **Create:** `src/app/[locale]/(client)/masters/[id]/page.tsx`
  - **What:** Public page showing master info: name, photo, specialization, bio, rating, reviews count. List of active services with prices. "Book" button on each service.
  - **Data:** Read from `masters` JOIN `profiles` JOIN `services` where `is_active = true`
  - **No auth required** to view. Auth required to book.

- [x] **5.2 — Booking flow page**
  - **Modify:** `src/app/[locale]/(client)/book/page.tsx`
  - **What:** Multi-step booking:
    1. **Step 1 — Service** (pre-selected if came from master profile)
    2. **Step 2 — Date** (calendar showing available dates based on master's working hours)
    3. **Step 3 — Time** (grid of available time slots for selected date)
    4. **Step 4 — Confirm** (summary + optional prepayment)
  - **Available slots calculation:**
    ```tsx
    // 1. Get master's working hours for selected weekday
    // 2. Get all appointments for that date
    // 3. Generate time slots (every 30min from start to end minus break)
    // 4. Filter out slots that overlap with existing appointments
    // 5. Filter out slots where remaining time < service duration
    ```
  - **Auto-upsell (Pro tier):** Show upsell checkboxes after service selection

- [x] **5.3 — Available slots API**
  - **Create:** `src/app/api/slots/route.ts`
  - **What:** GET endpoint: `/api/slots?master_id=X&date=YYYY-MM-DD&service_id=Y`
  - **Returns:** Array of available time strings `["09:00", "09:30", "10:00", ...]`
  - **Logic:** Same as 5.2 slot calculation but server-side for accuracy

- [x] **5.4 — Booking confirmation + prepayment**
  - **Create:** `src/components/booking/booking-summary.tsx`
  - **What:** Shows booking summary: service, date, time, price. If prepayment required, show LiqPay button (Phase 8). If no prepayment, just "Confirm" button.
  - **On confirm:**
    1. Insert into `appointments` (status: 'booked')
    2. Create `notifications` record for master (new booking alert)
    3. Create `notifications` record for client (booking confirmation)
    4. If client came via referral, track in `referrals` table

- [x] **5.5 — Waitlist (Pro tier)**
  - **Create:** `src/components/booking/waitlist-button.tsx`
  - **What:** If no slots available for desired date, show "Join Waitlist" button. Inserts into `waitlist` table.
  - **Gated by:** master must have Pro+ tier

- [x] **5.6 — Client booking history**
  - **Modify:** `src/app/[locale]/(client)/history/page.tsx`
  - **What:** List of all client's past and future appointments. Each shows: master name, service, date/time, status, price. "Repeat" button on completed ones.
  - **Data:** `appointments` WHERE `client_id IN (clients WHERE profile_id = current_user)`

- [x] **5.7 — Repeat booking (template)**
  - **Logic:** "Repeat" button on past appointment → navigates to booking flow with pre-filled master_id + service_id. Client only picks new date/time. Same flow as 5.2 but with pre-selection.

- [x] **5.8 — Verify Phase 5**
  - Client can browse masters, select service, pick date/time, book. History shows bookings. Repeat works.
  - `npm run build` passes

---

### PHASE 6: MAP + MASTER SEARCH
> OpenStreetMap integration, geolocation, master search

- [x] **6.1 — Leaflet map component (dynamic import)**
  - **Create:** `src/components/shared/map-view.tsx`
  - **What:** Leaflet map wrapped in `dynamic(() => import(...), { ssr: false })` because Leaflet doesn't support SSR.
  - **Props:** `markers: Array<{ lat, lng, name, rating, masterId }>`, `center`, `zoom`
  - **Important:** Must import Leaflet CSS: `import 'leaflet/dist/leaflet.css'`

- [x] **6.2 — Map page with nearby masters**
  - **Modify:** `src/app/[locale]/(client)/map/page.tsx`
  - **What:**
    1. Request user's geolocation via `navigator.geolocation`
    2. Fetch masters within radius from Supabase (use `latitude`/`longitude` columns)
    3. Show markers on map with popups (name, rating, specialization, "View" link)
  - **Supabase geo query:**
    ```sql
    -- In an RPC function or use PostGIS, or simple bbox filter:
    SELECT * FROM masters
    WHERE latitude BETWEEN $1 AND $2
    AND longitude BETWEEN $3 AND $4
    AND is_active = true
    ```

- [x] **6.3 — Master search page**
  - **Modify:** `src/app/[locale]/(client)/masters/page.tsx`
  - **What:** Search input (by name, phone, or invite code) + results list as cards.
  - **Each card:** Avatar, name, specialization, rating stars, city, distance (if geo available), "View" button

- [x] **6.4 — Verify Phase 6**
  - Map shows markers, geolocation works, search finds masters.
  - `npm run build` passes

---

### PHASE 7: FINANCE & INVENTORY
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

---

### PHASE 8: PAYMENTS (LiqPay)
> Prepayment for appointments, subscription payment

- [x] **8.1 — LiqPay integration library**
  - **Create:** `src/lib/payments/liqpay.ts`
  - **What:** Helper functions:
    - `createPaymentForm(orderId, amount, currency, description)` → returns { data, signature } for LiqPay checkout
    - `verifyCallback(data, signature)` → validates LiqPay server callback
  - **LiqPay API:** Base64-encode JSON payload, sign with SHA1(private_key + data + private_key)
  - **Docs:** https://www.liqpay.ua/documentation/api/aquiring/checkout

- [x] **8.2 — Prepayment flow**
  - **Modify:** booking confirmation (5.4)
  - **What:** If service requires prepayment:
    1. Create `payments` record (status: 'pending')
    2. Generate LiqPay form data
    3. Show LiqPay checkout button (redirects to LiqPay)
    4. LiqPay callback → update payment status

- [x] **8.3 — LiqPay callback webhook**
  - **Create:** `src/app/api/payments/liqpay/route.ts`
  - **What:** POST endpoint that LiqPay calls after payment.
  - **Logic:**
    1. Verify signature
    2. Find payment by order_id
    3. Update payment status
    4. If successful, confirm appointment (status: 'confirmed')

- [x] **8.4 — Subscription payment flow**
  - **Add to settings:** "Change Plan" section with plan cards + "Subscribe" button
  - **Logic:** Create LiqPay subscription payment → on success, update `subscriptions` table

- [x] **8.5 — Verify Phase 8**
  - Prepayment works with LiqPay sandbox. Callback updates status. Subscription payment flow works.
  - `npm run build` passes

---

### PHASE 9: NOTIFICATIONS & REMINDERS
> Telegram bot, push notifications, automated reminders

- [ ] **9.1 — Telegram Bot setup**
  - **Create:** `src/lib/telegram/bot.ts`
  - **What:** Functions for Telegram Bot API:
    - `sendMessage(chatId, text, options?)` — send text message
    - `setWebhook(url)` — register webhook URL
  - **Uses:** `fetch('https://api.telegram.org/bot{TOKEN}/sendMessage', ...)`

- [ ] **9.2 — Telegram webhook handler**
  - **Create:** `src/app/api/telegram/webhook/route.ts`
  - **What:** Receives Telegram updates. Handles:
    - `/start` command → register user or show welcome
    - `/start master_{invite_code}` → link client to master (insert into `client_master_links`)
    - Text messages → show help

- [ ] **9.3 — Notification sender cron**
  - **Create:** `src/app/api/cron/notifications/route.ts`
  - **What:** Called by Vercel Cron every 5 minutes. Fetches pending notifications from `notifications` table where `scheduled_for <= now()`. Sends via Telegram or email. Updates status.
  - **Vercel Cron config** in `vercel.json`:
    ```json
    { "crons": [{ "path": "/api/cron/notifications", "schedule": "*/5 * * * *" }] }
    ```

- [ ] **9.4 — Appointment reminder cron**
  - **Create:** `src/app/api/cron/reminders/route.ts`
  - **What:** Called every hour. Finds appointments starting in ~24h and ~2h. Creates notification records in `notifications` table for both client and master.

- [ ] **9.5 — Notification when booking is created**
  - **Modify:** booking creation logic (5.4)
  - **What:** After creating appointment, insert notification for master: "New booking: {client_name} on {date} at {time} for {service}"

- [ ] **9.6 — "Long time no see" auto-messages (Pro tier)**
  - **Create:** `src/app/api/cron/retention/route.ts`
  - **What:** Weekly cron. For each master (Pro+), find clients whose `last_visit_at` was > their usual interval. Calculate usual interval from appointment history. Create notification: "You haven't visited in a while, book now?"
  - **Gated by:** master must have Pro+ tier

- [ ] **9.7 — Verify Phase 9**
  - Telegram bot responds to /start. Reminders are created. Notifications send.
  - `npm run build` passes

---

### PHASE 10: TELEGRAM MINI APP
> Loading web app inside Telegram, auth via Telegram, deep links

- [ ] **10.1 — Telegram Mini App entry point**
  - **Create:** `src/app/telegram/page.tsx`
  - **What:** A special page that loads inside Telegram WebView. It:
    1. Reads `window.Telegram.WebApp` SDK
    2. Gets `initData` from Telegram
    3. Validates initData server-side
    4. Creates/finds user by telegram_id
    5. Sets Supabase session
    6. Redirects to appropriate UI (client: `/book`, master: `/calendar`)

- [ ] **10.2 — Telegram auth validation API**
  - **Create:** `src/app/api/telegram/auth/route.ts`
  - **What:** POST endpoint that validates Telegram Mini App `initData`.
  - **Validation:** HMAC-SHA256 as per Telegram docs (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
  - **Returns:** Supabase access token (sign JWT with service role or use signInAnonymously + link)

- [ ] **10.3 — Telegram Web App SDK integration**
  - **Create:** `src/lib/telegram/webapp.ts`
  - **What:** Helper to interact with `window.Telegram.WebApp`:
    - `getTelegramUser()` → user data
    - `showMainButton(text, onClick)` → Telegram main button
    - `hapticFeedback()` → vibration
    - `close()` → close mini app
  - **Script tag:** Add `<script src="https://telegram.org/js/telegram-web-app.js">` to Telegram entry layout

- [ ] **10.4 — Deep link handling**
  - **What:** When user opens `t.me/CresCABot?start=master_ABC123`:
    1. Bot receives `/start master_ABC123`
    2. Bot sends message with "Open App" button (Mini App URL with params)
    3. Mini App opens → reads params → links client to master

- [ ] **10.5 — Verify Phase 10**
  - Mini App loads in Telegram. Auth works. Navigation works. Deep links work.
  - `npm run build` passes

---

### PHASE 11: MARKETING FEATURES
> Referrals, reviews, waitlist notifications, auto-upsell

- [ ] **11.1 — Referral system (Pro tier)**
  - **Modify:** `src/app/[locale]/(client)/profile/page.tsx`
  - **What:** Show client's referral link + code. When someone registers with this link, both get bonus points.
  - **Track:** In `referrals` table. Update `referral_bonus_points` on both client records.
  - **Gated by:** master must have Pro+ tier

- [ ] **11.2 — Review collection (after visit)**
  - **Create:** `src/app/api/cron/reviews/route.ts`
  - **What:** 2 hours after appointment completes, create notification asking client to rate (1-5 stars). If rating < 4, mark `is_published = false` and notify master privately.
  - **Create:** `src/components/shared/rating-stars.tsx` — reusable star rating component (1-5)

- [ ] **11.3 — Waitlist notification on cancellation**
  - **Modify:** appointment cancellation logic (4.6)
  - **What:** When appointment is cancelled, check `waitlist` for matching master + date. Notify first matching client.

- [ ] **11.4 — Gift certificates (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/certificates/page.tsx`
  - **What:** Master can create gift certificates (amount, expiry). Generates unique code. Client can buy and share via Telegram.
  - **Gated by:** Business tier

- [ ] **11.5 — Cross-marketing / Guilds (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/guilds/page.tsx`
  - **What:** Master can create a guild, invite other masters. When guild member recommends a client, both get bonus.
  - **Gated by:** Business tier

- [ ] **11.6 — Verify Phase 11**
  - Referral links work. Reviews collect. Waitlist notifies. Certificates generate.
  - `npm run build` passes

---

### PHASE 12: AI FEATURES (Business tier)
> Voice notes, smart scheduling, auto-recommendations

- [ ] **12.1 — OpenRouter integration**
  - **Create:** `src/lib/ai/openrouter.ts`
  - **What:** Function to call OpenRouter API:
    ```tsx
    export async function aiComplete(systemPrompt: string, userMessage: string): Promise<string> {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free', // or best free model available
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content;
    }
    ```

- [ ] **12.2 — Voice notes transcription**
  - **Create:** `src/app/api/ai/transcribe/route.ts`
  - **What:** Accept audio blob from client. Use OpenRouter/free Whisper API to transcribe. Parse transcription into structured data (client name, service, notes, inventory items).
  - **System prompt:**
    ```
    You are a CRM assistant. Parse the following voice note from a service professional.
    Extract: client_name, service_performed, notes, inventory_items_used (name + quantity).
    Return JSON only.
    ```

- [ ] **12.3 — Smart scheduling suggestions**
  - **Create:** `src/app/api/ai/suggest-booking/route.ts`
  - **What:** For each client, calculate their usual visit interval. If overdue, generate a personalized reminder message.
  - **Logic:** Query appointment history, calculate avg days between visits, compare with days since last visit.
  - **Used by:** retention cron (9.6) to generate personalized messages

- [ ] **12.4 — Post-visit auto-recommendation**
  - **Create:** `src/app/api/cron/recommendations/route.ts`
  - **What:** 2 hours after visit, send personalized product/service recommendation based on what was done.
  - **Uses AI to generate message** based on service performed and client history.

- [ ] **12.5 — Verify Phase 12**
  - AI API works. Voice transcription parses. Recommendations generate.
  - `npm run build` passes

---

### PHASE 13: LANDING PAGE POLISH + THREE.JS
> Premium landing page with 3D effects

- [ ] **13.1 — Three.js hero section**
  - **Create:** `src/components/landing/hero-3d.tsx`
  - **What:** Dynamic import of Three.js/R3F scene. Abstract 3D background (particles, waves, or geometric shapes) behind the hero text.
  - **Dynamic import:** `const Scene = dynamic(() => import('./scene'), { ssr: false })`
  - **Performance:** Use low-poly geometry. Disable on mobile if performance is poor.

- [ ] **13.2 — Landing page sections**
  - **Modify:** `src/app/[locale]/(landing)/page.tsx`
  - **What:** Add sections:
    - "How It Works" (3 steps with icons)
    - Testimonials (placeholder data)
    - FAQ accordion
    - CTA section at bottom
  - **All text through i18n**

- [ ] **13.3 — Language switcher**
  - **Create:** `src/components/shared/language-switcher.tsx`
  - **What:** Dropdown showing current locale flag + name. Clicking switches locale via URL prefix.
  - **Add to:** Landing header, dashboard sidebar bottom, client bottom nav
  - **Pattern:**
    ```tsx
    import { useRouter, usePathname } from 'next/navigation';
    const router = useRouter();
    const pathname = usePathname();
    function switchLocale(newLocale: string) {
      const segments = pathname.split('/');
      segments[1] = newLocale;
      router.push(segments.join('/'));
    }
    ```

- [ ] **13.4 — Dark/Light theme toggle**
  - **What:** Add `next-themes` ThemeProvider. Toggle button in header/sidebar.
  - **Already installed:** `next-themes` is in package.json

- [ ] **13.5 — Verify Phase 13**
  - Landing looks professional. 3D works. Language switch works. Theme toggle works.
  - `npm run build` passes

---

### PHASE 14: SALON MODE
> Multi-master management, roles, equipment sharing

- [ ] **14.1 — Team management page**
  - **Create:** `src/app/[locale]/(dashboard)/settings/team/page.tsx`
  - **What:** Salon admin can: invite masters (via email or invite link), see team list, remove masters.
  - **Logic:** Insert into `masters` with salon_id. New master gets notification.
  - **Visible only if:** current user role is `salon_admin`

- [ ] **14.2 — Equipment management (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/settings/equipment/page.tsx`
  - **What:** CRUD for shared equipment. Track resource usage (laser pulses, lamp hours).
  - **Alert:** When `used_resource > maintenance_threshold`, show warning notification.
  - **Booking conflict:** When creating appointment, check equipment availability at selected time.

- [ ] **14.3 — Salon-wide analytics**
  - **Modify:** finance page
  - **What:** For salon_admin, show aggregate stats across all masters. Filter by master dropdown.

- [ ] **14.4 — Verify Phase 14**
  - Salon admin can manage team. Equipment tracks resources. Analytics aggregate.
  - `npm run build` passes

---

### PHASE 15: CONSENT FORMS & DIGITAL SIGNATURES
> Digital consent before procedures

- [ ] **15.1 — Consent form template**
  - **Create:** `src/components/shared/consent-form.tsx`
  - **What:** Auto-generated consent text based on: service name, client's allergies, risk description. Client checks a checkbox to agree.
  - **Save to:** `consent_forms` table with timestamp and client_ip.

- [ ] **15.2 — Consent in booking flow**
  - **Modify:** booking confirmation (5.4)
  - **What:** If service requires consent (flag on service), show consent form before confirming.
  - **Gated by:** Pro+ tier

- [ ] **15.3 — Verify Phase 15**
  - Consent form shows, client agrees, record saved in DB.
  - `npm run build` passes

---

### PHASE 16: FINAL POLISH & DEPLOYMENT
> SEO, performance, deployment, testing

- [ ] **16.1 — SEO optimization**
  - **Add:** Open Graph tags, structured data (JSON-LD for LocalBusiness), sitemap.xml, robots.txt
  - **Modify:** Root layout metadata

- [ ] **16.2 — PWA manifest**
  - **Create:** `public/manifest.json` — for Add to Home Screen on mobile

- [ ] **16.3 — Error boundaries**
  - **Create:** `src/app/[locale]/error.tsx` and `src/app/[locale]/not-found.tsx`

- [ ] **16.4 — Loading states**
  - **Create:** `src/app/[locale]/(dashboard)/loading.tsx` and `src/app/[locale]/(client)/loading.tsx`
  - **What:** Skeleton screens using shadcn Skeleton component

- [ ] **16.5 — Deploy to Vercel**
  - Push to GitHub → connect to Vercel → set environment variables → deploy
  - Configure custom domain cres-ca.com in Cloudflare + Vercel

- [ ] **16.6 — Supabase production setup**
  - Create production Supabase project
  - Run migrations
  - Set up Storage buckets (client-files, avatars)
  - Configure RLS policies
  - Set up email templates for auth

- [ ] **16.7 — Telegram Bot registration**
  - Register bot with @BotFather
  - Set webhook URL to `/api/telegram/webhook`
  - Configure Mini App URL

- [ ] **16.8 — End-to-end testing**
  - [ ] Register as master → set up profile → add services → see calendar
  - [ ] Register as client → find master → book appointment → get reminder
  - [ ] Master completes appointment → inventory deducted → finance updated
  - [ ] Client leaves review → master sees rating
  - [ ] Telegram Mini App flow → auth → book → notifications
  - [ ] Subscription upgrade flow → LiqPay payment
  - [ ] Salon admin → add master → equipment booking → aggregate analytics
  - [ ] AI voice note → transcription → auto-deduction
  - [ ] Referral link → new client → bonus points

- [ ] **16.9 — Final build and deploy**
  - `npm run build` passes with 0 errors
  - All pages render correctly
  - All API routes respond
  - Production URL works

---

## TRANSLATION KEYS REFERENCE

When adding new features, add translation keys to ALL THREE files: `uk.json`, `ru.json`, `en.json`.

**Naming convention:** `section.keyName` (camelCase)
- `auth.signIn`, `auth.signUp`, `auth.fullName`
- `dashboard.calendar`, `dashboard.clients`
- `calendar.dayView`, `calendar.newAppointment`
- `clients.addClient`, `clients.visitHistory`
- `booking.selectService`, `booking.bookNow`
- etc.

**Template:**
```json
{
  "section": {
    "keyName": "Translation text"
  }
}
```

---

## COMMON PATTERNS

### Create a new page
```tsx
/** --- YAML
 * name: PageName
 * description: What this page does
 * --- */

import { useTranslations } from 'next-intl';

export default function PageName() {
  const t = useTranslations('section');
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      {/* content */}
    </div>
  );
}
```

### Create a client component with data fetching
```tsx
/** --- YAML
 * name: ComponentName
 * description: What this component does
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ComponentName() {
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setData(data);
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <Skeleton className="h-32" />;
  return <div>{/* render data */}</div>;
}
```

### Create an API route
```tsx
/** --- YAML
 * name: API Route Name
 * description: What this endpoint does
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // ... logic ...

  return NextResponse.json({ success: true });
}
```

### Feature-gated component
```tsx
import { useSubscription } from '@/hooks/use-subscription';

function GatedFeature() {
  const { canUse } = useSubscription();

  if (!canUse('feature_name')) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
        <p>This feature requires Pro plan</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Upgrade
        </Link>
      </div>
    );
  }

  return <ActualContent />;
}
```

---

## WHAT NOT TO DO

1. **DO NOT** install new packages without checking if existing ones cover the need
2. **DO NOT** use `asChild` on any shadcn component — use `buttonVariants()` or `render` prop
3. **DO NOT** hardcode any UI text — always use i18n `t()` function
4. **DO NOT** mix up browser and server Supabase clients
5. **DO NOT** skip subscription tier checks on tier-limited features
6. **DO NOT** create files outside the `src/` directory (except migrations and public assets)
7. **DO NOT** modify `globals.css` unless explicitly changing the theme
8. **DO NOT** modify files in `src/components/ui/` — they are auto-generated by shadcn
9. **DO NOT** use relative imports — always use `@/`
10. **DO NOT** commit `.env.local` or any secrets to git
