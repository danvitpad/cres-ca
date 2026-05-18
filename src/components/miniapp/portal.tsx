/** --- YAML
 * name: MiniAppPortal
 * description: Рендерит детей в document.body — выходит из PageTransition
 *              motion.div с transform. Без portal'а любой position:fixed
 *              внутри Mini App страницы привязывается к границам transformed
 *              parent'а (которая = область PageTransition), а не к viewport.
 *              Из-за этого sheet'ы не покрывают весь экран, FAB'ы уплывают
 *              в центр, sticky CTA торчат не там где нужно.
 *
 *              Используется во всех Mini App компонентах с position:fixed:
 *              <MiniAppPortal><div style={{position:'fixed', ...}}>...</div></MiniAppPortal>
 * created: 2026-05-18
 * --- */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function MiniAppPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
