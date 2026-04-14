# Project Structure

Run all commands from `D:/Claude.cres-ca/app/`.

```
D:/Claude.cres-ca/app/
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── globals.css         ← Tailwind + shadcn theme (DO NOT modify unless changing colors)
│   │   ├── layout.tsx          ← Root HTML layout (fonts, metadata)
│   │   ├── [locale]/           ← i18n dynamic segment (uk/ru/en)
│   │   │   ├── layout.tsx      ← NextIntlClientProvider wrapper
│   │   │   ├── (landing)/      ← Public pages (no auth required)
│   │   │   │   ├── page.tsx    ← Landing page
│   │   │   │   ├── contact/page.tsx  ← Contact / Support form
│   │   │   │   └── layout.tsx  ← Landing layout with footer
│   │   │   ├── (auth)/         ← Login/Register pages
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/    ← Master/Salon admin panel (auth required)
│   │   │   │   ├── layout.tsx  ← Sidebar navigation
│   │   │   │   ├── calendar/page.tsx
│   │   │   │   ├── clients/page.tsx
│   │   │   │   ├── services/page.tsx
│   │   │   │   ├── finance/page.tsx
│   │   │   │   ├── inventory/page.tsx
│   │   │   │   ├── marketing/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   └── (client)/       ← Client-facing pages (auth required)
│   │   │       ├── layout.tsx  ← Bottom tab bar (5 tabs: Feed|Calendar|+Book|Masters|Profile)
│   │   │       ├── feed/page.tsx       ← Home tab: Instagram-style feed from followed masters
│   │   │       ├── calendar/page.tsx   ← Unified client calendar (all masters)
│   │   │       ├── book/page.tsx       ← Booking flow (opened from center "+" tab)
│   │   │       ├── history/page.tsx
│   │   │       ├── masters/page.tsx    ← Masters tab: search + map + followed list
│   │   │       ├── map/page.tsx
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
│   │   ├── supabase/client.ts ← Browser Supabase client
│   │   ├── supabase/server.ts ← Server Supabase client
│   │   ├── supabase/admin.ts  ← Service-role client (cron/webhooks)
│   │   ├── ai/               ← OpenRouter integration
│   │   ├── payments/          ← LiqPay integration
│   │   ├── telegram/          ← Telegram Bot + Mini App helpers
│   │   ├── i18n/config.ts    ← Locale list
│   │   ├── i18n/request.ts   ← next-intl server config
│   │   └── utils.ts          ← cn() utility
│   ├── stores/
│   │   └── auth-store.ts     ← Zustand auth store
│   ├── hooks/
│   │   └── use-subscription.ts ← Subscription check hook
│   ├── types/
│   │   ├── index.ts           ← Core types + subscription config
│   │   └── database.ts        ← Supabase generated types (auto)
│   ├── messages/
│   │   ├── uk.json            ← Ukrainian translations
│   │   ├── ru.json            ← Russian translations
│   │   └── en.json            ← English translations
│   └── middleware.ts          ← next-intl locale routing
├── supabase/
│   └── migrations/            ← SQL migrations (numbered 00001_..., 00002_..., etc.)
├── public/
├── next.config.ts             ← Next.js + next-intl config
├── package.json
└── tsconfig.json
```

## Workspace layout (parent folder)

```
D:/Claude.cres-ca/
├── CLAUDE.md          ← single source of truth (slim index)
├── .knowledge/        ← this folder (project knowledge base)
├── .agents/           ← 3 sector agents (client/master/salon)
├── .claude/           ← Claude Code settings + generic plugin skills
├── references/        ← UI snippets, Fresha cloning assets, original brief
└── app/               ← the actual Next.js project
```
