/** --- YAML
 * name: BottomSheet (mini-app)
 * description: Swipe-down dismissible modal sheet for mini-app forms. Drag-to-close via framer-motion, safe-area aware.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

export function MiniBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 400) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[#1f2023] text-white',
              'max-h-[90dvh] overflow-hidden flex flex-col',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            style={{
              paddingBottom: 'max(var(--tg-safe-bottom, 0px), env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            {title && (
              <div className="px-5 pb-2 pt-1 text-base font-semibold">{title}</div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
