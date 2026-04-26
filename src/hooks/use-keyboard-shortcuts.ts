/** --- YAML
 * name: useKeyboardShortcuts
 * description: Универсальные хук-хелперы для нативного UX —
 *              useEscapeKey(active, callback) и useEnterSubmit(active, callback,
 *              { withModifier }). Активируются только когда `active=true`.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect } from 'react';

/** Escape — закрыть popup/drawer/dialog. По умолчанию срабатывает только когда `active`.
 *  Не срабатывает если фокус внутри контента, помеченного data-skip-escape, чтобы
 *  внутренние редакторы (например textarea с подсказкой Esc) могли перехватить себе. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-skip-escape]')) return;
      e.preventDefault();
      onEscape();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

/** Cmd/Ctrl+Enter — submit. Когда `withModifier=false`, ловим pure-Enter
 *  (только если фокус не внутри textarea/contenteditable). */
export function useEnterSubmit(
  active: boolean,
  onSubmit: () => void,
  options: { withModifier?: boolean } = { withModifier: true },
) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      const wantsModifier = options.withModifier !== false;
      const hasModifier = e.metaKey || e.ctrlKey;
      if (wantsModifier && !hasModifier) return;
      const target = e.target as HTMLElement | null;
      // Pure Enter (без модификатора) — игнорируем многострочные редакторы
      if (!hasModifier && target) {
        const tag = target.tagName;
        if (tag === 'TEXTAREA') return;
        if (target.getAttribute('contenteditable') === 'true') return;
      }
      e.preventDefault();
      onSubmit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onSubmit, options.withModifier]);
}
