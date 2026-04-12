/** --- YAML
 * name: CalendarDrawer
 * description: Fresha-style right-side drawer for calendar settings, waitlist, filters, and analytics
 * --- */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2 } from 'lucide-react';

type CalendarDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
  theme: 'light' | 'dark';
};

const LIGHT = {
  bg: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  headerBg: '#ffffff',
  controlBg: '#f5f5f5',
  controlHover: '#ebebeb',
};

const DARK = {
  bg: '#000000',
  border: '#1a1a1a',
  text: '#e5e5e5',
  textMuted: '#b3b3b3',
  headerBg: '#000000',
  controlBg: '#000000',
  controlHover: '#1a1a1a',
};

export function CalendarDrawer({ open, onClose, title, width = 380, children, theme }: CalendarDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;

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
