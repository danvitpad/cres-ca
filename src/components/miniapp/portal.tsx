/** --- YAML
 * name: MiniAppPortal
 * description: Рендерит детей в document.body — выходит из PageTransition
 *              motion.div с transform. Без portal'а любой position:fixed
 *              внутри Mini App страницы привязывается к границам transformed
 *              parent'а (которая = область PageTransition), а не к viewport.
 *
 *              Дополнительно оборачивает children в <div data-theme=...>
 *              c текущей темой Mini App. Иначе portal-контент (в document.body)
 *              выходит из .miniapp-scope[data-theme] и теряет тему — если у
 *              ОС/Telegram включён prefers-color-scheme: dark, на :root
 *              срабатывает @media и --m-surface становится #1a1a1d, sheet
 *              получает тёмный фон в светлой Mini App.
 *
 *              Используется во всех Mini App компонентах с position:fixed:
 *              <MiniAppPortal><div style={{position:'fixed', ...}}>...</div></MiniAppPortal>
 * created: 2026-05-18
 * updated: 2026-05-19 (+ data-theme wrapper, FONT_BASE для inheritance шрифта)
 * --- */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMiniAppTheme } from './theme';
import { FONT_BASE } from './design';

export function MiniAppPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useMiniAppTheme();
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      data-theme={theme}
      className="miniapp-scope"
      style={{ ...FONT_BASE }}
    >
      {children}
    </div>,
    document.body,
  );
}
