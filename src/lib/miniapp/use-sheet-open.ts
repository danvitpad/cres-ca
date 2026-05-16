/** --- YAML
 * name: useSheetOpen
 * description: Глобальный счётчик открытых шторок в Mini App.
 *              Любая шторка/модалка вызывает useTrackSheetOpen(true) на маунте
 *              и (false) на анмаунте. Layout читает счётчик и прячет bottom-nav
 *              когда счётчик > 0 — иначе nav-pill торчит из-под шторки на iOS
 *              (z-index ломается из-за framer-motion stacking context).
 * --- */

import { useEffect } from 'react';
import { create } from 'zustand';

interface SheetState {
  count: number;
  push: () => void;
  pop: () => void;
}

const useStore = create<SheetState>((set) => ({
  count: 0,
  push: () => set((s) => ({ count: s.count + 1 })),
  pop: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));

/** Layout / nav читают это чтобы решить — скрывать ли bottom-nav. */
export function useSheetOpen(): boolean {
  return useStore((s) => s.count > 0);
}

/** Вызвать внутри шторки с её open state. Регистрирует/убирает её в счётчике. */
export function useTrackSheetOpen(open: boolean) {
  const push = useStore((s) => s.push);
  const pop = useStore((s) => s.pop);
  useEffect(() => {
    if (!open) return;
    push();
    return () => pop();
  }, [open, push, pop]);
}
