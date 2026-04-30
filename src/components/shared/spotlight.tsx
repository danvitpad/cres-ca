/** --- YAML
 * name: Spotlight
 * description: Contextual onboarding hint overlay. Highlights a target element
 *              with a translucent backdrop and shows a short tooltip. Dismisses
 *              on tap/click anywhere or after 6 seconds. One spotlight per page
 *              load max. Tracks dismissal in profiles.tour_progress via API.
 * created: 2026-04-30
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface SpotlightProps {
  /** Unique key for this spotlight (stored in tour_progress) */
  id: string;
  /** CSS selector of the target element to highlight */
  target: string;
  /** Short hint text */
  text: string;
  /** Position of tooltip relative to target */
  position?: 'top' | 'bottom';
  /** Auto-dismiss after ms (default 6000) */
  timeout?: number;
}

export function Spotlight({ id, target, text, position = 'bottom', timeout = 6000 }: SpotlightProps) {
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from('profiles')
          .select('tour_progress')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const progress = (data as { tour_progress?: Record<string, boolean> } | null)?.tour_progress ?? {};
        if (progress[id]) return;

        const el = document.querySelector(target);
        if (!el || cancelled) return;
        setRect(el.getBoundingClientRect());
        setVisible(true);
      } catch {
        // best-effort
      }
    })();
    return () => { cancelled = true; };
  }, [id, target]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), timeout);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, timeout]);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    setVisible(false);
    fetch('/api/account/tour-dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotlightId: id }),
    }).catch(() => {});
  }, [id]);

  if (!visible || !rect) return null;

  const pad = 8;
  const highlightStyle: React.CSSProperties = {
    position: 'fixed',
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
    pointerEvents: 'none',
    zIndex: 9998,
  };

  const tooltipTop = position === 'top'
    ? rect.top - pad - 52
    : rect.bottom + pad + 8;

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(rect.left, window.innerWidth - 280)),
    top: tooltipTop,
    maxWidth: 260,
    zIndex: 9999,
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Click-anywhere overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismiss}
            style={{
              position: 'fixed', inset: 0, zIndex: 9997,
              cursor: 'pointer',
            }}
          />
          {/* Highlight cutout */}
          <div style={highlightStyle} />
          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, y: position === 'top' ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            style={tooltipStyle}
            onClick={dismiss}
          >
            <div
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: 13,
                lineHeight: 1.45,
                fontWeight: 500,
                padding: '10px 14px',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              }}
            >
              {text}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
