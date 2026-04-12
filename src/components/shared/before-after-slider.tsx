/** --- YAML
 * name: Before/After Slider
 * description: Draggable divider comparing two images. Pure React, no deps.
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useRef, useState } from 'react';

type Props = {
  beforeUrl: string;
  afterUrl: string;
  caption?: string | null;
};

export function BeforeAfterSlider({ beforeUrl, afterUrl, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const draggingRef = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, p)));
  }, []);

  const onDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    update(e.clientX);
  };
  const onUp = () => {
    draggingRef.current = false;
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-900 select-none touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img src={afterUrl} alt="after" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          <img src={beforeUrl} alt="before" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
          style={{ left: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/40 backdrop-blur flex items-center justify-center text-white text-xs"
          style={{ left: `${pct}%` }}
        >
          ⇆
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">До</span>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">После</span>
      </div>
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
