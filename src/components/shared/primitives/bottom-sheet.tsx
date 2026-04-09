/** --- YAML
 * name: BottomSheet
 * description: Draggable bottom sheet overlay for mobile actions with snap points
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  snapPoints?: number[];
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  snapPoints = [0.5, 0.9],
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, dragging: false });
  const [heightPercent, setHeightPercent] = useState(snapPoints[0] ?? 0.5);

  useEffect(() => {
    if (open) setHeightPercent(snapPoints[0] ?? 0.5);
  }, [open, snapPoints]);

  const snapTo = useCallback(
    (current: number) => {
      if (current < 0.15) {
        onClose();
        return;
      }
      let closest = snapPoints[0] ?? 0.5;
      let minDist = Math.abs(current - closest);
      for (const sp of snapPoints) {
        const dist = Math.abs(current - sp);
        if (dist < minDist) {
          minDist = dist;
          closest = sp;
        }
      }
      setHeightPercent(closest);
    },
    [snapPoints, onClose],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      startY: e.clientY,
      startHeight: sheetRef.current?.getBoundingClientRect().height ?? 0,
      dragging: true,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dy = dragRef.current.startY - e.clientY;
    const newHeight = dragRef.current.startHeight + dy;
    const vh = window.innerHeight;
    setHeightPercent(Math.max(0.1, Math.min(0.95, newHeight / vh)));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.dragging = false;
    snapTo(heightPercent);
  }, [heightPercent, snapTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-2xl bg-card shadow-[var(--shadow-overlay)]',
          'transition-[height] duration-200 ease-out',
          className,
        )}
        style={{
          height: `${heightPercent * 100}vh`,
          transition: dragRef.current.dragging ? 'none' : undefined,
        }}
      >
        <div
          className="flex cursor-grab items-center justify-center py-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] scrollbar-thin" style={{ height: 'calc(100% - 40px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
