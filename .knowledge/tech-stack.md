# Tech Stack (exact versions — DO NOT change)

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
| Animation | `framer-motion` / `motion` | installed |
| Payments | LiqPay (custom integration) | — |
| AI | OpenRouter API (free models) | — |
| Telegram | Bot API + Mini App SDK | — |

## Next.js 16 warning
Next.js 16 shows `"middleware" file convention is deprecated, use "proxy"`. **IGNORE for now** — `next-intl` still uses middleware. Will migrate later.

## Next.js is outdated in your training data
This is Next.js 16 with breaking changes. Read `node_modules/next/dist/docs/` before writing code involving routing, rendering, or caching. Heed deprecation notices.
