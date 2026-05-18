/** --- YAML
 * name: SwipeNavigator
 * description: Интерактивный edge-swipe для возврата назад. Начало касания
 *              у левого края (≤24px) → во время drag'a реально сдвигаем
 *              страницу под пальцем (translateX = dx, с fade на overlay).
 *              На release: если dx > 40% ширины ИЛИ скорость > 0.5px/ms — завершаем
 *              анимацию + router.back(). Иначе плавно возвращаем на 0.
 *              Без дёрганий, как iOS.
 * created: 2026-04-29
 * updated: 2026-05-18 (interactive drag)
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const EDGE_PX = 24;          // насколько близко к краю должен начаться тап
const COMPLETE_RATIO = 0.4;  // dx > 40% ширины = завершить переход
const FAST_VELOCITY = 0.5;   // px/ms — быстрый свайп завершает даже на 20%
const MAX_DELTA_Y_RATIO = 0.5; // если уехали по Y больше чем по X — отменяем

/** Возвращает DOM-элемент текущей PageTransition motion.div'а — это контейнер,
 *  который мы будем двигать. Берём первый <main> > div > div под телеграм-роутом. */
function findPageEl(): HTMLElement | null {
  // PageTransition рендерит: <main> <div(relative,overflow:hidden)> <motion.div(transform)>
  // Тащим motion.div — он содержит весь контент страницы.
  const main = document.querySelector('main');
  if (!main) return null;
  const outer = main.querySelector(':scope > div');
  if (!outer) return null;
  const inner = outer.querySelector(':scope > div');
  return (inner as HTMLElement) ?? null;
}

export function SwipeNavigator() {
  const router = useRouter();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let active = false;
    let pageEl: HTMLElement | null = null;
    let overlay: HTMLDivElement | null = null;
    let activeTouchId: number | null = null;
    let cancelled = false;

    function setProgress(dx: number) {
      if (!pageEl) return;
      const clamped = Math.max(0, dx);
      pageEl.style.transform = `translateX(${clamped}px)`;
      pageEl.style.transition = 'none';
      if (overlay) {
        const w = window.innerWidth || 1;
        const progress = Math.min(1, clamped / w);
        overlay.style.opacity = String(progress * 0.18);
      }
    }

    function reset(animate = true) {
      if (!pageEl) return;
      if (animate) {
        pageEl.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)';
        pageEl.style.transform = 'translateX(0)';
      } else {
        pageEl.style.transition = '';
        pageEl.style.transform = '';
      }
      if (overlay) overlay.remove();
      overlay = null;
      pageEl = null;
      active = false;
    }

    function complete() {
      if (!pageEl) return;
      const w = window.innerWidth;
      pageEl.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
      pageEl.style.transform = `translateX(${w}px)`;
      if (overlay) overlay.style.transition = 'opacity 220ms ease';
      // router.back() триггерит PageTransition exit→enter с новой страницей.
      // Даём время текущему слайду доехать чтобы пользователь видел уход.
      setTimeout(() => {
        if (cancelled) return;
        router.back();
        // PageTransition подменит контент; чистим inline-стили чтобы новая
        // страница не оказалась смещённой.
        setTimeout(() => {
          if (pageEl) {
            pageEl.style.transition = '';
            pageEl.style.transform = '';
          }
          if (overlay) overlay.remove();
          overlay = null;
          pageEl = null;
          active = false;
        }, 30);
      }, 180);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;

      activeTouchId = t.identifier;
      startX = t.clientX;
      startY = t.clientY;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;
      active = true;
      pageEl = findPageEl();
      if (!pageEl) { active = false; return; }

      // Полупрозрачный затемнённый overlay над страницей — иллюзия что под
      // текущей страницей открывается предыдущая.
      overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = '#000';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '5';
      document.body.appendChild(overlay);
    }

    function onTouchMove(e: TouchEvent) {
      if (!active) return;
      const t = Array.from(e.touches).find((c) => c.identifier === activeTouchId);
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Если уехал по Y больше чем по X — отменяем (вертикальный скролл).
      if (Math.abs(dy) > Math.abs(dx) * MAX_DELTA_Y_RATIO && Math.abs(dy) > 12) {
        reset(true);
        return;
      }

      // Считаем скорость для release-решения.
      const now = Date.now();
      const dt = Math.max(1, now - lastTime);
      velocity = (t.clientX - lastX) / dt;
      lastX = t.clientX;
      lastTime = now;

      setProgress(dx);
    }

    function onTouchEnd(e: TouchEvent) {
      if (!active) return;
      const t = Array.from(e.changedTouches).find((c) => c.identifier === activeTouchId);
      if (!t) { reset(true); return; }

      const dx = t.clientX - startX;
      const w = window.innerWidth;
      const shouldComplete = dx > w * COMPLETE_RATIO || (dx > 40 && velocity > FAST_VELOCITY);

      if (shouldComplete) complete();
      else reset(true);
    }

    function onTouchCancel() {
      if (active) reset(true);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      if (overlay) overlay.remove();
    };
  }, [router]);

  return null;
}
