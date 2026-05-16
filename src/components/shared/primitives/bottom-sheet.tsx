/** --- YAML
 * name: BottomSheet
 * description: Bottom sheet overlay for mobile actions. Auto-sizes to content
 *              up to maxHeight that respects Telegram chrome (top buffer).
 *              snapPoints kept for API compat but не используются (height
 *              теперь auto + flex, как у profile-edit, что работает на iOS).
 * --- */

'use client';

import { cn } from '@/lib/utils';

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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 animate-fade-in"
      style={{
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
          // Auto-size to content, capped to viewport-height минус Telegram chrome
          // + 24px буфер. Раньше шторка имела explicit height (0.7 * viewport),
          // и на iOS позиционировалась с top за пределы видимой зоны — drag-handle
          // и заголовок терялись. Теперь авто-размер — top шторки всегда
          // на расстоянии (maxHeight - content) от низа viewport-height.
          maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 12px) - 24px)',
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
