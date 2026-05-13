/** --- YAML
 * name: PageTransition
 * description: Slide-переходы между страницами Mini App в стиле Instagram/iOS.
 *              Вглубь (push, /more → /more/clients) — новый экран въезжает
 *              справа. Назад (pop) — текущий уезжает вправо, открывая нижний.
 *              Направление определяется по сравнению глубины pathname с
 *              предыдущей. Floating-элементы внутри страницы (FAB, bottom
 *              sheets) едут вместе с контентом — это часть слайд-эффекта,
 *              а не баг. Respects prefers-reduced-motion.
 * created: 2026-05-09
 * updated: 2026-05-13
 * --- */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

function pathDepth(p: string): number {
  return p.split('/').filter(Boolean).length;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const prevPath = useRef<string>(pathname);
  // 1 — push (вглубь, новый справа); -1 — pop (назад, текущий уходит вправо).
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const prev = prevPath.current;
    if (prev === pathname) return;
    setDirection(pathDepth(pathname) >= pathDepth(prev) ? 1 : -1);
    prevPath.current = pathname;
  }, [pathname]);

  if (reduce) return <>{children}</>;

  return (
    <div style={{ position: 'relative', minHeight: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          initial={{ x: direction > 0 ? '100%' : '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: direction > 0 ? '-100%' : '100%' }}
          transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
          style={{ minHeight: '100%', willChange: 'transform' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
