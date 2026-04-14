# Multi-Role Extraction Reference

## Problem

Many SaaS apps have completely different interfaces for different user types. A booking platform might have:
- **Client** — sees booking page, appointment history, profile
- **Solo professional** — sees calendar, client list, services, settings
- **Team/Business** — sees team calendar, staff management, analytics, permissions

Each role has its own registration flow, dashboard, navigation, features, and even design. Cloning just one role gives you ~30% of the app. You need ALL of them.

## Phase 0: Role Discovery

Before any extraction, map out all the roles/personas the site supports.

### Detect Roles from Registration Flow

```
1. Navigate to the signup/registration page
2. Look for role selection:
   - Radio buttons / cards like "I'm a client" / "I'm a professional" / "I'm a business"
   - Different signup URLs (/signup/client, /signup/pro, /signup/business)
   - Different landing pages that lead to different signup flows
   - Pricing page with different tiers that imply different roles
3. Screenshot each option
4. Record:
   - Role name
   - Registration URL/path
   - Required fields per role
   - Onboarding steps per role (does one role have more setup steps?)
```

### Detect Roles from UI

```javascript
(function() {
  const roleSignals = {
    // Check for role-related URL patterns
    urlPatterns: [
      location.pathname,
      ...document.querySelectorAll('a[href]').length > 0
        ? [...document.querySelectorAll('a[href]')]
            .map(a => a.pathname)
            .filter(p => /\/(admin|dashboard|pro|business|team|client|customer|provider|vendor|staff|manager|owner)/.test(p))
        : []
    ],

    // Check for role indicators in the UI
    roleIndicators: [
      // Navigation items that suggest roles
      ...[...document.querySelectorAll('nav a, [class*="sidebar"] a, [class*="menu"] a')]
        .map(a => a.textContent.trim())
        .filter(t => /(team|staff|client|customer|admin|manager|permission|role)/i.test(t)),

      // Check for "Switch to" buttons
      ...[...document.querySelectorAll('button, a')]
        .map(el => el.textContent.trim())
        .filter(t => /switch (to|account)|view as|change role/i.test(t))
    ],

    // Check for role-related meta/data
    metaRoles: (() => {
      try {
        const nextData = window.__NEXT_DATA__;
        if (nextData?.props?.pageProps?.user?.role) return nextData.props.pageProps.user.role;
        if (nextData?.props?.pageProps?.session?.user?.type) return nextData.props.pageProps.session.user.type;
      } catch(e) {}
      return null;
    })(),

    // Check pricing page for role-based tiers
    pricingTiers: [...document.querySelectorAll('[class*="pricing"] [class*="card"], [class*="plan"], [class*="tier"]')]
      .map(el => ({
        name: el.querySelector('h2, h3, [class*="title"]')?.textContent.trim(),
        features: [...el.querySelectorAll('li, [class*="feature"]')].map(li => li.textContent.trim()).slice(0, 10)
      }))
  };

  return JSON.stringify(roleSignals, null, 2);
})();
```

## Phase 1: Per-Role Registration & Onboarding (AUTONOMOUS)

The agent does this ITSELF. No user involvement unless physically blocked.

```
FOR each role (e.g., client, solo_pro, team):

  1. OPEN an incognito/new browser context (clean session, no cookies)

  2. NAVIGATE to the registration page for this role

  3. FILL ALL FIELDS with random realistic data:
     - Name: random realistic name (e.g., "Alex Johnson")
     - Email: testclone-{role}-{random4digits}@test.com
     - Phone: +1-555-{random7digits}
     - Password: CloneTest123!
     - Business name (if needed): "Test {role} Business {random}"
     - Team size, industry, etc.: pick realistic random values
     - Country/timezone: pick plausible defaults
     - Any dropdown: select the first non-placeholder option
     - Any checkbox (terms, privacy): check it

  4. SUBMIT the form

  5. HANDLE the result:
     - SUCCESS → proceed to onboarding
     - EMAIL VERIFICATION REQUIRED → tell user: "Please verify the email for {role} role. I'll wait." → resume when user confirms
     - CAPTCHA → tell user: "CAPTCHA on signup page. Please complete it. I'll wait." → resume
     - SMS VERIFICATION → tell user: "Phone verification needed. Please enter code." → resume
     - OTHER BLOCK → tell user the specific issue, wait for resolution
     - VALIDATION ERROR → fix the specific field (read error message), resubmit

  6. ONBOARDING WIZARD (if any):
     - Click through EVERY step
     - Fill required fields with random realistic data
     - Click "Next" / "Continue" / "Skip" — complete the wizard
     - DO NOT skip wizard steps that show UI — screenshot each one
     - If a step asks to "invite team members": skip/done
     - If a step asks to "connect calendar": skip
     - If a step asks to "add services": add 2-3 random ones

  7. SCREENSHOT the first screen after onboarding (the role's "home")

  8. SAVE session/cookies for later use

  9. RECORD the registration flow:
     {
       role: "solo_pro",
       registrationSteps: [
         { url: "/signup", fields: [...], dataUsed: {...}, screenshot: "..." },
         { url: "/onboarding/step-1", fields: [...], dataUsed: {...}, screenshot: "..." },
         { url: "/onboarding/step-2", fields: [...], dataUsed: {...}, screenshot: "..." }
       ],
       postLoginRedirect: "/dashboard",
       totalSteps: 3,
       blocked: false // or { reason: "email verification", resolvedBy: "user" }
     }
```

