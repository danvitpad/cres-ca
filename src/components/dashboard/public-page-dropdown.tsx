/** --- YAML
 * name: Public page header dropdown
 * description: Compact header button showing master's public URL status with a dropdown
 *              menu (Open / Copy). Sits in the main dashboard header next to the setup CTA.
 *              States: visible / needs_subscription / hidden_by_master / no_slug.
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Copy, ExternalLink, Check, ChevronDown, AlertTriangle, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

interface State {
  kind: 'not_master' | 'master';
  slug?: string | null;
  url?: string | null;
  visibility?: 'visible' | 'hidden_by_master' | 'needs_subscription' | 'no_slug';
}

export function PublicPageDropdown() {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/me/public-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => setState(d))
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEscapeKey(open, () => setOpen(false));

  if (!state || state.kind !== 'master') return null;

  const visibility = state.visibility ?? 'no_slug';
  const isVisible = visibility === 'visible' && !!state.url;

  // Determine button label + tone based on state
  const label = isVisible
    ? 'Моя страница'
    : visibility === 'needs_subscription'
      ? 'Скрыта'
      : visibility === 'hidden_by_master'
        ? 'Скрыта'
        : 'Моя страница';

  const tone = isVisible ? 'visible' : 'warn';

  const copy = async () => {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const open_ = () => {
    if (!state.url) return;
    window.open(state.url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 32,
          padding: '0 10px 0 12px',
          borderRadius: 999,
          border: '1px solid',
          borderColor: tone === 'visible' ? 'rgba(13,148,136,0.35)' : 'rgba(245,158,11,0.35)',
          background: tone === 'visible' ? 'rgba(13,148,136,0.08)' : 'rgba(245,158,11,0.08)',
          color: tone === 'visible' ? 'var(--color-accent)' : '#b45309',
          fontSize: 13,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background-color 150ms',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {tone === 'visible' ? <Globe size={14} /> : <AlertTriangle size={14} />}
        <span>{label}</span>
        <ChevronDown size={14} style={{ opacity: 0.65, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 280,
              zIndex: 50,
              background: 'var(--popover, #fff)',
              color: 'var(--popover-foreground, #0a0a0a)',
              border: '1px solid var(--border, rgba(0,0,0,0.08))',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            {isVisible ? (
              <>
                <div style={{ padding: '10px 12px 8px 12px', borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground, #64748b)', margin: 0 }}>
                    Твоя публичная страница
                  </p>
                  <code style={{ display: 'block', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state.url!.replace(/^https?:\/\//, '')}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={open_}
                  style={menuItemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.04))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  role="menuitem"
                >
                  <ExternalLink size={15} style={{ color: 'var(--color-accent)' }} />
                  <span>Открыть</span>
                </button>
                <button
                  type="button"
                  onClick={copy}
                  style={menuItemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.04))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  role="menuitem"
                >
                  {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} style={{ color: 'var(--color-accent)' }} />}
                  <span>{copied ? 'Скопировано' : 'Скопировать ссылку'}</span>
                </button>
              </>
            ) : visibility === 'needs_subscription' ? (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={16} style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Профиль скрыт из поиска</p>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #64748b)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      Активируй подписку, чтобы клиенты находили тебя через Google и AI-консьерж.
                    </p>
                  </div>
                </div>
              </div>
            ) : visibility === 'hidden_by_master' ? (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <EyeOff size={16} style={{ color: '#64748b', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Профиль скрыт</p>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground, #64748b)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      Публичная страница выключена в настройках. Включи её, чтобы клиенты могли записаться.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Страница ещё не создана</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground, #64748b)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Заверши настройку профиля — адрес страницы появится автоматически.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 14px',
  border: 'none',
  background: 'transparent',
  fontSize: 13,
  cursor: 'pointer',
  color: 'inherit',
  textAlign: 'left',
  transition: 'background-color 100ms',
};
