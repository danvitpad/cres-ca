/** --- YAML
 * name: AddBlockCard
 * description: Карточка-приглашение «Добавить такой-то блок» в стиле dashed border
 *              + анимированный hover-lift. Используется на публичных страницах
 *              (мастер / салон / клиент-профиль) когда раздел ещё не заполнен и
 *              надо мягко позвать пользователя его дополнить. Парный компонент —
 *              CenterPopup (см. ниже): popup открывается из центра экрана как в
 *              iOS, не «sheet» снизу. Если в продукт-задаче я слышу «оформи как
 *              блок для добавления» — речь про этот файл.
 * created: 2026-04-27
 * --- */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

/* ─── AddBlockCard ────────────────────────────────────────────────── */

interface AddBlockCardProps {
  title: string;
  description: string;
  /** Custom icon override (default: Plus) */
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
}

export function AddBlockCard({ title, description, icon, onClick, className }: AddBlockCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      className={
        'group relative w-full overflow-hidden rounded-2xl border-2 border-dashed transition-colors text-left ' +
        'border-neutral-300 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-300 ' +
        (className ?? '')
      }
      style={{ padding: '20px 22px', background: 'transparent' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform group-hover:scale-105 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {icon ?? <Plus className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{description}</div>
        </div>
      </div>
    </motion.button>
  );
}

/* ─── CenterPopup (Apple-style) ───────────────────────────────────── */

interface CenterPopupProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Хороший дефолт под форму — 480px. Можно перебить. */
  maxWidth?: number;
  children: ReactNode;
  /** Если хочешь свой футер — передай. Иначе ничего не рендерится. */
  footer?: ReactNode;
}

export function CenterPopup({ open, onClose, title, maxWidth = 480, children, footer }: CenterPopupProps) {
  // Esc → close + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth,
              width: 'calc(100vw - 32px)',
              maxHeight: 'calc(100dvh - 32px)',
            }}
            className="relative flex flex-col overflow-hidden rounded-3xl bg-card shadow-2xl shadow-black/30 border border-border"
          >
            {title && (
              <div className="border-b border-border px-6 py-4 text-center">
                <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            {footer && (
              <div className="border-t border-border bg-background/40 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── usePopupState helper — для удобства ──────────────────────────── */

export function usePopupState(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
  };
}
