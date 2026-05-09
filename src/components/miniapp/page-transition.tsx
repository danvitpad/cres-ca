/** --- YAML
 * name: PageTransition
 * description: iOS-style slide-in transition for Mini App pages.
 *              Enter: slides from right (x: 20px→0) + opacity fade, 200ms spring.
 *              Exit: fades out + subtle scale, taken out of flow via popLayout
 *              so there is no gap or horizontal overflow between pages.
 *              Respects prefers-reduced-motion.
 * created: 2026-05-09
 * updated: 2026-05-09
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
    <div style={{ position: 'relative', minHeight: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{
            opacity: { duration: 0.17, ease: [0.4, 0, 0.2, 1] },
            x: { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 },
            scale: { duration: 0.12, ease: [0.4, 0, 1, 1] },
          }}
          style={{ minHeight: '100%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
