/** --- YAML
 * name: InlineEditSheet
 * description: Базовый bottom-sheet (full-screen на mobile, центрированный modal на
 *              desktop) для inline-редактирования отдельного поля публичной страницы
 *              мастера. Закрывается на Escape, click backdrop. Spring-анимация.
 * created: 2026-04-26
 * --- */

'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional footer (Save / Cancel buttons) */
  footer?: ReactNode;
}

export function InlineEditSheet({ open, onClose, title, children, footer }: Props) {
  useEscapeKey(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%', opacity: 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[201] flex max-h-[90dvh] flex-col rounded-t-[24px] bg-white shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-[16px] font-bold text-neutral-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && <div className="border-t border-neutral-100 p-4">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
