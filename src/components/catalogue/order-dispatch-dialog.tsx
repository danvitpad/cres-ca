/** --- YAML
 * name: OrderDispatchDialog
 * description: Поп-ап «Отправить заказ» — показывается после сохранения
 *              заказа поставщику. Содержит превью (поставщик, позиции,
 *              итог) и две большие кнопки — Telegram / Email — которые
 *              отправляют PDF одним кликом через /api/supplier-orders/[id]/dispatch.
 *              Заменяет старый flow: «Сохранить черновик» → «Сформировать PDF» в
 *              новой вкладке. Теперь всё в одном попапе с крестиком.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mail, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Item {
  name: string;
  qty: number;
  price_per_unit: number;
  unit?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string | null;
  supplier: {
    name: string;
    email: string | null;
    telegram_id: string | null;
  } | null;
  items: Item[];
  currency?: string;
  total: number;
  onDone?: () => void;
}

export function OrderDispatchDialog({
  open, onOpenChange, orderId, supplier, items, currency = 'UAH', total, onDone,
}: Props) {
  const [sendingChannel, setSendingChannel] = useState<'telegram' | 'email' | null>(null);
  const [sentChannel, setSentChannel] = useState<'telegram' | 'email' | null>(null);

  useEffect(() => {
    if (open) {
      setSendingChannel(null);
      setSentChannel(null);
    }
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open || !orderId) return null;

  async function send(channel: 'telegram' | 'email') {
    if (!orderId) return;
    setSendingChannel(channel);
    try {
      const res = await fetch(`/api/supplier-orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const code = (data as { error?: string }).error || '';
        const detail = (data as { detail?: string }).detail || '';
        toast.error(
          code === 'no_supplier_email' ? 'У поставщика не указан email — добавьте его в карточке поставщика'
          : code === 'email_send_failed' ? `Email: ${detail || 'не удалось отправить'}`
          : detail || 'Не удалось отправить',
        );
        return;
      }

      if (channel === 'telegram') {
        const mode = (data as { mode?: string }).mode;
        if (mode === 'bot_direct') {
          toast.success('Заказ отправлен поставщику в Telegram');
          setSentChannel('telegram');
        } else {
          // share_link mode — открываем t.me/share вкладку
          const shareUrl = (data as { share_url?: string }).share_url;
          if (shareUrl) {
            window.open(shareUrl, '_blank', 'noopener');
            const hint = (data as { hint?: string }).hint;
            toast.success(hint || 'Telegram открыт — выберите контакт поставщика');
            setSentChannel('telegram');
          } else {
            toast.success('Готово');
          }
        }
      } else {
        toast.success('Email отправлен поставщику');
        setSentChannel('email');
      }

      onDone?.();
    } finally {
      setSendingChannel(null);
    }
  }

  function downloadPdf() {
    if (!orderId) return;
    window.open(`/api/supplier-orders/${orderId}/pdf`, '_blank', 'noopener');
  }

  const canTelegram = !!supplier;
  const canEmail = !!supplier?.email;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => onOpenChange(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              background: 'var(--card, white)', color: 'var(--card-foreground, black)',
              borderRadius: 18, padding: '22px 22px 18px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              position: 'relative',
              maxHeight: '92vh', overflowY: 'auto',
            }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Закрыть"
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--muted-foreground, #888)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Заказ готов
            </h2>
            <p style={{ marginTop: 4, marginBottom: 16, fontSize: 13, color: 'var(--muted-foreground, #888)' }}>
              Проверьте данные и отправь поставщику одним кликом.
            </p>

            {/* Preview */}
            <div style={{
              border: '1px solid var(--border, rgba(0,0,0,0.1))',
              borderRadius: 12, padding: 14, marginBottom: 16,
              background: 'var(--muted, rgba(0,0,0,0.02))',
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground, #888)', marginBottom: 4 }}>
                Поставщик
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                {supplier?.name ?? 'Не указан'}
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted-foreground, #888)', marginBottom: 6 }}>
                Позиции ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {items.slice(0, 8).map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 8,
                    fontSize: 13, lineHeight: 1.4,
                  }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name} × {it.qty} {it.unit ?? 'шт'}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground, #888)' }}>
                      {(it.qty * it.price_per_unit).toLocaleString('ru-RU')} {currency}
                    </span>
                  </div>
                ))}
                {items.length > 8 && (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground, #888)', fontStyle: 'italic' }}>
                    …и ещё {items.length - 8}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: 10, borderTop: '1px solid var(--border, rgba(0,0,0,0.1))',
                fontSize: 14, fontWeight: 700,
              }}>
                <span>Итого</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {total.toLocaleString('ru-RU')} {currency}
                </span>
              </div>
            </div>

            {/* Channel buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => send('telegram')}
                disabled={!canTelegram || sendingChannel !== null}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 50, borderRadius: 12, border: 'none',
                  background: '#0088cc', color: 'white',
                  fontSize: 15, fontWeight: 600,
                  cursor: !canTelegram || sendingChannel !== null ? 'not-allowed' : 'pointer',
                  opacity: !canTelegram ? 0.5 : sendingChannel === 'telegram' ? 0.7 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {sendingChannel === 'telegram' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : sentChannel === 'telegram' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Send size={20} />
                )}
                {sentChannel === 'telegram' ? 'Отправлено в Telegram' : 'Отправить в Telegram'}
              </button>

              <button
                type="button"
                onClick={() => send('email')}
                disabled={!canEmail || sendingChannel !== null}
                title={!canEmail ? 'У поставщика не указан email' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 50, borderRadius: 12, border: 'none',
                  background: '#dc2626', color: 'white',
                  fontSize: 15, fontWeight: 600,
                  cursor: !canEmail || sendingChannel !== null ? 'not-allowed' : 'pointer',
                  opacity: !canEmail ? 0.5 : sendingChannel === 'email' ? 0.7 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                {sendingChannel === 'email' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : sentChannel === 'email' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Mail size={20} />
                )}
                {sentChannel === 'email' ? 'Email отправлен' : 'Отправить на Email'}
              </button>

              <button
                type="button"
                onClick={downloadPdf}
                disabled={sendingChannel !== null}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  height: 42, borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid var(--border, rgba(0,0,0,0.12))',
                  color: 'var(--card-foreground, black)',
                  fontSize: 13.5, fontWeight: 500,
                  cursor: sendingChannel !== null ? 'not-allowed' : 'pointer',
                  marginTop: 2,
                }}
              >
                <Download size={16} />
                Скачать PDF (отправить вручную)
              </button>
            </div>

            {!canEmail && supplier && (
              <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted-foreground, #888)' }}>
                У этого поставщика не указан email — кнопка недоступна. Добавьте email
                в карточке поставщика, чтобы включить отправку на почту.
              </p>
            )}
            {!supplier?.telegram_id && (
              <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--muted-foreground, #888)' }}>
                Если у поставщика указан Telegram chat_id — заказ уйдёт сразу через нашего бота.
                Иначе откроется Telegram, выберешь контакт и пересылаешь PDF.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
