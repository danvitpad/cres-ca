/** --- YAML
 * name: BottomSheet
 * description: Bottom sheet overlay for mobile actions. Auto-sizes to content
 *              up to maxHeight that respects Telegram chrome (top buffer).
 *              snapPoints kept for API compat but не используются (height
 *              теперь auto + flex, как у profile-edit, что работает на iOS).
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useTrackSheetOpen } from '@/lib/miniapp/use-sheet-open';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Kept for backwards-compat — not used (sheet auto-sizes now). */
  snapPoints?: number[];
  children: React.ReactNode;
  className?: string;
  /** Inline-стили для самой шторки — нужно для Mini App, чтобы не
   *  наследовать shadcn `bg-card` (тёмный в системной dark). */
  sheetStyle?: React.CSSProperties;
}

export function BottomSheet({
  open,
  onClose,
  children,
  className,
  sheetStyle,
}: BottomSheetProps) {
  // Регистрация в глобальном счётчике — layout прячет bottom-nav пока есть
  // хоть одна открытая шторка.
  useTrackSheetOpen(open);
  // Mounted gate — createPortal требует document.body, который недоступен в SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  // Портал в document.body — иначе шторка живёт внутри PageTransition (motion.div
  // с transform), который для position:fixed становится containing block. Sheet
  // не дотягивает до низа экрана → виден чёрный прямоугольник под формой.
  return createPortal(
    <div
      className="fixed z-50 animate-fade-in"
      style={{
        // Backdrop стартует точно с низа Telegram-шапки — никакой тёмной
        // полосы над шторкой в Telegram chrome area.
        top: 'var(--tg-content-top, 0px)',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn('rounded-t-2xl shadow-[var(--shadow-overlay)]', className)}
        style={{
          // Шторка занимает весь backdrop от top:0 до bottom:0.
          // bg-card убран — shadcn-токен рендерится тёмным при системной
          // dark-теме на iOS даже когда Mini App светлый.
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--m-surface, #ffffff)',
          ...sheetStyle,
        }}
      >
        {/* Drag handle (визуальный индикатор, без resize) */}
        <div className="flex items-center justify-center py-3" style={{ flexShrink: 0 }}>
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div
          className="overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] scrollbar-thin"
          style={{ flex: 1, minHeight: 0 }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
