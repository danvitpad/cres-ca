/** --- YAML
 * name: useIsKeyboardOpen
 * description: Возвращает true когда экранная клавиатура (мобильная)
 *              открыта. Работает на iOS/Android через visualViewport API:
 *              если visualViewport.height стали заметно меньше
 *              window.innerHeight — клавиатура подняла часть экрана.
 *              Используется в bottom-sheet'ах TG Mini App чтобы скрыть
 *              CTA-кнопки на время ввода (они всё равно прижаты под
 *              клавиатуру и закрывают поля).
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';

const THRESHOLD = 100; // px — если viewport уменьшился больше чем на это, считаем что клавиатура открыта

export function useIsKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return; // старые браузеры — не сможем определить, считаем закрытой

    function check() {
      const diff = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
      setOpen(diff > THRESHOLD);
    }

    check();
    vv.addEventListener('resize', check);
    return () => vv.removeEventListener('resize', check);
  }, []);

  return open;
}
