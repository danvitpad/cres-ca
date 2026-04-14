# PHASE 1: AUTH SYSTEM

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
