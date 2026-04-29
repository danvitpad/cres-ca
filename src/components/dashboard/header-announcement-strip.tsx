/** --- YAML
 * name: HeaderAnnouncementStrip
 * description: Auto-rotating service announcement strip for dashboard header center zone. Fresha-style with type indicators, dismiss, AnimatePresence.
 * created: 2026-04-16
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertTriangle, ArrowUpCircle, Info } from 'lucide-react';
import type { FTheme } from '@/lib/dashboard-theme';
import type { Announcement } from '@/hooks/use-announcements';

interface Props {
  announcements: Announcement[];
  dismiss: (id: string) => void;
  theme: FTheme;
  isDark: boolean;
}

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string; dotColor: string }> = {
  info:    { icon: Info,            color: '#3b82f6', dotColor: '#3b82f6' },
  promo:   { icon: Sparkles,       color: 'var(--color-accent)', dotColor: 'var(--color-accent)' },
  warning: { icon: AlertTriangle,  color: '#f59e0b', dotColor: '#f59e0b' },
  update:  { icon: ArrowUpCircle,  color: '#10b981', dotColor: '#10b981' },
};

export function HeaderAnnouncementStrip({ announcements, dismiss, theme: F, isDark }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  const count = announcements.length;

  // Auto-rotate every 5s, pause on hover
  useEffect(() => {
    if (count <= 1 || hovered) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % count);
    }, 5000);
    return () => clearInterval(timer);
  }, [count, hovered]);

  // Clamp index if announcements shrink
  useEffect(() => {
    if (activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  if (count === 0) return null;

  const current = announcements[activeIndex];
  if (!current) return null;

  const cfg = TYPE_CONFIG[current.type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 500,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 28px 0 0',
            width: '100%',
          }}
        >
          {/* Type indicator dot/icon */}
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${cfg.color}18`,
          }}>
            <Icon style={{ width: 13, height: 13, color: cfg.color }} />
          </div>

          {/* Title */}
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: F.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '18px',
          }}>
            {current.title}
          </span>

          {/* Optional link */}
          {current.link && (
            <a
              href={current.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: cfg.color,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              {current.link_label || 'Подробнее'}
            </a>
          )}

          {/* Pagination dots */}
          {count > 1 && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 4 }}>
              {announcements.map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => setActiveIndex(i)}
                  style={{
                    width: i === activeIndex ? 12 : 5,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: i === activeIndex ? cfg.color : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dismiss button — visible on hover */}
      <button
        onClick={() => dismiss(current.id)}
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: 'none',
          backgroundColor: 'transparent',
          color: F.textSecondary,
          cursor: 'pointer',
          opacity: hovered ? 0.8 : 0,
          transition: 'opacity 150ms',
          padding: 0,
        }}
      >
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}
