/** --- YAML
 * name: PageTransition
 * description: Кросс-фейд между страницами Mini App. Раньше использовался
 *              translateX-slide, но любой transform на родительском элементе
 *              ломает position:fixed внутри страницы (CSS containing block) —
 *              floating-кнопки «+» и календарь на /calendar при переходе
 *              «прыгали» сверху вниз. Теперь только opacity-fade, чтобы
 *              fixed-элементы оставались чётко привязаны к viewport.
 *              Respects prefers-reduced-motion.
 * created: 2026-05-09
 * updated: 2026-05-10
 * --- */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
          style={{ minHeight: '100%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
