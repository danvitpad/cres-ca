/** --- YAML
 * name: MasterPageSectionTabs
 * description: Sticky-tabs навигация на публичной странице мастера — Fresha-style.
 *              Принимает массив секций (label + anchor id) и подсвечивает текущую
 *              через IntersectionObserver. Скролл по клику — smooth + offset под
 *              sticky-bar.
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
  /** Цветовой акцент страницы (дефолт — violet). */
  accent?: string;
  /** Высота sticky-offset чтобы под bar не залезали якоря. */
  topOffset?: number;
}

export function MasterPageSectionTabs({ sections, accent = '#0d9488', topOffset = 64 }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Берём верхнюю секцию которая в viewport (не ниже viewport top).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${topOffset + 16}px 0px -55% 0px`, threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [sections, topOffset]);

  // Прокручивает активную табу в видимую часть rail на мобильном
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const activeBtn = rail.querySelector<HTMLButtonElement>(`[data-section="${active}"]`);
    if (!activeBtn) return;
    const railRect = rail.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (btnRect.left < railRect.left || btnRect.right > railRect.right) {
      rail.scrollTo({
        left: activeBtn.offsetLeft - 16,
        behavior: 'smooth',
      });
    }
  }, [active]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - topOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div
      className="sticky top-0 z-30 -mx-4 mt-8 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      style={{ ['--page-accent' as string]: accent }}
    >
      <div
        ref={railRef}
        className="-mb-px flex gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-section={s.id}
              onClick={() => go(s.id)}
              className="relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors"
              style={{
                color: isActive ? accent : 'rgb(115 115 115)',
              }}
            >
              {s.label}
              {isActive && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ background: accent }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
