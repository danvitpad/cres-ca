/** --- YAML
 * name: MiniAppEditTextSheet
 * description: Bottom-sheet для inline-редактирования одного текстового поля.
 *              Принимает label, начальное значение, тип (input/textarea), max-длина,
 *              и onSave(value) с loading + error. Используется в публичной странице
 *              мастера для редактирования имени, специализации, био, адреса и
 *              workplace без выхода в браузер.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING } from './design';

interface Props {
  open: boolean;
  title: string;
  initialValue: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}

export function MiniAppEditTextSheet({
  open,
  title,
  initialValue,
  multiline = false,
  maxLength = 280,
  placeholder,
  onClose,
  onSave,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
      setBusy(false);
    }
  }, [open, initialValue]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={SPRING.default}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              borderRadius: `${R.lg}px ${R.lg}px 0 0`,
              background: T.surface,
              padding: `20px ${PAGE_PADDING_X}px`,
              paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
              boxShadow: SHADOW.elevated,
              maxHeight: 'calc(var(--tg-viewport-height, 100dvh) - max(var(--tg-content-top, 0px), 80px))', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{title}</h3>
              <button
                type="button"
                onClick={() => !busy && onClose()}
                aria-label="Закрыть"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `1px solid ${T.border}`, background: T.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} color={T.text} />
              </button>
            </div>

            <div style={{ borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.bg, padding: 12 }}>
              {multiline ? (
                <textarea
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
                  placeholder={placeholder}
                  rows={5}
                  style={{
                    width: '100%', resize: 'none',
                    background: 'transparent', border: 'none', outline: 'none',
                    ...TYPE.body, color: T.text, fontFamily: 'inherit',
                  }}
                />
              ) : (
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    background: 'transparent', border: 'none', outline: 'none',
                    ...TYPE.body, color: T.text, fontFamily: 'inherit',
                  }}
                />
              )}
              {multiline && (
                <p style={{ ...TYPE.micro, marginTop: 6, textAlign: 'right' }}>
                  {value.length}/{maxLength}
                </p>
              )}
            </div>

            {error && (
              <p style={{ ...TYPE.caption, color: T.danger, marginTop: 8 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{
                marginTop: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '14px 16px',
                borderRadius: R.md, border: 'none',
                background: T.text, color: T.bg,
                fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
