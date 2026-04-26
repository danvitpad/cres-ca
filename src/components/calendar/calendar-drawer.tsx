/** --- YAML
 * name: CalendarDrawer
 * description: Fresha-style right-side drawer for calendar settings, waitlist, filters, and analytics
 * --- */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

type CalendarDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
  theme: 'light' | 'dark';
};

// Drawer-фон совпадает с фоном страницы dashboard (var(--color-bg)) — чтобы
// drawer выглядел как продолжение календаря, а не «инородный» black/white блок.
// Тонкие border'ы / hover'ы остаются как контраст.
const LIGHT = {
  bg: 'var(--color-bg, #fafafa)',
  border: 'var(--color-border, #e5e5e5)',
  text: 'var(--color-text, #0a0a0a)',
  textMuted: 'var(--color-text-secondary, #737373)',
  headerBg: 'var(--color-bg, #fafafa)',
  controlBg: 'var(--color-surface-elevated, #f5f5f5)',
  controlHover: 'var(--color-surface, #ebebeb)',
};

const DARK = {
  bg: 'var(--color-bg, #0a0a0a)',
  border: 'var(--color-border, #1f1f23)',
  text: 'var(--color-text, #e5e5e5)',
  textMuted: 'var(--color-text-secondary, #b3b3b3)',
  headerBg: 'var(--color-bg, #0a0a0a)',
  controlBg: 'var(--color-surface-elevated, #18181b)',
  controlHover: 'var(--color-surface, #1f1f23)',
};

export function CalendarDrawer({ open, onClose, title, width = 380, children, theme }: CalendarDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;

  // Escape закрывает drawer — нативно, как в Fresha/Notion/Linear.
  useEscapeKey(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            flexShrink: 0,
            borderLeft: `0.8px solid ${C.border}`,
            backgroundColor: C.bg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* Header — Fresha: title + 3 control buttons (close, minimize, focus) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: `0.8px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.text,
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
