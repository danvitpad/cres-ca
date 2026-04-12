# CRES-CA Full Website SEO Audit
**Date:** April 10, 2026
**Site:** https://www.cres-ca.com
**Stack:** Next.js on Vercel, Supabase backend, 3 locales (uk/ru/en)

---

## Executive Summary

Solid technical foundation (Next.js SSR, robots.txt, sitemap.xml, JSON-LD, mobile viewport) but critical SEO issues blocking organic performance:
1. Hardcoded `lang="uk"` on all locale variants (including /en, /ru)
2. Auth-protected pages in sitemap showing login walls to crawlers
3. Missing OG images
4. Identical title/description on ALL pages
5. Broken /terms and /privacy links (404)

---

## 1. CRITICAL ISSUES (P0)

### 1.1 Hardcoded `lang="uk"` on ALL pages
**File:** `app/src/app/layout.tsx:62`
`<html>` tag has `lang="uk"` hardcoded. English `/en` and Russian `/ru` pages declare themselves as Ukrainian. Google won't serve them to correct language audiences.
**Fix:** Make `lang` attribute dynamic based on `[locale]` route parameter.

### 1.2 Sitemap contains auth-protected pages
Sitemap lists `/uk/masters`, `/en/masters`, `/uk/map`, `/en/map` — all behind auth middleware. Googlebot gets login walls, wastes crawl budget, possible thin content flag.
**Fix:** Remove protected pages from sitemap OR make `/masters` and `/map` public with "Sign in to book" overlay.

### 1.3 /terms and /privacy return 404
Footer links to `/terms` and `/privacy` on every page — both 404. No page files exist.
**Fix:** Create `terms/page.tsx` and `privacy/page.tsx` with legal content.

### 1.4 No Open Graph image
`og:title`, `og:description`, `og:type` present but NO `og:image`. No preview on social shares, Telegram, Slack, WhatsApp.
**Fix:** Create 1200x630 OG image, add to metadata.

---

## 2. IMPORTANT ISSUES (P1-P2)

### 2.1 Identical title/description on ALL pages (P1)
Every page uses "CRES-CA -- CRM for the service sector" in Ukrainian. No page differentiation in SERPs.
**Fix:** Add `generateMetadata()` per page with unique titles/descriptions.

### 2.2 Canonical always points to root (P1)
`canonical: 'https://cres-ca.com'` set globally — every page tells Google it's the homepage.
**Fix:** Remove static canonical, let Next.js generate per-page canonicals.

### 2.3 Missing per-page hreflang (P1)
Only homepage has language alternates. `/contact` doesn't reference `/en/contact`, `/ru/contact`.
**Fix:** Add `alternates.languages` per page.

### 2.4 Schema type mismatch (P1)
Uses `SoftwareApplication` — fine for SaaS, wrong for consumer services. If targeting end-consumers, switch to `ProfessionalService` or `LocalBusiness`.

### 2.5 No x-default hreflang (P2)
Missing fallback for unmatched languages.
**Fix:** Add `"x-default": "https://cres-ca.com/en"`.

### 2.6 Zero images with alt text (P1)
Only Lucide icons and SVGs. No photos, screenshots, illustrations. Zero Google Images value.
**Fix:** Add real images with descriptive alt text.

### 2.7 Contact page missing schema (P2)
No `Organization` or `ContactPage` schema with contactPoint.

---

## 3. OPPORTUNITIES (Quick Wins)

- Add `/contact`, `/register`, `/terms`, `/privacy` to sitemap
- Create blog/resource section for long-tail traffic
- Add FAQ schema to landing page
- Block `/api/` and `/_next/` in robots.txt
- Add breadcrumb schema to nested pages
- Create standalone `/pricing` page

---

## 4. What's Done Well

- Proper robots.txt with sitemap reference
- Dynamic sitemap generation via Next.js
- JSON-LD structured data on landing page
- Three-locale architecture with next-intl
- Mobile viewport and theme-color set
- PWA manifest present
- Clean URL structure (`/{locale}/{section}`)
- OG basic tags present (title, desc, type, locale)
- Twitter card configured
- SSL/HTTPS enforced on Vercel

---

## 5. Page-by-Page Summary

| Page | Title Unique? | Meta Unique? | H1? | Schema? | Canonical OK? | Content |
|------|:---:|:---:|:---:|:---:|:---:|---|
| `/` | No | No | Yes | Yes | No | Good |
| `/uk` | No | No | Yes | Yes | No | Good |
| `/en` | No | No | Yes | Yes | No | Good |
| `/ru` | No | No | Yes | Yes | No | Good |
| `/contact` | No | No | H2 only | No | No | Medium |
| `/register` | No | No | Yes | No | No | Low |
| `/masters` | No | No | Login wall | No | No | None |
| `/map` | No | No | Login wall | No | No | None |
| `/terms` | 404 | 404 | 404 | 404 | 404 | Missing |
| `/privacy` | 404 | 404 | 404 | 404 | 404 | Missing |

---

## 6. Prioritized Action Plan

| Priority | Issue | Effort | Impact |
|:---:|---|:---:|:---:|
| P0 | Fix `lang` to be dynamic per locale | Low | Critical |
| P0 | Remove protected pages from sitemap | Low | Critical |
| P0 | Create /terms and /privacy pages | Medium | Critical |
| P0 | Add OG image | Low | High |
| P1 | Unique title/description per page | Medium | High |
| P1 | Fix canonical to be page-specific | Low | High |
| P1 | Add real images with alt text | Medium | High |
| P1 | Per-page hreflang alternates | Medium | Medium |
| P2 | Add x-default hreflang | Low | Medium |
| P2 | Contact page schema | Low | Low |
| P2 | FAQ schema on landing | Medium | Medium |
| P2 | Update sitemap with new pages | Low | Low |
| P2 | Block /api/ in robots.txt | Low | Low |
| P3 | Standalone /pricing page | Medium | Medium |
| P3 | Blog/content section | High | Very High |
| P3 | Breadcrumb schema | Low | Low |

---

## Key Files Requiring Changes

- `app/src/app/layout.tsx` — Dynamic `lang`, dynamic canonical, add OG image
- `app/src/app/[locale]/layout.tsx` — Move `<html lang>` here
- `app/src/app/sitemap.ts` — Add public pages, remove protected
- `app/src/middleware.ts` — Consider making /masters public
- `app/public/robots.txt` — Add Disallow rules
- **New:** `terms/page.tsx`, `privacy/page.tsx`, OG image, per-page metadata
