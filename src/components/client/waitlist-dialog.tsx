/** --- YAML
 * name: WaitlistDialog
 * description: Модалка «Встать в лист ожидания» — клиент выбирает удобные дни и
 *              время суток, отправляет POST /api/waitlist. Когда у мастера
 *              освободится слот — клиент получит уведомление в TG.
 * created: 2026-04-30
 * --- */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Clock4, X } from 'lucide-react';

interface WaitlistDialogProps {
  open: boolean;
  onClose: () => void;
  masterId: string;
  masterName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
}

const DAYS = [
  { value: 1, short: 'ПН', long: 'Понедельник' },
  { value: 2, short: 'ВТ', long: 'Вторник' },
  { value: 3, short: 'СР', long: 'Среда' },
  { value: 4, short: 'ЧТ', long: 'Четверг' },
  { value: 5, short: 'ПТ', long: 'Пятница' },
  { value: 6, short: 'СБ', long: 'Суббота' },
  { value: 0, short: 'ВС', long: 'Воскресенье' },
];

const TIME_WINDOWS = [
  { value: 'morning', label: 'Утро (9–12)' },
  { value: 'afternoon', label: 'День (12–17)' },
  { value: 'evening', label: 'Вечер (17–21)' },
  { value: 'any', label: 'Любое время' },
];

export function WaitlistDialog({ open, onClose, masterId, masterName, serviceId, serviceName }: WaitlistDialogProps) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeWindow, setTimeWindow] = useState<string>('any');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const toggleDay = (d: number) => {
    setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b));
  };

  const submit = async () => {
    if (days.length === 0) {
      toast.error('Выберите хотя бы один день');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_id: masterId,
          service_id: serviceId ?? null,
          preferred_days: days,
          preferred_time_window: timeWindow,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(body.alreadyExists
          ? 'Вы уже в листе ожидания у этого мастера'
          : 'Вы в очереди. Уведомим в Telegram, когда освободится слот.',
        );
        onClose();
      } else {
        toast.error('Не удалось встать в очередь. Попробуйте ещё раз.');
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
                <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <Clock4 className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Лист ожидания</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {serviceName && masterName ? `${serviceName} · ${masterName}` : masterName ?? ''}
                  </p>
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

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3 text-xs text-teal-800 dark:text-teal-300">
                Когда у мастера освободится слот в выбранное вами окно — вы первым получите уведомление в Telegram. На ответ даётся 30 минут, потом слот предлагается следующему в очереди.
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Удобные дни
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`flex h-10 items-center justify-center rounded-xl border text-xs font-semibold transition-colors ${
                        days.includes(d.value)
                          ? 'border-teal-500/50 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                          : 'border-muted text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Удобное время
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_WINDOWS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setTimeWindow(w.value)}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                        timeWindow === w.value
                          ? 'border-teal-500/50 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                          : 'border-muted text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
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
                disabled={days.length === 0 || submitting}
                className="flex-1 rounded-2xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Добавляем…' : 'Встать в очередь'}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
