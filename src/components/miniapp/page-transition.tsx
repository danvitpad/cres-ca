/** --- YAML
 * name: PageTransition
 * description: Лёгкий fade-in новой страницы Mini App. Только opacity (без
 *              slide — slide+exit делал «дыру» между страницами 360мс и
 *              ощущался как «дважды грузится»). Длительность 130мс. Без
 *              AnimatePresence wait — новый контент появляется сразу, без
 *              блокировки. Уважает prefers-reduced-motion.
 * created: 2026-05-09
 * updated: 2026-05-09 (subtle fade only — fixed perceived double-load)
 * --- */

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.13, ease: [0.4, 0, 0.2, 1] }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
}
