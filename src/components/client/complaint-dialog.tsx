/** --- YAML
 * name: ComplaintDialog
 * description: Модалка «Пожаловаться» — клиент жалуется на мастера или конкретную
 *              запись. 6 причин (no_show / rude / wrong_service / dirty /
 *              overpriced / other) + текстовое описание (10–2000 символов).
 *              POST /api/complaints; уведомление улетает в @crescasuperadmin_bot.
 * created: 2026-04-30
 * --- */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { AlertTriangle, X } from 'lucide-react';

interface ComplaintDialogProps {
  open: boolean;
  onClose: () => void;
  masterId: string;
  masterName?: string | null;
  appointmentId?: string;
}

const REASONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'no_show', label: 'Мастер не пришёл', hint: 'Был отказ или мастер не явился без предупреждения' },
  { value: 'rude', label: 'Хамство / неуважение', hint: 'Грубое отношение, повышение голоса, оскорбления' },
  { value: 'wrong_service', label: 'Сделал не ту услугу', hint: 'Результат не соответствует тому что заказывали' },
  { value: 'dirty', label: 'Антисанитария / грязь', hint: 'Нарушены гигиенические нормы' },
  { value: 'overpriced', label: 'Завышенная цена', hint: 'Сумма по факту больше чем озвучивал ранее' },
  { value: 'other', label: 'Другое', hint: 'Опишите проблему в комментарии' },
];

export function ComplaintDialog({ open, onClose, masterId, masterName, appointmentId }: ComplaintDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setReason('');
    setDescription('');
    onClose();
  };

  const submit = async () => {
    if (!reason) {
      toast.error('Выберите причину');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Опишите проблему — минимум 10 символов');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_id: masterId,
          appointment_id: appointmentId ?? null,
          reason_code: reason,
          description: description.trim(),
        }),
      });
      if (res.ok) {
        toast.success('Жалоба отправлена. Мы свяжемся с вами по результатам рассмотрения.');
        setReason('');
        setDescription('');
        onClose();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error(body.message || 'Слишком много обращений за сутки. Попробуйте позже.');
      } else {
        toast.error('Не удалось отправить жалобу. Попробуйте ещё раз.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Пожаловаться</h3>
                  {masterName && (
                    <p className="mt-0.5 text-xs text-muted-foreground">На мастера: {masterName}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                Жалоба попадает в команду CRES-CA для модерации. Если описание содержит угрозы или ложные обвинения — она может быть отклонена.
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Причина</label>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                        reason === r.value
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-0.5 size-4 accent-amber-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Опишите подробно
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Расскажите что произошло. Чем больше деталей — тем быстрее мы разберёмся."
                  rows={5}
                  maxLength={2000}
                  className="w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none focus:border-amber-500/50"
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{description.length < 10 ? `Ещё ${10 - description.length} символов` : 'Готово'}</span>
                  <span>{description.length} / 2000</span>
                </div>
              </div>
            </div>

            <footer className="flex gap-3 border-t p-5">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="flex-1 rounded-2xl border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!reason || description.trim().length < 10 || submitting}
                className="flex-1 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Отправляю…' : 'Отправить'}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
