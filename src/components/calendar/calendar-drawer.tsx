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
  bg: '#ffffff',
  border: 'rgba(13,148,136,0.13)',
  text: '#0a0a0a',
  textMuted: '#64607a',
  headerBg: '#ffffff',
  controlBg: '#f5f3fb',
  controlHover: '#ebe7f6',
};

const DARK = {
  bg: '#1a1a1d',
  border: 'rgba(45,212,191,0.16)',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  headerBg: '#1a1a1d',
  controlBg: '#1f1f22',
  controlHover: '#1f2240',
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
