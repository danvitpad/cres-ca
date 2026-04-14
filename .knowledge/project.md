# CRES-CA — Project Overview

**Domain:** cres-ca.com

**CRES-CA** is a **universal CRM platform for ANY service industry** — beauty salons, nail artists, dentists, massage therapists, plumbers, tutors. It connects **clients** with **masters** (service providers) and **salons** (multi-master businesses).

**Business model:** We are a middleman. We charge masters/salons a monthly subscription for the platform. Clients use it for free.

**Two interfaces:**
1. **Web app** (Next.js) — full-featured for all roles
2. **Telegram Mini App** — same web app loaded inside Telegram WebView

**Three personas / sectors:**
- **Client** — `src/app/[locale]/(client)/**` — Instagram-style social experience
- **Master (solo)** — `src/app/[locale]/(dashboard)/**` solo features (calendar, clients, services, basic finance, inventory)
- **Salon / team** — `src/app/[locale]/(dashboard)/**` team features (team/, shifts/, payrun/, equipment/, locations/, multi-master calendar, queue, segments, reports, campaigns)

**Production:** https://app-seven-fawn-29.vercel.app (GitHub auto-deploy from Vercel)

**Quick commands (run from `D:/Claude.cres-ca/app/`):**
```bash
npm run dev      # dev server
npm run build    # verify build
npm run lint     # ESLint
```
