/** --- YAML
 * name: useKeyboardShortcuts
 * description: Hook for binding global keyboard shortcuts on the web surface. Ignores input/textarea/contenteditable by default.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect } from 'react';

export type Shortcut = {
  combo: string; // e.g. 'cmd+k', 'ctrl+shift+f', '/'
  handler: (e: KeyboardEvent) => void;
  allowInInputs?: boolean;
};

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+').map((s) => s.trim());
  const key = parts.pop() ?? '';

  const needCmd = parts.includes('cmd') || parts.includes('meta');
  const needCtrl = parts.includes('ctrl');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt') || parts.includes('option');

  if (needCmd && !e.metaKey) return false;
  if (needCtrl && !e.ctrlKey) return false;
  if (needShift && !e.shiftKey) return false;
  if (needAlt && !e.altKey) return false;

  if (!needCmd && e.metaKey) return false;
  if (!needCtrl && e.ctrlKey) return false;
  if (!needShift && e.shiftKey) return false;
  if (!needAlt && e.altKey) return false;

  return e.key.toLowerCase() === key;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts(shortcuts: readonly Shortcut[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const sc of shortcuts) {
        if (!sc.allowInInputs && isEditable(e.target)) continue;
        if (matches(e, sc.combo)) {
          sc.handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
