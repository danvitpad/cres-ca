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
│   │   │   │   ├── page.tsx    ← Landing page [DONE]
│   │   │   │   ├── contact/page.tsx  ← Contact / Support form
│   │   │   │   └── layout.tsx  ← Landing layout with footer (About|Pricing|Contact|Terms|Privacy)
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
│   │   │       ├── layout.tsx  ← Bottom tab bar (5 tabs: Feed|Calendar|+Book|Masters|Profile) [DONE→REDESIGN in Phase 17]
│   │   │       ├── feed/page.tsx       ← Home tab: Instagram-style feed from followed masters
│   │   │       ├── calendar/page.tsx   ← Unified client calendar (all masters)
│   │   │       ├── book/page.tsx       ← Booking flow (opened from center "+" tab)
│   │   │       ├── history/page.tsx    [STUB]
│   │   │       ├── masters/page.tsx    ← Masters tab: search + map + followed list
│   │   │       ├── map/page.tsx        [STUB]
│   │   │       ├── shop/page.tsx       ← Product storefront (from followed masters)
│   │   │       └── profile/page.tsx    ← Profile tab: settings, family, packages, referral
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
| Product storefront | — | — | YES |
| Lost revenue AI | — | — | YES |
| Currency tracking | — | — | YES |
| Auto-reports | — | — | YES |
| Family accounts | — | YES | YES |
| Burning slots promos | — | YES | YES |

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

- [x] **9.1 — Telegram Bot setup**
  - **Create:** `src/lib/telegram/bot.ts`
  - **What:** Functions for Telegram Bot API:
    - `sendMessage(chatId, text, options?)` — send text message
    - `setWebhook(url)` — register webhook URL
  - **Uses:** `fetch('https://api.telegram.org/bot{TOKEN}/sendMessage', ...)`

- [x] **9.2 — Telegram webhook handler**
  - **Create:** `src/app/api/telegram/webhook/route.ts`
  - **What:** Receives Telegram updates. Handles:
    - `/start` command → register user or show welcome
    - `/start master_{invite_code}` → link client to master (insert into `client_master_links`)
    - Text messages → show help

- [x] **9.3 — Notification sender cron**
  - **Create:** `src/app/api/cron/notifications/route.ts`
  - **What:** Called by Vercel Cron every 5 minutes. Fetches pending notifications from `notifications` table where `scheduled_for <= now()`. Sends via Telegram or email. Updates status.
  - **Vercel Cron config** in `vercel.json`:
    ```json
    { "crons": [{ "path": "/api/cron/notifications", "schedule": "*/5 * * * *" }] }
    ```

- [x] **9.4 — Appointment reminder cron**
  - **Create:** `src/app/api/cron/reminders/route.ts`
  - **What:** Called every hour. Finds appointments starting in ~24h and ~2h. Creates notification records in `notifications` table for both client and master.

- [x] **9.5 — Notification when booking is created**
  - **Modify:** booking creation logic (5.4)
  - **What:** After creating appointment, insert notification for master: "New booking: {client_name} on {date} at {time} for {service}"

- [x] **9.6 — "Long time no see" auto-messages (Pro tier)**
  - **Create:** `src/app/api/cron/retention/route.ts`
  - **What:** Weekly cron. For each master (Pro+), find clients whose `last_visit_at` was > their usual interval. Calculate usual interval from appointment history. Create notification: "You haven't visited in a while, book now?"
  - **Gated by:** master must have Pro+ tier

- [x] **9.7 — Verify Phase 9**
  - Telegram bot responds to /start. Reminders are created. Notifications send.
  - `npm run build` passes

---

### PHASE 10: TELEGRAM MINI APP (Basic)
> Loading web app inside Telegram, auth via Telegram, deep links. **Full native integration in Phase 23.**

- [x] **10.1 — Telegram Mini App entry point**
  - **Create:** `src/app/telegram/page.tsx`
  - **What:** A special page that loads inside Telegram WebView. It:
    1. Reads `window.Telegram.WebApp` SDK
    2. Gets `initData` from Telegram
    3. Validates initData server-side
    4. Creates/finds user by telegram_id
    5. Sets Supabase session
    6. Redirects to appropriate UI (client: `/book`, master: `/calendar`)

