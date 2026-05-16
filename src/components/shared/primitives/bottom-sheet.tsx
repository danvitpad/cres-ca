/** --- YAML
 * name: BottomSheet
 * description: Bottom sheet overlay for mobile actions. Auto-sizes to content
 *              up to maxHeight that respects Telegram chrome (top buffer).
 *              snapPoints kept for API compat but не используются (height
 *              теперь auto + flex, как у profile-edit, что работает на iOS).
 * --- */

'use client';

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

  if (!open) return null;

  return (
    <div
      className="fixed z-50 animate-fade-in"
      style={{
        // Зажимаем верх под Telegram-шапку. Раньше использовали maxHeight
        // на самой шторке + inset:0 на wrapper — на iOS Telegram это всё равно
        // позволяло шторке заехать наверх за чрому при flex-end alignment.
        // Теперь wrapper физически не покрывает чрому, шторка не может уехать.
        top: 'max(var(--tg-content-top, 0px), 80px)',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'rounded-t-2xl bg-card shadow-[var(--shadow-overlay)]',
          className,
        )}
        style={{
          width: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
    </div>
  );
}
