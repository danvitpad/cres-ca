# PHASE 13: LANDING PAGE POLISH + THREE.JS

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