- [x] **10.2 — Telegram auth validation API**
  - **Create:** `src/app/api/telegram/auth/route.ts`
  - **What:** POST endpoint that validates Telegram Mini App `initData`.
  - **Validation:** HMAC-SHA256 as per Telegram docs (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
  - **Returns:** Supabase access token (sign JWT with service role or use signInAnonymously + link)

- [x] **10.3 — Telegram Web App SDK integration**
  - **Create:** `src/lib/telegram/webapp.ts`
  - **What:** Basic helper to interact with `window.Telegram.WebApp`:
    - `getTelegramUser()` → user data
    - `showMainButton(text, onClick)` → Telegram main button
    - `hapticFeedback()` → vibration
    - `close()` → close mini app
  - **Script tag:** Add `<script src="https://telegram.org/js/telegram-web-app.js?62">` to Telegram entry layout
  - **NOTE:** This is a minimal version. Phase 23 rewrites this with full typed SDK covering fullscreen, safe areas, biometrics, CloudStorage, LocationManager, payments, etc.

- [x] **10.4 — Deep link handling**
  - **What:** When user opens `t.me/CresCABot?start=master_ABC123`:
    1. Bot receives `/start master_ABC123`
    2. Bot sends message with "Open App" button (Mini App URL with params)
    3. Mini App opens → reads params → links client to master

- [x] **10.5 — Verify Phase 10**
  - Mini App loads in Telegram. Auth works. Navigation works. Deep links work.
  - `npm run build` passes

---

### PHASE 11: MARKETING FEATURES
> Referrals, reviews, waitlist notifications, auto-upsell

- [x] **11.1 — Referral system (Pro tier)**
  - **Modify:** `src/app/[locale]/(client)/profile/page.tsx`
  - **What:** Show client's referral link + code. When someone registers with this link, both get bonus points.
  - **Track:** In `referrals` table. Update `referral_bonus_points` on both client records.
  - **Gated by:** master must have Pro+ tier

- [x] **11.2 — Review collection (after visit)**
  - **Create:** `src/app/api/cron/reviews/route.ts`
  - **What:** 2 hours after appointment completes, create notification asking client to rate (1-5 stars). If rating < 4, mark `is_published = false` and notify master privately.
  - **Create:** `src/components/shared/rating-stars.tsx` — reusable star rating component (1-5)

- [x] **11.3 — Waitlist notification on cancellation**
  - **Modify:** appointment cancellation logic (4.6)
  - **What:** When appointment is cancelled, check `waitlist` for matching master + date. Notify first matching client.

- [x] **11.4 — Gift certificates (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/certificates/page.tsx`
  - **What:** Master can create gift certificates (amount, expiry). Generates unique code. Client can buy and share via Telegram.
  - **Gated by:** Business tier

- [x] **11.5 — Cross-marketing / Guilds (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/marketing/guilds/page.tsx`
  - **What:** Master can create a guild, invite other masters. When guild member recommends a client, both get bonus.
  - **Gated by:** Business tier

- [x] **11.6 — Verify Phase 11**
  - Referral links work. Reviews collect. Waitlist notifies. Certificates generate.
  - `npm run build` passes

---

### PHASE 12: AI FEATURES (Business tier)
> Voice notes, smart scheduling, auto-recommendations

- [x] **12.1 — OpenRouter integration**
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

- [x] **12.2 — Voice notes transcription**
  - **Create:** `src/app/api/ai/transcribe/route.ts`
  - **What:** Accept audio blob from client. Use OpenRouter/free Whisper API to transcribe. Parse transcription into structured data (client name, service, notes, inventory items).
  - **System prompt:**
    ```
    You are a CRM assistant. Parse the following voice note from a service professional.
    Extract: client_name, service_performed, notes, inventory_items_used (name + quantity).
    Return JSON only.
    ```

- [x] **12.3 — Smart scheduling suggestions**
  - **Create:** `src/app/api/ai/suggest-booking/route.ts`
  - **What:** For each client, calculate their usual visit interval. If overdue, generate a personalized reminder message.
  - **Logic:** Query appointment history, calculate avg days between visits, compare with days since last visit.
  - **Used by:** retention cron (9.6) to generate personalized messages

- [x] **12.4 — Post-visit auto-recommendation**
  - **Create:** `src/app/api/cron/recommendations/route.ts`
  - **What:** 2 hours after visit, send personalized product/service recommendation based on what was done.
  - **Uses AI to generate message** based on service performed and client history.

- [x] **12.5 — Verify Phase 12**
  - AI API works. Voice transcription parses. Recommendations generate.
  - `npm run build` passes

---

### PHASE 13: LANDING PAGE POLISH + THREE.JS
> Premium landing page with 3D effects

- [x] **13.1 — Three.js hero section** (replaced with Spotlight SVG + animated effects)
  - **Create:** `src/components/landing/hero-3d.tsx`
  - **What:** Dynamic import of Three.js/R3F scene. Abstract 3D background (particles, waves, or geometric shapes) behind the hero text.
  - **Dynamic import:** `const Scene = dynamic(() => import('./scene'), { ssr: false })`
  - **Performance:** Use low-poly geometry. Disable on mobile if performance is poor.

- [x] **13.2 — Landing page sections**
  - **Modify:** `src/app/[locale]/(landing)/page.tsx`
  - **What:** Add sections:
    - "How It Works" (3 steps with icons)
    - Testimonials (placeholder data)
    - FAQ accordion
    - CTA section at bottom
  - **All text through i18n**

- [x] **13.3 — Language switcher**
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

- [x] **13.4 — Dark/Light theme toggle**
  - **What:** Add `next-themes` ThemeProvider. Toggle button in header/sidebar.
  - **Already installed:** `next-themes` is in package.json

- [x] **13.5 — Verify Phase 13**
  - Landing looks professional. 3D works. Language switch works. Theme toggle works.
  - `npm run build` passes

---

### PHASE 14: SALON MODE
> Multi-master management, roles, equipment sharing

- [x] **14.1 — Team management page**
  - **Create:** `src/app/[locale]/(dashboard)/settings/team/page.tsx`
  - **What:** Salon admin can: invite masters (via email or invite link), see team list, remove masters.
  - **Logic:** Insert into `masters` with salon_id. New master gets notification.
  - **Visible only if:** current user role is `salon_admin`

- [x] **14.2 — Equipment management (Business tier)**
  - **Create:** `src/app/[locale]/(dashboard)/settings/equipment/page.tsx`
  - **What:** CRUD for shared equipment. Track resource usage (laser pulses, lamp hours).
  - **Alert:** When `used_resource > maintenance_threshold`, show warning notification.
  - **Booking conflict:** When creating appointment, check equipment availability at selected time.

- [x] **14.3 — Salon-wide analytics**
  - **Modify:** finance page
  - **What:** For salon_admin, show aggregate stats across all masters. Filter by master dropdown.

- [x] **14.4 — Verify Phase 14**
  - Salon admin can manage team. Equipment tracks resources. Analytics aggregate.
  - `npm run build` passes

---

### PHASE 15: CONSENT FORMS & DIGITAL SIGNATURES
> Digital consent before procedures

- [x] **15.1 — Consent form template**
  - **Create:** `src/components/shared/consent-form.tsx`
  - **What:** Auto-generated consent text based on: service name, client's allergies, risk description. Client checks a checkbox to agree.
  - **Save to:** `consent_forms` table with timestamp and client_ip.

- [x] **15.2 — Consent in booking flow**
  - **Modify:** booking confirmation (5.4)
  - **What:** If service requires consent (flag on service), show consent form before confirming.
  - **Gated by:** Pro+ tier

- [x] **15.3 — Verify Phase 15**
  - Consent form shows, client agrees, record saved in DB.
  - `npm run build` passes

---

### PHASE 16: FINAL POLISH & DEPLOYMENT
> SEO, performance, deployment, testing

- [x] **16.1 — SEO optimization**
  - **Add:** Open Graph tags, structured data (JSON-LD for LocalBusiness), sitemap.xml, robots.txt
  - **Modify:** Root layout metadata

- [x] **16.2 — PWA manifest**
  - **Create:** `public/manifest.json` — for Add to Home Screen on mobile

- [x] **16.3 — Error boundaries**
  - **Create:** `src/app/[locale]/error.tsx` and `src/app/[locale]/not-found.tsx`

- [x] **16.4 — Loading states**
  - **Create:** `src/app/[locale]/(dashboard)/loading.tsx` and `src/app/[locale]/(client)/loading.tsx`
  - **What:** Skeleton screens using shadcn Skeleton component

- [x] **16.5 — Deploy to Vercel**
  - Production URL: https://app-seven-fawn-29.vercel.app
  - GitHub auto-deploy connected
  - 7 environment variables configured

- [x] **16.6 — Supabase production setup**
  - All 3 migrations executed (23 tables, indexes, RLS policies)
  - Auth trigger for auto profile/master/salon creation
  - Storage buckets: client-files (private), avatars (public)

- [x] **16.7 — Telegram Bot registration**
  - Bot token added to Vercel env
  - Webhook: https://app-seven-fawn-29.vercel.app/api/telegram/webhook

- [x] **16.8 — End-to-end testing**
  - [x] Landing, register, login pages render correctly
  - [x] Sitemap.xml returns 200
  - [x] Telegram webhook configured and responding
  - [x] Register as master → set up profile → add services → see calendar
  - [x] Register as client → find master → book appointment → get reminder
  - [x] Master completes appointment → inventory deducted → finance updated
  - [x] Client leaves review → master sees rating
  - [x] Telegram Mini App flow → auth → book → notifications
  - [x] Subscription upgrade flow → LiqPay payment
  - [x] Salon admin → add master → equipment booking → aggregate analytics
  - [x] AI voice note → transcription → auto-deduction
  - [x] Referral link → new client → bonus points

- [x] **16.9 — Final build and deploy**
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

### PHASE 17: UI/UX OVERHAUL — DESIGN SYSTEM
> Premium visual identity. Client app = Instagram-tier social experience. Master dashboard = Linear-tier CRM.

**DESIGN PHILOSOPHY:**
The current UI is functional stubs. This phase replaces them with a cohesive, premium design system that makes users WANT to stay in the app. Two distinct but unified visual identities. **Reference:** Instagram mobile app for client UX, Linear/Raycast for master dashboard.

**ANIMATION ENGINE: Framer Motion** (already installed: `framer-motion` + `motion`)
- All page transitions: `<AnimatePresence>` with `motion.div` slide/fade
- Gesture animations: `whileTap={{ scale: 0.95 }}` on all interactive elements
- Layout animations: `layout` prop on lists that reorder (appointments, feed)
- Scroll-triggered: `whileInView` for lazy-loading cards
- Exit animations: `exit={{ opacity: 0, y: 20 }}` when removing items
- Spring physics for natural feel: `transition={{ type: "spring", stiffness: 300, damping: 30 }}`

**READY-MADE COMPONENTS** (from `D:/Claude.cres-ca/components/` — 107 files):
Use these as reference/base when building. Key ones:
| Component file | Use for |
|---|---|
| `Аватар с рамкой.txt` | Top masters story circles (gradient ring + status dot) |
| `Слайдер сравнения До-После.txt` | Before/After photo slider in client card |
| `Стеклянные метрики.txt` | Finance dashboard stat cards (glassmorphism + framer-motion) |
| `Слайдер карточек.txt` | Horizontal scrollable master cards / service cards |
| `Карточка клиента.txt` | Client card in master's CRM (avatar + info fields) |
| `Эмодзи-рейтинг.txt` | Post-visit rating (emoji faces 1-5) |
| `Календарь.txt` | Calendar date picker base |
| `Прогресс-бар.txt` | Revenue goal, package visits remaining |
| `Реферальная карточка.txt` | Referral link sharing card |
| `Карточка продукта.txt` | Product storefront cards |
| `Стеклянная карточка оплаты.txt` | Payment/tip confirmation |
| `Выдвижная панель.txt` | Bottom sheet for mobile actions |
| `Виджет статистики с графиком.txt` | Finance charts |
| `Раскрывающийся поиск.txt` | Master search bar (expandable) |
| `Выпадающее меню профиля.txt` | Profile dropdown in dashboard header |
| `Таблица расширенная.txt` | Client list, appointment list, inventory table |
| `Фон Аврора.txt` | Landing page background effect |
| `Бенто-сетка.txt` | Dashboard overview layout (bento grid of stat cards) |
| `Кнопка поделиться.txt` | Share master profile / referral link |
| `Анимированный переключатель темы.txt` | Dark/light toggle |

**CLIENT APP (mobile-first, social-network feel):**
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
  - Use `Аватар с рамкой.txt` component as base
- **Feed cards** (vertical infinite scroll):
  - Master avatar + name + specialization tag (top left)
  - "..." menu (top right) → Unfollow, Report, Share
  - Content area: image (if present) with rounded-xl, or text card with colored bg
  - Post types with visual distinction:
    - `new_service` — service card with price + "Book" button
    - `promotion` — highlighted border (accent glow), discount badge
    - `before_after` — slider component inline
    - `burning_slot` — urgency: red timer badge "Expires in 3h", pulsing dot
    - `update` — simple text post
  - Action bar: Heart (save/favorite) | Comment (future) | Share | Book (primary, right-aligned)
  - Use `Стеклянная карточка блога.txt` and `Слайдер карточек.txt` as base
- **Pull-to-refresh:** Overscroll triggers spinner + haptic. Use `framer-motion` drag constraint.
- **Glassmorphism overlays:** All modals/sheets use `backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80`
- **Safe area:** `pb-[env(safe-area-inset-bottom)]` on tab bar for iPhone notch/home indicator
- **Hide tab bar on scroll down, show on scroll up** (like Instagram): track scroll direction, animate translateY

**MASTER DASHBOARD (desktop-first, professional CRM):**
_Layout: dark sidebar left, light content area right. Inspired by Linear + Notion but richer visually._

- **Sidebar** (left, 64px collapsed / 260px expanded):
  - Logo at top (CRES-CA wordmark when expanded, icon when collapsed)
  - Navigation items with icons: Calendar, Clients, Services, Queue (if queue_mode), Finance, Inventory, Marketing
  - Divider between main nav and settings
  - Bottom: user avatar (40px) + name + subscription badge (Starter=gray, Pro=blue, Business=gold) + settings gear
  - **Active state:** left accent bar (3px × 32px, var(--accent)), bg var(--accent-soft), text foreground
  - **Hover state:** bg zinc-100 dark:bg-zinc-800, 150ms transition
  - **Collapse toggle:** chevron-left/right at sidebar bottom, or auto-collapse on screens < 1024px
  - **Mobile:** overlay drawer from left, backdrop blur, swipe-to-close
- **Top header bar** (content area):
  - Left: page icon + page title (h1) + breadcrumb if nested
  - Center: global search input (Cmd+K trigger, expandable)
  - Right: notification bell (red dot if unread) + avatar dropdown (settings, switch role, sign out)
- **Content area patterns:**
  - **Overview/Dashboard:** Bento grid of stat cards (use `Бенто-сетка.txt`). 2×3 grid on desktop, stack on mobile. Each card: large metric number, label, trend badge (+12% green / -5% red), sparkline.
  - **List pages** (clients, services, inventory): search bar top + filter pills + data table with sticky header + floating action button (bottom-right, "+") for adding new items.
  - **Detail pages** (client card): tabs header (Info | History | Health | Files) + content below.
  - **Calendar:** Full-width, no card wrapper. Time grid left, events as colored blocks. Mini-month calendar in sidebar (below nav items on desktop).
- **Command palette** (Cmd+K / Ctrl+K):
  - Modal overlay with search input, categorized results: Recent, Clients, Services, Pages, Actions
  - Keyboard navigation (arrow keys + enter)
  - Actions: "Create appointment", "Add client", "Go to finance"
  - Implementation: simple fuzzy match on `string.toLowerCase().includes()`, no library needed
- **Notifications panel:** Click bell → dropdown panel (right-aligned, 380px wide, max-height 500px, scrollable). Each notification: icon + title + time ago + read/unread dot. "Mark all read" at top.
- **Data tables:** Use `Таблица расширенная.txt` as base. Zebra striping, hover row highlight, sticky header, column sorting, inline "quick edit" (click cell → input appears).

**SHARED DESIGN TOKENS:**
- Font: system font stack (`font-sans` in Tailwind — Inter on web, SF Pro on iOS, Roboto on Android)
- Border radius: cards 16px (`rounded-2xl`), buttons 10px (`rounded-[10px]`), avatars 9999px, inputs 8px (`rounded-lg`)
- Shadows: cards `shadow-sm`, elevated `shadow-md`, overlays `shadow-xl`
- Transitions: all interactive elements `transition-all duration-200 ease-out`
- Colors: neutral base zinc, accent violet (customizable per-brand later), semantic green/amber/red for success/warning/danger
- Spacing: 4px grid (`gap-1` = 4px, `gap-2` = 8px, `p-4` = 16px). Page padding 24px (`p-6`). Section gap 32px (`space-y-8`).

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

      /* Spacing rhythm */
      --space-page: 1.5rem;       /* page padding */
      --space-section: 2rem;      /* between sections */
      --space-card: 1rem;         /* card internal padding */

      /* Radius */
      --radius-card: 1rem;        /* 16px */
      --radius-button: 0.625rem;  /* 10px */
      --radius-avatar: 9999px;    /* full circle */

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
  - **Create:** `src/components/shared/primitives/` directory with:
    - `stat-card.tsx` — Large number + label + trend arrow + optional sparkline. Used on finance dashboard and master profile.
    - `avatar-ring.tsx` — Circular avatar with configurable gradient ring (for top masters) or status dot (online/busy).
    - `bottom-sheet.tsx` — Draggable bottom sheet overlay for mobile actions (booking details, quick actions). Uses touch events, snap points (25%/50%/90% height).
    - `empty-state.tsx` — Illustration + title + description + CTA button for empty lists/pages.
    - `shimmer-skeleton.tsx` — Skeleton loader with animated gradient shimmer (not static gray blocks).
    - `trend-badge.tsx` — Small pill showing "+12%" in green or "-5%" in red with arrow icon.
    - `command-palette.tsx` — Cmd+K modal: search input + categorized results (clients, appointments, services, pages). Fuzzy search with `string.includes()` (no library needed).
  - **All components:** use design tokens from 17.1, support dark mode, have YAML headers.

- [x] **17.3 — Client bottom tab bar redesign**
  - **Modify:** `src/app/[locale]/(client)/layout.tsx`
  - **What:** Replace current bottom nav with Instagram-style tab bar:
    - 5 tabs: Home (feed icon) | Calendar | + (book, center, larger) | Masters | Profile
    - Active tab: filled icon + accent color + small dot indicator below
    - Inactive: outline icon + muted color
    - Center "+" button: slightly raised, accent background, rounded-full, opens booking flow
    - Tab transitions: content slides horizontally (CSS `transform: translateX`) with 200ms ease
    - Safe area padding on iOS (env(safe-area-inset-bottom))
    - Hide on scroll down, show on scroll up (like Instagram)

- [x] **17.4 — Client feed page (Home tab)**
  - **Create:** `src/app/[locale]/(client)/feed/page.tsx`
  - **What:** Vertical feed of "posts" from all masters the client follows:
    - **Post types:** New service added, promotion/discount, before/after photo, burning slot deal, master status update
    - **Post card layout:** Master avatar + name (top), content (middle), action buttons (bottom: Book / Share / Save)
    - **Pull-to-refresh:** Native-feeling pull gesture → refetch feed
    - **Infinite scroll:** Load 10 posts at a time, fetch more on scroll
    - **Top section:** Horizontal scrollable row of followed masters' avatars (with ring = has new posts)
  - **Data:** New `feed_posts` table or generate dynamically from recent services/promos/burning-slots for followed masters
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
  - **What:** Premium sidebar:
    - **Collapsed state** (64px): only icons, tooltip on hover showing label
    - **Expanded state** (260px): icon + label, smooth width transition (200ms)
    - **Toggle:** chevron button at bottom or hamburger at top
    - **Active item:** left accent bar (3px, var(--accent)), background var(--accent-soft)
    - **Sections:** Main (Calendar, Clients, Services), Business (Finance, Inventory, Marketing), Settings
    - **Bottom:** avatar + name + tier badge (Starter/Pro/Business), settings gear, sign out
    - **Desktop:** always visible. **Mobile:** overlay drawer with backdrop blur.
    - **Cmd+K trigger:** search icon in sidebar header opens command palette
  - **Header bar** (top of content area): page title breadcrumb + global search + notification bell (with unread count badge) + avatar dropdown

- [x] **17.6 — Calendar visual overhaul**
  - **Modify:** `src/components/calendar/day-view.tsx` and `week-view.tsx`
  - **What:**
    - Appointment blocks: rounded-lg, solid left border (4px) in service color, subtle background tint of service color (10% opacity)
    - Current time indicator: red horizontal line with dot, auto-scrolls into view
    - Drag ghost: semi-transparent clone with shadow-elevated
    - Empty slot hover: dashed border appears, "+" icon fades in
    - Mini-calendar in sidebar (month grid, dots on days with appointments)
    - Smooth transitions when switching day/week, date navigation
    - Mobile: swipe left/right to change day

- [x] **17.7 — Contact / Support page + footer**
  - **Create:** `src/app/[locale]/(landing)/contact/page.tsx`
  - **What:** Public contact page accessible from landing footer and all dashboards. Contains:
    - Contact form (name, email, subject dropdown [Bug/Feature/Billing/Partnership/Other], message textarea) → sends to our email via Resend API
    - Telegram support link: `https://t.me/CresCASupport` (or bot command `/support`)
    - Email: `support@cres-ca.com`
    - FAQ link (anchor to landing FAQ section)
    - Social links (Instagram, Telegram channel) if applicable
  - **API:** `src/app/api/contact/route.ts` — receives form, sends email via Resend to admin inbox. Rate-limited: max 3 messages per hour per IP.
  - **Landing footer:** Add persistent footer to `(landing)/layout.tsx` with links: About | Pricing | Contact | Terms | Privacy. Footer appears on all public pages.
  - **Dashboard access:** Add `t('nav.helpSupport')` link at bottom of master sidebar (under Settings). Opens `/contact` in new tab or inline. Text depends on locale: "Допомога" / "Помощь" / "Help & Support".
  - **Client access:** Add `t('nav.support')` item in Profile tab page (gear icon + text).
  - **Telegram Mini App:** `t('nav.support')` in SettingsButton menu → `tg().openTelegramLink('https://t.me/CresCASupport')`
  - **All text through i18n — NOTHING hardcoded in English:** `contact.title`, `contact.form.*`, `contact.success`, `footer.*`, `nav.helpSupport`, `nav.support`

- [x] **17.8 — Verify Phase 17**
  - Design tokens applied globally. Client tab bar is Instagram-quality. Feed page scrolls and loads. Dashboard sidebar collapses/expands. Calendar looks premium. Command palette works. Contact page and footer present.
  - `npm run build` passes

---

### PHASE 18: CLIENT EXPERIENCE FEATURES
> Family accounts, client calendar, birthday greetings, before/after slider, cancellation policy, tips

- [x] **18.1 — Client unified calendar view**
  - **Create:** `src/app/[locale]/(client)/calendar/page.tsx` (second tab in bottom nav)
  - **What:** Monthly calendar grid. Days with appointments have colored dots (one dot per master, master's accent color). Tapping a day opens bottom sheet with appointment list. Each appointment card shows: master avatar, service name, time, status badge. "Add to phone calendar" button (generates .ics file download).
  - **Week view toggle:** Optional strip at top showing current week with time blocks (like Google Calendar day view but horizontal scroll).
  - **Data:** `appointments` JOIN `clients` WHERE `clients.profile_id = current_user`

- [x] **18.2 — Family accounts**
  - **Create:** `src/app/[locale]/(client)/profile/family/page.tsx`
  - **Migration:** `supabase/migrations/00005_family.sql`:
    ```sql
    create table family_links (
      id uuid primary key default gen_random_uuid(),
      parent_profile_id uuid references profiles(id) on delete cascade,
      member_name text not null,
      relationship text not null default 'child',
      linked_profile_id uuid references profiles(id),
      created_at timestamptz not null default now()
    );
    ```
  - **What:** "My Family" section in profile. Add members (name + relationship: child/spouse/parent/other). When booking, step 0: "Booking for: Me | [member name]". Appointment stores `family_member_id`. Notifications go to parent's Telegram. Family members without own account appear as separate `clients` rows linked to parent `profile_id`. If member creates own account later, link via `linked_profile_id`.
  - **Gated by:** Pro+ tier (master must have Pro+ for family booking to be available)

- [x] **18.3 — Before/After photo slider**
  - **Create:** `src/components/client-card/before-after-slider.tsx`
  - **What:** Two photos side by side with draggable vertical divider. Left = "before", right = "after". Divider handle: white circle with arrows icon, drags horizontally. Photos `object-fit: cover` to fill same container. Implementation: one container with two `<img>` absolutely positioned, right image clipped with `clip-path: inset(0 0 0 ${percentage}%)` controlled by pointer/touch events. No extra library.
  - **Also:** Master can post before/after as feed_post (type: 'before_after') which shows the slider in client feed.
  - **Gated by:** Business tier

- [x] **18.4 — Birthday greetings cron**
  - **Create:** `src/app/api/cron/birthdays/route.ts`
  - **What:** Daily cron (08:00). Query `clients.date_of_birth` and `profiles.date_of_birth` where month+day = today. For each match:
    - Client birthday → master gets notification "Today is {client}'s birthday! Send a greeting?" + auto-send if master enabled auto-greetings in settings. Client gets greeting from platform with optional discount code (master configures birthday_discount_percent in settings).
    - Master birthday → platform sends greeting to master's Telegram.
  - **Settings:** `birthday_auto_greet: boolean`, `birthday_discount_percent: number (0-50)` in master settings.

- [x] **18.5 — Configurable cancellation policy**
  - **Modify:** master settings page + booking flow
  - **Migration:** Add columns to `masters` table:
    ```sql
    alter table masters add column cancellation_policy jsonb default '{"free_hours": 24, "partial_hours": 12, "partial_percent": 50}';
    ```
  - **What:** Master configures: free cancellation window (default 24h), partial refund window + percentage, no refund window. Client sees policy summary at booking confirmation. When client cancels:
    - `> free_hours` before → full refund, no penalty
    - Between `partial_hours` and `free_hours` → partial refund (e.g., 50%)
    - `< partial_hours` → no refund, counts as cancellation in behavior stats
  - **UI:** Clear breakdown shown to client: "Free cancellation until {datetime}. After that, {percent}% fee applies."

- [x] **18.6 — Digital tips**
  - **Create:** `src/components/shared/tip-prompt.tsx`
  - **What:** After appointment status changes to 'completed', client receives notification (or sees modal in app): "How was your visit? Leave a tip for {master}!" with quick buttons: 5% / 10% / 15% / custom amount. Payment via LiqPay (same flow as prepayment). Tip recorded in `payments` table with `type = 'tip'`. Master sees tips separately in finance dashboard (not mixed with service revenue). Can be disabled by master in settings.
  - **Migration:** Add `'tip'` to payments type check constraint.

- [x] **18.7 — Verify Phase 18**
  - Client calendar shows all masters' appointments. Family booking works end-to-end. Before/After slider is smooth. Birthday cron runs. Cancellation policy enforced. Tips process via LiqPay.
  - `npm run build` passes

---

### PHASE 19: SERVICE TYPE ENHANCEMENTS
> Recurring bookings, live queue, group bookings, packages, mobile masters, price variations

- [x] **19.1 — Recurring bookings**
  - **Migration:** `supabase/migrations/00006_recurring.sql`:
    ```sql
    create table recurring_bookings (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      master_id uuid references masters(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      interval_days int not null, -- 7, 14, 21, 28, etc.
      preferred_day_of_week int, -- 0=Mon, 6=Sun
      preferred_time time,
      next_booking_date date not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    ```
  - **Create:** `src/components/booking/recurring-toggle.tsx`
  - **What:** After completing a booking, option appears: "Make this recurring? Every [1 week / 2 weeks / 3 weeks / month]". If enabled, system auto-creates next appointment after current one is completed. If the preferred slot is taken, system notifies client: "Your usual Thursday 14:00 is taken. Nearest available: Thursday 15:00. Confirm?" Recurring appointments shown in calendar with a "repeat" icon overlay. Client or master can cancel the recurrence anytime.
  - **Cron:** `src/app/api/cron/recurring/route.ts` — daily, checks `recurring_bookings` where `next_booking_date <= today + 7 days` and auto-creates appointments if slot is available.

- [x] **19.2 — Live queue (walk-in mode)**
  - **Migration:** `supabase/migrations/00007_queue.sql`:
    ```sql
    create table queue_entries (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      client_id uuid references clients(id),
      client_name text, -- for walk-ins without account
      service_id uuid references services(id),
      position int not null,
      status text not null default 'waiting' check (status in ('waiting', 'in_service', 'completed', 'cancelled', 'no_show')),
      estimated_start timestamptz,
      joined_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz
    );
    ```
  - **Create:** `src/app/[locale]/(dashboard)/queue/page.tsx` — Master view: list of queued clients, "Next" button moves top client to `in_service`, timer showing how long current client has been in service. "Add walk-in" button for clients without account.
  - **Create:** `src/components/shared/queue-status.tsx` — Client view: "You are #4 in line. Estimated wait: ~35 min". Progress bar. Push notification when "You're next!"
  - **Master setting:** `queue_mode: boolean` — enables queue tab in sidebar, hides calendar-based booking for this master.
  - **Remote queue join:** Client opens master's profile, sees "Join Queue" button (instead of "Book" when master is in queue mode). Gets position and estimate.

- [x] **19.3 — Group bookings**
  - **Migration:** `supabase/migrations/00008_groups.sql`:
    ```sql
    alter table services add column is_group boolean not null default false;
    alter table services add column max_participants int default 1;
    alter table services add column min_participants int default 1;
    alter table appointments add column group_session_id uuid;
    create table group_sessions (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      max_participants int not null,
      current_participants int not null default 0,
      status text not null default 'open' check (status in ('open', 'full', 'confirmed', 'cancelled', 'completed')),
      min_participants int not null default 1,
      auto_cancel_if_below_min boolean not null default true,
      created_at timestamptz not null default now()
    );
    ```
  - **What:** Master creates a group service (yoga class, workshop, group training) with max/min participants. Creates a group session with date/time. Clients see "3/10 spots remaining" and book individual slots. If `current_participants < min_participants` 24h before start and `auto_cancel_if_below_min = true`, auto-cancel + notify all booked clients. Each participant has their own `appointments` row linked via `group_session_id`.
  - **UI:** On master calendar, group sessions shown as wider blocks with participant count badge. Client sees group sessions in a separate "Classes" section on master profile.

- [x] **19.4 — Service packages / Subscriptions**
  - **Migration:** `supabase/migrations/00009_packages.sql`:
    ```sql
    create table service_packages (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null,
      description text,
      service_id uuid references services(id) on delete cascade,
      total_visits int not null, -- e.g., 10
      bonus_visits int not null default 0, -- e.g., 1 free
      price numeric(10,2) not null, -- discounted total price
      currency text not null default 'UAH',
      validity_days int not null default 90, -- package expires after N days
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table client_packages (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      package_id uuid references service_packages(id) on delete cascade,
      visits_remaining int not null,
      purchased_at timestamptz not null default now(),
      expires_at timestamptz not null,
      payment_id uuid references payments(id)
    );
    ```
  - **What:** Master creates packages: "10 massages for price of 9" (total_visits=10, bonus_visits=1, price=9*single_price). Client buys package → payment via LiqPay → `client_packages` created. On each booking for that service, visits_remaining decremented. When visits_remaining = 0, package exhausted. When expires_at passed, remaining visits lost (notify client 7 days before). Master sees in client card: "Package: 6/10 visits remaining, expires 15.06".
  - **UI for client:** On booking confirmation, if client has active package for this service, show "Use package visit (7 remaining)" instead of price.
  - **Gated by:** Pro+ tier

- [x] **19.5 — Mobile master (on-site visits)**
  - **Migration:** Add columns:
    ```sql
    alter table masters add column is_mobile boolean not null default false;
    alter table masters add column service_radius_km int default 15;
    alter table masters add column travel_fee_fixed numeric(10,2) default 0;
    alter table masters add column travel_fee_per_km numeric(10,2) default 0;
    alter table appointments add column client_address text;
    alter table appointments add column client_lat double precision;
    alter table appointments add column client_lng double precision;
    alter table appointments add column travel_time_minutes int;
    ```
  - **What:** Master marks "I travel to clients" in settings. Sets service radius (km) and travel fee. Client enters address during booking (geocode via OpenStreetMap Nominatim free API). System calculates distance, adds travel fee to price, blocks travel time in master's calendar before and after appointment (calculated as distance/avg_speed). Master sees client address on appointment card with "Open in Maps" link (`geo:` URI or Google Maps link). Clients outside service radius see "This master doesn't serve your area".
  - **On map:** Mobile masters shown with a radius circle overlay. Client sees which masters can reach them.

- [x] **19.6 — Price variations per service**
  - **Migration:**
    ```sql
    create table service_variations (
      id uuid primary key default gen_random_uuid(),
      service_id uuid references services(id) on delete cascade,
      name text not null, -- "Short hair", "Large dog", "2-bedroom"
      price numeric(10,2) not null,
      duration_minutes int not null,
      sort_order int not null default 0
    );
    ```
  - **What:** Master adds variations to a service: "Haircut → Short hair 300₴/30min | Long hair 500₴/45min". Client picks variation during booking → price and duration auto-fill. If service has variations, the base service price is hidden — only variations shown. On calendar, appointment shows which variation was booked.
  - **UI:** In service editor, toggle "Has variations". Variations list appears below with add/edit/delete. In booking flow, radio buttons for each variation.

- [x] **19.7 — Verify Phase 19**
  - Recurring bookings auto-create. Queue works for walk-in masters. Group sessions manage participants. Packages track visits. Mobile masters show radius + travel fee. Price variations change booking flow.
  - `npm run build` passes

---

### PHASE 20: ADVANCED MARKETING & ANALYTICS
> Shared blacklist, top masters, burning slots, lost revenue AI, product storefront

- [x] **20.1 — Cross-platform client blacklist**
  - **Create:** `src/app/api/blacklist/check/route.ts`
  - **What:** On booking creation, server-side check: aggregate `cancellation_count + no_show_count` across ALL `clients` rows with same `profile_id` (not just current master's client record). If total >= 3 in last 30 days → create warning notification for master: "Heads up: this client has cancelled/no-showed 3 times recently across the platform." Master can dismiss. Warning appears as yellow banner on the appointment card. Never reveal which masters or services — only aggregate count.
  - **Privacy RLS:** The check runs via a server-side RPC function (service role), not exposed to client.

- [x] **20.2 — Top masters ranking**
  - **Create:** `src/components/shared/top-masters-row.tsx`
  - **What:** Horizontal scrollable row of circular avatars with gradient ring (active = has recent activity/promo). Sorted by: `rating * ln(review_count + 1)`. Tapping opens master profile. Below avatar: name (truncated) + specialization tag.
  - **Ring colors:** Gold gradient for top 3, accent gradient for rest. No ring if no reviews yet.
  - **Placement:** Top of client Feed page + top of Masters search page + top of Map page.
  - **Data:** `masters` JOIN `profiles` WHERE `is_active = true AND rating >= 4.0` ORDER BY formula, LIMIT 20.

- [x] **20.3 — "Burning slots" auto-promotions**
  - **Create:** `src/app/api/cron/burning-slots/route.ts`
  - **What:** Daily cron (20:00). For each master with Pro+ tier:
    1. Calculate empty slots for next 24h (compare working hours vs booked appointments)
    2. If empty slots > 30% of total available → create feed_post (type: 'burning_slot') with discount
    3. Send push to all clients who follow this master: "Flash deal: {service} tomorrow at {time} with {discount}% off!"
    4. Create temporary discount that auto-expires after the slot time passes
  - **Master settings:** `burning_slots_enabled: boolean`, `burning_slots_discount: number (5-50)`, `burning_slots_auto: boolean` (auto-publish or ask master first).
  - **Gated by:** Pro+ tier

- [x] **20.4 — AI "Lost Revenue" analytics**
  - **Create:** `src/components/shared/lost-revenue-card.tsx`
  - **Create:** `src/app/api/ai/lost-revenue/route.ts`
  - **What:** Insight card on finance dashboard (Business tier). Weekly cron generates insights and stores them. Shows 2-3 actionable insights:
    - **Schedule gaps:** "80% bookings are Sat-Sun, Mondays are 90% empty. Try a Monday discount."
    - **Dormant clients:** "5 regular clients haven't visited in 2x their usual interval. Reach out?"
    - **Price optimization:** "Your avg check dropped 12% since adding budget services. Your premium services have 3x the margin."
    - **Upsell missed:** "Only 8% of clients add upsell services. Top masters in your category achieve 25%."
  - **Implementation:** Aggregate data server-side, send summary to OpenRouter AI, get structured JSON response, render as cards with "Take Action" buttons (e.g., "Send re-engagement message" → pre-filled notification).
  - **Gated by:** Business tier

- [x] **20.5 — Product storefront**
  - **Migration:** `supabase/migrations/00010_products.sql`:
    ```sql
    create table products (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null,
      description text,
      price numeric(10,2) not null,
      currency text not null default 'UAH',
      image_url text,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table product_recommendations (
      id uuid primary key default gen_random_uuid(),
      product_id uuid references products(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      message_template text
    );
    create table product_orders (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references clients(id) on delete cascade,
      product_id uuid references products(id) on delete cascade,
      quantity int not null default 1,
      total_price numeric(10,2) not null,
      payment_id uuid references payments(id),
      status text not null default 'pending' check (status in ('pending', 'paid', 'delivered', 'cancelled')),
      created_at timestamptz not null default now()
    );
    ```
  - **Master side:** `src/app/[locale]/(dashboard)/marketing/products/page.tsx` — CRUD for products. Link products to services (product_recommendations). Upload product photo to Supabase Storage.
  - **Client side:** `src/app/[locale]/(client)/shop/page.tsx` — Browse products from followed masters. Filter by master. Product card: image, name, price, "Buy" button. Payment via LiqPay.
  - **Auto-recommendation:** After visit (Phase 12.4 cron), if service has linked products, include product link in the recommendation message: "For best results after your {service}, we recommend {product}. Buy in one tap."
  - **Feed integration:** When master adds a product, auto-create feed_post (type: 'new_product').
  - **Gated by:** Pro+ tier with `storefront` feature flag

- [x] **20.6 — Verify Phase 20**
  - Blacklist warns on booking. Top masters row shows on feed/search/map. Burning slots auto-publish. AI insights generate weekly. Product shop works end-to-end.
  - `npm run build` passes

---

### PHASE 21: FINANCE ADVANCED
> Per-procedure cost calculator, currency tracking, auto-reports, revenue goals, recurring expenses

- [x] **21.1 — Procedure cost calculator**
  - **Create:** `src/components/shared/cost-calculator.tsx`
  - **What:** On service edit form, expandable section "Profitability":
    - List all `inventory_recipe` items with name × quantity × cost_per_unit = subtotal
    - Sum = total material cost
    - `price - material_cost = gross profit`
    - Margin % shown as colored badge (green >60%, yellow 30-60%, red <30%)
  - **Finance dashboard widget:** "Service profitability ranking" — bar chart of all services sorted by margin. Red highlight on services operating at a loss.

- [x] **21.2 — Currency rate tracking**
  - **Create:** `src/lib/currency/rates.ts`
  - **What:** Fetch rates from NBU open API (`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json`) — free, no key needed. Cache in Supabase (`currency_rates` table with date + rates JSONB). Refresh daily via cron.
  - **Migration:** Add `purchase_currency` column to `inventory_items`.
  - **UI:** In inventory item form, if `purchase_currency != master's default currency`, show converted cost: "Bought at 45 PLN = 495 UAH (rate: 11.0)". If rate changed >10% since purchase, show warning badge.
  - **Gated by:** Business tier

- [x] **21.3 — Financial reports export**
  - **Create:** `src/app/api/reports/monthly/route.ts`
  - **What:** Generate CSV (not PDF — simpler, universally importable) with:
    - Revenue by service category
    - Expenses by category
    - Tax estimate (master configures `tax_rate_percent` in settings, default 5% for ФОП)
    - Net profit
    - Inventory usage + cost summary
  - **Create:** `src/app/[locale]/(dashboard)/finance/reports/page.tsx` — month picker, "Generate Report" button, download link. Shows last 12 months of generated reports.
  - **Monthly cron:** Auto-generate on 1st of each month, notify master "Your monthly report is ready".
  - **Note:** Only financial data is exportable. Client lists, appointment history, notes are NOT exportable — this is platform-retained data.
  - **Gated by:** Business tier

- [x] **21.4 — Revenue goals**
  - **Migration:** Add to `masters`:
    ```sql
    alter table masters add column monthly_revenue_goal numeric(10,2);
    ```
  - **Create:** `src/components/shared/revenue-goal.tsx`
  - **What:** On finance dashboard, prominent progress bar: "April goal: 32,000 / 50,000 UAH (64%)". Below: "You need ~7 more clients at your avg check of 2,571₴. You have 14 free slots remaining this month." Color: green if on track (linear projection >= goal), yellow if behind, red if >30% behind. Master sets/edits goal in settings.
  - **Gamification:** When goal reached, confetti animation + notification "You hit your April goal!"

- [x] **21.5 — Recurring expenses**
  - **Migration:**
    ```sql
    alter table expenses add column is_recurring boolean not null default false;
    alter table expenses add column recurrence_interval text check (recurrence_interval in ('weekly', 'monthly', 'quarterly', 'yearly'));
    alter table expenses add column next_recurrence_date date;
    ```
  - **What:** When adding expense, toggle "Recurring". Select interval. System auto-creates new expense record on each recurrence date. Master sees recurring expenses listed separately with "Monthly total: X₴" summary. Can pause or stop recurrence.
  - **Cron:** `src/app/api/cron/recurring-expenses/route.ts` — daily, creates new expense records where `next_recurrence_date <= today`.

- [x] **21.6 — Verify Phase 21**
  - Cost calculator shows per-service profitability. Currency rates fetch and display. Reports generate and download. Revenue goal progress bar works. Recurring expenses auto-create.
  - `npm run build` passes

---

### PHASE 22: PLATFORM INFRASTRUCTURE
> Calendar sync, web push, QR codes, auto-translation, multi-location

- [x] **22.1 — Google Calendar sync (one-way export)**
  - **Create:** `src/lib/calendar/ics.ts`
  - **What:** Generate .ics file for any appointment. "Add to Calendar" button on booking confirmation and appointment detail. Downloads .ics file that works with Google Calendar, Apple Calendar, Outlook.
  - **Format:**
    ```
    BEGIN:VCALENDAR
    VERSION:2.0
    BEGIN:VEVENT
    DTSTART:20260415T140000
    DTEND:20260415T160000
    SUMMARY:Manicure - Master Anna
    LOCATION:Salon Address
    DESCRIPTION:Service details...
    END:VEVENT
    END:VCALENDAR
    ```
  - **Subscription feed (CalDAV-like):** `src/app/api/calendar/[userId]/feed.ics/route.ts` — returns all future appointments as .ics feed. User adds this URL to Google Calendar as "Subscribe to calendar" → auto-syncs. Read-only (our calendar is primary).

- [x] **22.2 — Web Push notifications**
  - **Create:** `src/lib/notifications/web-push.ts`
  - **What:** For users who use web app (not Telegram). Service Worker registers push subscription. Server sends via Web Push API (using `web-push` npm package — free, uses VAPID keys).
  - **Create:** `public/sw.js` — Service Worker for push notifications.
  - **Create:** `src/components/shared/push-permission.tsx` — "Enable notifications" prompt (shows once, remembers choice).
  - **Migration:** Add `push_subscription` JSONB column to `profiles` (stores endpoint + keys).
  - **Notification sender (Phase 9.3) updated:** Check notification channel preference: Telegram first, then Web Push, then email (Resend) as fallback.
  - **Install:** `npm install web-push` + generate VAPID keys.

- [x] **22.3 — QR code for instant booking**
  - **Create:** `src/components/shared/qr-code.tsx`
  - **What:** Generate QR code (SVG, no external API — use simple QR encoding library or canvas-based). Encodes master's booking URL: `https://cres-ca.com/{locale}/masters/{masterId}`. Master can:
    - View QR in settings page
    - Download as PNG (for printing on business cards, door stickers, receipts)
    - Share QR image via Telegram
  - **Also:** QR for specific service: `https://cres-ca.com/{locale}/book?master={id}&service={serviceId}` — scans straight to booking with service pre-selected.
  - **Install:** `npm install qrcode` (lightweight, generates SVG/canvas).

- [x] **22.4 — Auto-translation of service descriptions**
  - **Modify:** master profile + service creation
  - **What:** Master writes service name/description in their language (detected from locale). When client views in a different locale, system auto-translates via OpenRouter AI. Translations cached in DB to avoid repeated API calls.
  - **Migration:**
    ```sql
    create table translations_cache (
      id uuid primary key default gen_random_uuid(),
      source_table text not null, -- 'services', 'products', etc.
      source_id uuid not null,
      source_field text not null, -- 'name', 'description'
      target_locale text not null, -- 'en', 'uk', 'ru'
      translated_text text not null,
      created_at timestamptz not null default now(),
      unique(source_table, source_id, source_field, target_locale)
    );
    ```
  - **Logic:** On first view in different locale → check cache → if miss, call AI to translate → store in cache → return. Subsequent views use cache. Master can manually edit translations in settings if AI got it wrong.
  - **Gated by:** Business tier (AI costs). Starter/Pro show original language only.

- [x] **22.5 — Multi-location for masters**
  - **Migration:**
    ```sql
    create table master_locations (
      id uuid primary key default gen_random_uuid(),
      master_id uuid references masters(id) on delete cascade,
      name text not null, -- "Downtown Studio", "Home Office"
      address text not null,
      city text,
      latitude double precision,
      longitude double precision,
      working_hours jsonb, -- same format as masters.working_hours but per-location
      is_default boolean not null default false,
      created_at timestamptz not null default now()
    );
    ```
  - **What:** Master with multiple work locations adds each with its own address + working hours. Calendar shows which location each day. Client booking flow: after selecting service + date, if master has multiple locations, show "Location: [dropdown]". Available times depend on location's working hours. On map, each location shown as separate marker. Client can filter: "Show only masters near me" checks all locations.
  - **UI:** Settings → "My Locations" tab. Add/edit/remove locations. Set which days each location is active. Default location used when only one exists (backward compatible — current `address` field on `masters` becomes the default location).
  - **Gated by:** Pro+ tier

- [x] **22.6 — Verify Phase 22**
  - .ics download works. Calendar feed URL syncs to Google Calendar. Web Push notifications arrive in browser. QR codes generate and scan correctly. Auto-translations cache and display. Multi-location shows in booking flow and map.
  - `npm run build` passes

---

### PHASE 23: TELEGRAM MINI APP — DEEP NATIVE INTEGRATION
> Fullscreen mode, native haptics, Telegram payments, QR scanner, home screen, stories sharing, geolocation, biometrics, cloud storage. 99% users are on mobile — this phase makes the app feel native.

**CONTEXT:** Phase 10 created a basic Telegram Mini App shell. This phase exploits EVERY capability of the Telegram Mini App API (Bot API 8.0-9.6) to deliver a native-feeling experience. Reference: https://core.telegram.org/bots/webapps

- [x] **23.1 — Full Telegram SDK helper rewrite**
  - **Rewrite:** `src/lib/telegram/webapp.ts`
  - **What:** Complete typed wrapper around `window.Telegram.WebApp`. Must detect if running inside Telegram or browser and gracefully degrade.
  - **Type definitions:**
    ```tsx
    interface TelegramWebApp {
      initData: string;
      initDataUnsafe: WebAppInitData;
      version: string;
      platform: string;
      colorScheme: 'light' | 'dark';
      themeParams: ThemeParams;
      isExpanded: boolean;
      isFullscreen: boolean;
      isActive: boolean;
      viewportHeight: number;
      viewportStableHeight: number;
      safeAreaInset: { top: number; bottom: number; left: number; right: number };
      contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
      MainButton: BottomButton;
      SecondaryButton: BottomButton;
      BackButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
      SettingsButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void };
      HapticFeedback: HapticFeedback;
      CloudStorage: CloudStorage;
      BiometricManager: BiometricManager;
      LocationManager: LocationManager;
      // ... all methods
    }
    ```
  - **Helper functions:**
    ```tsx
    export const tg = () => window.Telegram?.WebApp;
    export const isTelegram = () => !!window.Telegram?.WebApp?.initData;
    export const haptic = {
      impact: (style: 'light' | 'medium' | 'heavy') => tg()?.HapticFeedback?.impactOccurred(style),
      success: () => tg()?.HapticFeedback?.notificationOccurred('success'),
      error: () => tg()?.HapticFeedback?.notificationOccurred('error'),
      selection: () => tg()?.HapticFeedback?.selectionChanged(),
    };
    ```

- [x] **23.2 — Fullscreen mode + safe areas**
  - **Modify:** Telegram entry point (`src/app/telegram/page.tsx`)
  - **What:** On app load:
    1. `WebApp.requestFullscreen()` — expand to full screen (header becomes transparent)
    2. `WebApp.disableVerticalSwipes()` — prevent accidental close when scrolling
    3. `WebApp.enableClosingConfirmation()` — confirm before closing during booking
    4. `WebApp.expand()` — ensure maximum height
    5. `WebApp.ready()` — signal ready to hide loading screen
  - **Safe areas:** Use Telegram CSS variables in layout:
    ```css
    .tg-app {
      padding-top: var(--tg-content-safe-area-inset-top, 0px);
      padding-bottom: var(--tg-safe-area-inset-bottom, 0px);
      padding-left: var(--tg-safe-area-inset-left, 0px);
      padding-right: var(--tg-safe-area-inset-right, 0px);
    }
    ```
  - **Colors:** Match app theme to Telegram:
    ```tsx
    WebApp.setHeaderColor('#000000'); // or 'bg_color' for auto
    WebApp.setBackgroundColor('#000000');
    WebApp.setBottomBarColor('#000000'); // matches bottom tab bar
    ```
  - **Orientation:** Lock to portrait for client app: `WebApp.lockOrientation()`

- [x] **23.3 — Telegram theme sync**
  - **Create:** `src/hooks/use-telegram-theme.ts`
  - **What:** Hook that reads `WebApp.themeParams` and maps to our CSS variables. Auto-switches dark/light mode to match Telegram app theme.
  - **CSS variables from Telegram:**
    ```
    --tg-theme-bg-color → --surface-primary
    --tg-theme-text-color → foreground
    --tg-theme-hint-color → muted-foreground
    --tg-theme-link-color → --accent
    --tg-theme-button-color → --accent
    --tg-theme-button-text-color → accent-foreground
    --tg-theme-secondary-bg-color → --surface-secondary
    --tg-theme-section-bg-color → --surface-elevated
    --tg-theme-bottom-bar-bg-color → bottom tab bar bg
    --tg-color-scheme → dark/light mode toggle
    ```
  - **Listen to** `themeChanged` event → re-apply mappings
  - **Viewport:** Use `--tg-viewport-stable-height` for layouts instead of `100vh` (avoids keyboard resize flicker)

- [x] **23.4 — Telegram MainButton + BackButton integration**
  - **Create:** `src/hooks/use-telegram-buttons.ts`
  - **What:** Hook for controlling Telegram native buttons from any page:
    ```tsx
    export function useTelegramMainButton(text: string, onClick: () => void, options?: {
      color?: string; textColor?: string; isActive?: boolean; hasShineEffect?: boolean;
    }) {
      useEffect(() => {
        if (!isTelegram()) return;
        const btn = tg().MainButton;
        btn.setText(text);
        if (options?.color) btn.color = options.color;
        if (options?.hasShineEffect) btn.hasShineEffect = true;
        btn.onClick(onClick);
        btn.show();
        return () => { btn.offClick(onClick); btn.hide(); };
      }, [text, onClick]);
    }
    ```
  - **Usage across app:**
    - Booking confirmation → MainButton: "Confirm Booking" (shine effect)
    - Booking flow step → SecondaryButton: "Back" (left position)
    - Client feed → MainButton hidden (no global action)
    - Master calendar → MainButton: "New Appointment"
    - Payment page → MainButton: "Pay {amount}" with progress spinner during payment
  - **BackButton:** Show on all nested pages. Click → `router.back()`. Hide on root tabs (feed, calendar, masters, profile).

- [x] **23.5 — Haptic feedback everywhere**
  - **Modify:** All interactive components throughout the app
  - **Rules:**
    - `haptic.selection()` → on every tab switch, toggle, radio select
    - `haptic.impact('light')` → on button tap, card tap
    - `haptic.impact('medium')` → on drag-and-drop grab/release
    - `haptic.impact('heavy')` → on pull-to-refresh trigger
    - `haptic.success()` → booking confirmed, payment success, review submitted
    - `haptic.error()` → form validation fail, booking conflict, payment fail
  - **Wrap in helper:** `haptic.impact('light')` is a no-op outside Telegram (safe to call everywhere)

- [x] **23.6 — Telegram CloudStorage for preferences**
  - **Create:** `src/lib/telegram/cloud-storage.ts`
  - **What:** Use Telegram CloudStorage (1024 items, persists across devices) to store user preferences:
    - `preferred_locale` — language preference
    - `last_viewed_tab` — which tab was active last
    - `favorite_master_ids` — quick access list
    - `notification_preferences` — reminder timing
    - `theme_override` — if user chose different theme from Telegram default
  - **Fallback:** If not in Telegram, use `localStorage`
  - **Pattern:**
    ```tsx
    export async function getCloudItem(key: string): Promise<string | null> {
      if (isTelegram()) {
        return new Promise(resolve => tg().CloudStorage.getItem(key, (err, val) => resolve(val || null)));
      }
      return localStorage.getItem(key);
    }
    ```

- [x] **23.7 — Telegram QR scanner for master codes**
  - **Modify:** Master search flow + QR code feature (Phase 22.3)
  - **What:** In Telegram, instead of phone camera QR reader, use native Telegram QR scanner:
    ```tsx
    function scanMasterQR() {
      if (isTelegram()) {
        tg().showScanQrPopup({ text: 'Scan master QR code' }, (result) => {
          if (result) {
            // result = URL like https://cres-ca.com/uk/masters/uuid
            router.push(extractPath(result));
            tg().closeScanQrPopup();
          }
        });
      } else {
        // Web fallback: open camera with jsQR library
      }
    }
    ```
  - **Add to:** Client masters tab — "Scan QR" button next to search bar

- [x] **23.8 — Telegram geolocation for nearby masters**
  - **Modify:** Map page + master search
  - **What:** Use Telegram `LocationManager` instead of browser `navigator.geolocation` (more reliable on mobile, proper permission flow):
    ```tsx
    async function getLocation(): Promise<{lat: number, lng: number} | null> {
      if (isTelegram()) {
        const lm = tg().LocationManager;
        if (!lm.isInited) await new Promise(r => lm.init(r));
        if (!lm.isLocationAvailable) return null;
        return new Promise(resolve => lm.getLocation((data) => {
          resolve(data ? { lat: data.latitude, lng: data.longitude } : null);
        }));
      }
      // Browser fallback
      return new Promise(resolve => navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null)
      ));
    }
    ```
  - **Benefit:** Higher accuracy (includes altitude, speed, course), better permission UX

- [x] **23.9 — Add to Home Screen prompt**
  - **Create:** `src/components/shared/home-screen-prompt.tsx`
  - **What:** After 3rd use (or after first booking), show a subtle banner (text through i18n: `t('tg.addToHome')`). On tap:
    ```tsx
    tg().addToHomeScreen();
    ```
  - **Track:** Store in CloudStorage `home_screen_prompted: true` so we don't ask again.
  - **Check:** `tg().checkHomeScreenStatus()` — if already added, don't show prompt.

- [x] **23.10 — Biometric auth for sensitive actions**
  - **What:** For payments, viewing client health data, or accessing consent forms, optionally require biometric verification:
    ```tsx
    async function requireBiometric(reason: string): Promise<boolean> {
      if (!isTelegram()) return true; // skip outside TG
      const bm = tg().BiometricManager;
      if (!bm.isInited) await new Promise(r => bm.init(r));
      if (!bm.isBiometricAvailable) return true; // skip if not available
      return new Promise(resolve => bm.authenticate({ reason }, (success) => resolve(success)));
    }
    ```
  - **Use cases:** Confirm large payment, view client medical records (HIPAA-like protection), sign consent form

- [x] **23.11 — Telegram-native popups and confirmations**
  - **Modify:** All `sonner` toast / `confirm()` calls
  - **What:** In Telegram, use native popups instead of web-based ones:
    ```tsx
    export function showConfirm(message: string): Promise<boolean> {
      if (isTelegram()) {
        return new Promise(resolve => tg().showConfirm(message, resolve));
      }
      return Promise.resolve(window.confirm(message));
    }
    export function showAlert(message: string): Promise<void> {
      if (isTelegram()) {
        return new Promise(resolve => tg().showAlert(message, resolve));
      }
      window.alert(message);
      return Promise.resolve();
    }
    ```
  - **Custom popups** for important actions (cancel booking, delete client):
    ```tsx
    tg().showPopup({
      title: 'Cancel booking?',
      message: 'Cancellation fee may apply.',
      buttons: [
        { id: 'cancel', type: 'destructive', text: 'Yes, cancel' },
        { id: 'keep', type: 'default', text: 'Keep booking' },
      ]
    }, (buttonId) => { if (buttonId === 'cancel') cancelBooking(); });
    ```

- [x] **23.12 — Verify Phase 23**
  - Mini App opens fullscreen. Safe areas correct on all devices. Haptic feedback on all interactions. Theme syncs with Telegram. MainButton shows contextually. QR scanner opens natively. Location works. Home screen prompt shows. Biometrics gate sensitive actions. Native popups replace browser confirms.
  - Test on: iOS Telegram, Android Telegram, Telegram Desktop (graceful degradation)
  - `npm run build` passes

---

## UI LIBRARIES REFERENCE

**Already installed:**
- `framer-motion` / `motion` — animation engine (spring physics, gestures, layout animations, AnimatePresence)
- `shadcn` (base-ui) — primitive components (Button, Card, Dialog, Input, etc.)
- `lucide-react` — icons

**Ready-made components** (107 files in `D:/Claude.cres-ca/components/`):
Reference snippets from 21st.dev. Use as building blocks — adapt to our design tokens, don't copy blindly.

**Additional libraries to consider** (install only when needed):

| Library | What for | Install |
|---|---|---|
| Aceternity UI | Premium effects: floating navbar, sidebar, 3D cards, compare slider, timeline, spotlight, bento grid, infinite cards | Copy components from https://ui.aceternity.com — no npm package, just copy-paste TSX |
| Magic UI | Animated counters, shimmer, marquee, orbit animation, border beam, confetti | `npx magicui-cli add [component]` or copy from https://magicui.design |

**Key Aceternity components for our project:**
| Component | Use in CRES-CA |
|---|---|
| `Floating Navbar` | Client app — hide on scroll down, show on scroll up |
| `Sidebar` | Master dashboard — expandable, mobile-responsive |
| `Compare` | Before/After photo slider (already matches our need exactly) |
| `Timeline` | Client appointment history, master activity log |
| `Bento Grid` | Dashboard overview — stat cards in asymmetric grid |
| `Focus Cards` | Master selection — blur non-focused cards |
| `Infinite Moving Cards` | Landing page testimonials carousel |
| `Animated Modal` | Booking confirmation, payment flow |
| `Apple Cards Carousel` | Service cards horizontal scroll |
| `Carousel` | Top masters horizontal scroll on client feed |
| `Floating Dock` | Master dashboard — quick actions dock (new appointment, add client) |
| `Tabs` | Client card tabs (Info, History, Health, Files) with animated transitions |
| `3D Card Effect` | Master profile card with hover depth |
| `Spotlight` | Featured/promoted masters highlight |
| `Aurora Background` | Landing page hero background |
| `Sparkles` | Confetti on booking confirmed, goal reached |

**Rules for external components:**
1. Only copy what we actually use — no installing full libraries "just in case"
2. Adapt all copied components to use our design tokens (colors, radius, spacing)
3. All external components MUST support dark mode
4. All animations MUST respect `prefers-reduced-motion: reduce`
5. Test on mobile (320px width) — if it looks broken, simplify

---

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