## Phase 2: Per-Role Site Extraction

After registering all roles, do a FULL extraction for each role separately:

```
FOR each role:

  1. LOG IN as this role

  2. RUN the full extraction pipeline from SKILL.md Phase 1:
     - Sitemap discovery (this role may see different pages!)
     - Design system (may have different theme/colors per role)
     - Per-page deep extraction
     - Network traffic capture
     - Deep interaction crawl (references/deep-interaction-crawler.md)

  3. SAVE everything in role-specific directories:
     docs/clone-research/roles/{role}/
     docs/clone-research/roles/{role}/pages/
     docs/clone-research/roles/{role}/screenshots/
     docs/clone-research/roles/{role}/SITEMAP.md
     docs/clone-research/roles/{role}/INTERACTIONS.md

  4. NOTE differences from other roles:
     - Pages unique to this role
     - Shared pages with different content/permissions
     - Navigation items unique to this role
     - API endpoints unique to this role
```

## Phase 3: Role Comparison Matrix

After extracting all roles, create `docs/clone-research/ROLE_MATRIX.md`:

```markdown
# Role Comparison Matrix

## Roles Discovered: 3

| Aspect | Client | Solo Pro | Team |
|--------|--------|----------|------|
| Registration fields | 3 | 7 | 12 |
| Onboarding steps | 1 | 3 | 5 |
| Navigation items | 4 | 8 | 12 |
| Dashboard type | Appointment list | Calendar + Stats | Team calendar + Analytics |
| Unique pages | /bookings, /favorites | /calendar, /services, /clients | /team, /analytics, /permissions |
| Shared pages | /profile, /settings | /profile, /settings | /profile, /settings |
| Can manage staff | No | No | Yes |
| Can manage services | No | Yes | Yes |
| Can book appointments | Yes | No | No |
| Sees analytics | No | Basic | Full |

## Shared Components (identical across roles)
- Header (layout same, menu items differ)
- Profile page
- Settings page (but team has extra sections)
- Notification dropdown

## Role-Specific Components
### Client only:
- BookingWidget, ServiceCard, ProviderCard, AppointmentHistory

### Solo Pro only:
- CalendarDayView, CalendarWeekView, ServiceEditor, ClientList

### Team only:
- TeamCalendar, StaffManager, PermissionsPanel, AnalyticsDashboard, RoleSelector

## Database Impact
- Users table needs a `role` enum: client | solo_pro | team_owner | team_member
- Team entities need: teams, team_members, team_invitations tables
- RLS policies differ per role
```

## Phase 4: Unified Architecture

From the role matrix, design the unified app:

```markdown
## Route Structure

/                         → Landing page (public)
/(auth)/login             → Shared login (redirects by role)
/(auth)/signup/client     → Client registration
/(auth)/signup/pro        → Solo pro registration
/(auth)/signup/team       → Team registration

/(client)/                → Client dashboard (layout: ClientLayout)
/(client)/bookings        → My bookings
/(client)/book/[provider] → Booking flow

/(pro)/                   → Pro dashboard (layout: ProLayout)
/(pro)/calendar           → Calendar views
/(pro)/clients            → Client list
/(pro)/services           → Service management

/(team)/                  → Team dashboard (layout: TeamLayout)
/(team)/calendar          → Team calendar
/(team)/staff             → Staff management
/(team)/analytics         → Analytics

/(shared)/profile         → Shared profile (layout adapts to role)
/(shared)/settings        → Shared settings (sections vary by role)

## Middleware
- Check user role from session
- Redirect to correct dashboard after login
- Block unauthorized role access (client can't access /pro/*)

## Component Strategy
- Shared components in /components/shared/
- Role-specific components in /components/{role}/
- Layout components: ClientLayout, ProLayout, TeamLayout (with shared base)
```

## Key Rules for Multi-Role Cloning

1. **Never assume one role is "the" app.** The client-facing booking page and the pro-facing dashboard are EQUAL parts of the product.
2. **Extract every role completely.** Don't shortcut — do the full pipeline for each.
3. **Map shared vs unique clearly.** This drives code reuse decisions.
4. **Role-based routing from day 1.** Don't bolt it on later.
5. **Test cross-role interactions.** Client books → Pro sees it on calendar → Team admin sees analytics. These flows must work end-to-end.
6. **Clone ALL roles by default.** Only skip roles if the user explicitly passed `--roles` to select specific ones. Otherwise do everything.
7. **Register yourself.** Fill signup forms with random data. Only ask the user when physically blocked (CAPTCHA, email verification, SMS code).
