/** --- YAML
 * name: PageTransition
 * description: Переход между Mini App страницами в стиле Telegram-iOS — лёгкий
 *              fade + slide справа. Длительность ~220мс. Уважает prefers-reduced-
 *              motion (тогда отдаёт children без обёртки). Использует
 *              AnimatePresence mode="wait" с ключом по pathname.
 * created: 2026-05-09
 * --- */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EASE } from './design';

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -4 }}
        transition={EASE.emphasized}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
