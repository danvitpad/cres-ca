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
  // Оба класса: `.miniapp-scope` несёт мастерские overrides Tailwind-цветов
  // и общие токены, `.od-client-mini-app` несёт scoped CSS-переменные
  // клиентского мини-аппа (`--surface`, `--accent`, `--accent-2`, `--a-600`,
  // `--fg`/`--fg-2`/`--fg-3`, `--border`). Без второго класса все sheet'ы
  // клиента, идущие через portal в document.body, ломались — переменные
  // были undefined → баннеры/иконки/рейтинг-sheet рендерились без цветов.
  // Мастеру второй класс не мешает: его страницы своих overrides не имеют
  // через `.od-client-mini-app`, а мастерские scope'ы (`.od-master-*`)
  // навешиваются на саму страницу, не нужны в portal-обёртке.
  return createPortal(
    <div
      data-theme={theme}
      className="miniapp-scope od-client-mini-app"
      style={{ ...FONT_BASE }}
    >
      {children}
    </div>,
    document.body,
  );
}
