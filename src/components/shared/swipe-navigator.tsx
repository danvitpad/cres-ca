/** --- YAML
 * name: SwipeNavigator
 * description: Глобальный жест свайпа от края экрана. Слева→направо с левого края = назад. Справа→налево с правого края = вперёд. Работает только при стартовом тапе у самого края (≤24px), чтобы не конфликтовать с горизонтальным скроллом контента (календарь, карусели). Подключается один раз на корне Telegram Mini App и web-локали.
 * created: 2026-04-29
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const EDGE_PX = 24;        // насколько близко к краю должен начаться тап
const MIN_DELTA_X = 70;    // минимальная горизонтальная дистанция свайпа
const MAX_DELTA_Y = 60;    // максимальное вертикальное отклонение
const MAX_DURATION_MS = 700; // быстрый жест, не «протащил пальцем»

export function SwipeNavigator() {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let edge: 'left' | 'right' | null = null;
    let activeTouchId: number | null = null;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        edge = null;
        return;
      }
      const t = e.touches[0];
      activeTouchId = t.identifier;
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();

      const w = window.innerWidth;
      if (startX <= EDGE_PX) edge = 'left';
      else if (startX >= w - EDGE_PX) edge = 'right';
      else edge = null;
    }

    function onTouchEnd(e: TouchEvent) {
      if (edge === null) return;
      const t = Array.from(e.changedTouches).find((c) => c.identifier === activeTouchId);
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;

      edge = (() => {
        if (dt > MAX_DURATION_MS) return null;
        if (Math.abs(dy) > MAX_DELTA_Y) return null;
        if (edge === 'left' && dx > MIN_DELTA_X) {
          router.back();
          return null;
        }
        if (edge === 'right' && dx < -MIN_DELTA_X) {
          router.forward();
          return null;
        }
        return null;
      })();
    }

    function onTouchCancel() {
      edge = null;
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [router]);

  return null;
}
