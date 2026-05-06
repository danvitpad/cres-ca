/** --- YAML
 * name: WorkingHoursEditor
 * description: Multi-interval редактор расписания мастера.
 *              Колоночная вёрстка: слева шкала часов (00-24), справа 7 колонок
 *              дней пн-вс. В каждой колонке — чекбокс «работаю», рабочие окна
 *              цветными прямоугольниками поверх часовой сетки, тап → редактирование,
 *              кнопка «+» снизу колонки добавляет слот.
 *              Шаг 5 минут. Сохранение через /api/me/working-hours c проверкой
 *              конфликтов с будущими записями.
 * created: 2026-05-05
 * updated: 2026-05-06
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type WorkingHours,
  type WorkingDay,
  type WorkingInterval,
  type WeekDayKey,
  WEEK_DAY_KEYS,
  emptyWorkingHours,
} from '@/types/working-hours';
import { sanitizeIntervals } from '@/lib/working-hours/normalize';

const SHORT_RU: Record<WeekDayKey, string> = {
  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс',
};
const SHORT_UK: Record<WeekDayKey, string> = {
  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Нд',
};
const SHORT_EN: Record<WeekDayKey, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// Высота 1 часа в пикселях. Для 24h получаем 24*HOUR_PX высоты сетки.
const HOUR_PX = 36;
const TOTAL_PX = 24 * HOUR_PX;

const t2m = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const m2y = (min: number) => (min / 60) * HOUR_PX;

interface ConflictAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  service_name: string | null;
}

interface Props {
  initial?: WorkingHours | null;
  saveEndpoint?: string;
  initData?: string | null;
  lang?: 'ru' | 'uk' | 'en';
  onSaved?: (wh: WorkingHours) => void;
  onChange?: (wh: WorkingHours) => void;
}

export function WorkingHoursEditor({
  initial,
  saveEndpoint,
  initData,
  lang = 'uk',
  onSaved,
  onChange,
}: Props) {
  const [hours, setHours] = useState<WorkingHours>(() => initial ?? emptyWorkingHours());
  const [editing, setEditing] = useState<{
    day: WeekDayKey;
    index: number; // -1 = новый
    start: string;
    end: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictAppointment[] | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (initial) setHours(initial);
  }, [initial]);

  function patch(next: WorkingHours) {
    setHours(next);
    onChange?.(next);
  }

  function toggleDay(d: WeekDayKey) {
    const cur = hours[d];
    if (cur.enabled) {
      patch({ ...hours, [d]: { ...cur, enabled: false } });
    } else {
      const intervals = cur.intervals.length > 0 ? cur.intervals : [{ start: '10:00', end: '19:00' }];
      patch({ ...hours, [d]: { enabled: true, intervals } });
    }
  }

  function openAdd(d: WeekDayKey) {
    setEditing({ day: d, index: -1, start: '10:00', end: '12:00' });
  }
  function openEdit(d: WeekDayKey, idx: number) {
    const iv = hours[d].intervals[idx];
    setEditing({ day: d, index: idx, start: iv.start, end: iv.end });
  }
  function deleteInterval(d: WeekDayKey, idx: number) {
    const cur = hours[d];
    const next = cur.intervals.filter((_, i) => i !== idx);
    patch({ ...hours, [d]: { enabled: next.length > 0, intervals: next } });
  }

  function applyEditing() {
    if (!editing) return;
    const cur = hours[editing.day];
    const draft = [...cur.intervals];
    const newIv: WorkingInterval = { start: editing.start, end: editing.end };
    if (editing.index === -1) {
      draft.push(newIv);
    } else {
      draft[editing.index] = newIv;
    }
    const sane = sanitizeIntervals(draft);
    patch({
      ...hours,
      [editing.day]: { enabled: sane.length > 0, intervals: sane },
    });
    setEditing(null);
  }

  async function save() {
    if (!saveEndpoint) {
      onSaved?.(hours);
      return;
    }
    setBusy(true);
    setConflicts(null);
    try {
      const res = await fetch(saveEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ working_hours: hours }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data.conflicts)) {
        setConflicts(data.conflicts as ConflictAppointment[]);
        return;
      }
      if (!res.ok) {
        alert(data?.message ?? data?.error ?? 'Не удалось сохранить');
        return;
      }
      onSaved?.(hours);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  const labels = useMemo(() => {
    if (lang === 'uk') {
      return {
        addSlot: 'Додати',
        save: 'Зберегти', saving: 'Зберігаємо…', saved: 'Збережено',
        weekend: 'Вихідний',
        from: 'Від', to: 'До',
        cancel: 'Скасувати', apply: 'Готово', remove: 'Видалити',
        editTitle: 'Робочий слот',
        conflictTitle: 'Не вдається зберегти',
        conflictHint: 'Ці записи опиняться поза робочим часом. Перенесіть або скасуйте їх:',
        close: 'Закрити',
        scrollHint: 'Прокрути вліво/вправо, щоб побачити всі дні',
      };
    }
    if (lang === 'en') {
      return {
        addSlot: 'Add',
        save: 'Save', saving: 'Saving…', saved: 'Saved',
        weekend: 'Off',
        from: 'From', to: 'To',
        cancel: 'Cancel', apply: 'Apply', remove: 'Delete',
        editTitle: 'Working slot',
        conflictTitle: 'Can’t save',
        conflictHint: 'These bookings would fall outside working hours:',
        close: 'Close',
        scrollHint: 'Scroll horizontally to see all days',
      };
    }
    return {
      addSlot: 'Добавить',
      save: 'Сохранить', saving: 'Сохраняем…', saved: 'Сохранено',
      weekend: 'Выходной',
      from: 'С', to: 'До',
      cancel: 'Отмена', apply: 'Готово', remove: 'Удалить',
      editTitle: 'Рабочий слот',
      conflictTitle: 'Не получилось сохранить',
      conflictHint: 'Эти записи окажутся в нерабочее время:',
      close: 'Закрыть',
      scrollHint: 'Прокрути влево/вправо, чтобы увидеть все дни',
    };
  }, [lang]);

  const dayShort = lang === 'uk' ? SHORT_UK : lang === 'en' ? SHORT_EN : SHORT_RU;

  return (
    <div className="flex flex-col gap-3">
      {/* Сетка: hour rail + 7 columns. Горизонтальный скролл на узких. */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex min-w-[640px]">
          {/* Hour rail */}
          <div
            className="sticky left-0 z-10 shrink-0 border-r border-neutral-200 bg-white text-[10px] font-medium text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"
            style={{ width: 36 }}
          >
            {/* Spacer для шапки колонок (50px = 28 чекбокс + 22 padding) */}
            <div style={{ height: 50 }} />
            <div className="relative" style={{ height: TOTAL_PX }}>
              {Array.from({ length: 25 }, (_, h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 select-none tabular-nums"
                  style={{ top: h * HOUR_PX }}
                >
                  {String(h).padStart(2, '0')}
                </div>
              ))}
            </div>
            <div style={{ height: 44 }} /> {/* footer + button row */}
          </div>

          {/* 7 day columns */}
          {WEEK_DAY_KEYS.map((d) => (
            <DayColumn
              key={d}
              day={d}
              dayShort={dayShort[d]}
              info={hours[d]}
              addLabel={labels.addSlot}
              weekendLabel={labels.weekend}
              onToggle={() => toggleDay(d)}
              onAdd={() => openAdd(d)}
              onEdit={(i) => openEdit(d, i)}
              onDelete={(i) => deleteInterval(d, i)}
            />
          ))}
        </div>
      </div>

      {saveEndpoint && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition disabled:opacity-50"
        >
          {busy
            ? <><Loader2 size={16} className="animate-spin" /> {labels.saving}</>
            : savedToast
              ? <><Check size={16} /> {labels.saved}</>
              : labels.save}
        </button>
      )}

      <AnimatePresence>
        {editing && (
          <EditModal
            title={labels.editTitle}
            from={editing.start}
            to={editing.end}
            fromLabel={labels.from}
            toLabel={labels.to}
            applyLabel={labels.apply}
            cancelLabel={labels.cancel}
            removeLabel={editing.index >= 0 ? labels.remove : null}
            onChangeFrom={(v) => setEditing({ ...editing, start: v })}
            onChangeTo={(v) => setEditing({ ...editing, end: v })}
            onApply={applyEditing}
            onCancel={() => setEditing(null)}
            onRemove={editing.index >= 0
              ? () => { deleteInterval(editing.day, editing.index); setEditing(null); }
              : undefined}
          />
        )}
        {conflicts && (
          <ConflictModal
            title={labels.conflictTitle}
            hint={labels.conflictHint}
            close={labels.close}
            conflicts={conflicts}
            onClose={() => setConflicts(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DayColumn({
  dayShort, info, addLabel, weekendLabel,
  onToggle, onAdd, onEdit, onDelete,
}: {
  day: WeekDayKey;
  dayShort: string;
  info: WorkingDay;
  addLabel: string;
  weekendLabel: string;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
}) {
  const enabled = info.enabled;
  return (
    <div className="flex flex-1 flex-col border-r border-neutral-200 last:border-r-0 dark:border-neutral-800">
      {/* Header: day short + checkbox */}
      <div className="flex flex-col items-center justify-center gap-1 border-b border-neutral-200 py-1.5 dark:border-neutral-800" style={{ height: 50 }}>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${enabled ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'}`}>
          {dayShort}
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="size-4 cursor-pointer accent-emerald-500"
          aria-label={`Toggle ${dayShort}`}
        />
      </div>

      {/* Time grid + intervals */}
      <div
        className={`relative ${enabled ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-900/60'}`}
        style={{ height: TOTAL_PX }}
      >
        {/* Hour grid lines */}
        {Array.from({ length: 25 }, (_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-neutral-100 dark:border-neutral-800"
            style={{ top: h * HOUR_PX }}
          />
        ))}
        {/* Striped pattern для нерабочего дня */}
        {!enabled && (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(45deg, transparent 0 6px, rgba(120,120,120,0.15) 6px 12px)`,
            }}
          />
        )}
        {/* Working interval blocks */}
        {enabled && info.intervals.map((iv, i) => {
          const top = m2y(t2m(iv.start));
          const height = Math.max(20, m2y(t2m(iv.end) - t2m(iv.start)));
          return (
            <button
              key={i}
              type="button"
              onClick={() => onEdit(i)}
              className="absolute left-1 right-1 flex flex-col items-stretch overflow-hidden rounded-md bg-emerald-500 text-left text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              style={{ top, height }}
              title={`${iv.start} – ${iv.end}`}
            >
              <div className="flex items-start justify-between px-1.5 pt-1 leading-tight">
                <span className="tabular-nums">{iv.start}</span>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                  className="ml-1 -mr-0.5 cursor-pointer rounded-sm p-0.5 hover:bg-emerald-700"
                >
                  <X size={10} strokeWidth={3} />
                </span>
              </div>
              {height > 28 && (
                <div className="px-1.5 pb-1 text-[9px] opacity-80 tabular-nums">
                  {iv.end}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: + add slot */}
      <div className="flex items-center justify-center border-t border-neutral-200 p-1 dark:border-neutral-800" style={{ height: 44 }}>
        {enabled ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-0.5 rounded-md border border-dashed border-emerald-400 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            title={addLabel}
          >
            <Plus size={12} />
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        ) : (
          <span className="text-[10px] text-neutral-400">{weekendLabel}</span>
        )}
      </div>
    </div>
  );
}

function EditModal({
  title, from, to, fromLabel, toLabel,
  applyLabel, cancelLabel, removeLabel,
  onChangeFrom, onChangeTo,
  onApply, onCancel, onRemove,
}: {
  title: string;
  from: string; to: string;
  fromLabel: string; toLabel: string;
  applyLabel: string; cancelLabel: string;
  removeLabel: string | null;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  onApply: () => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-50 bg-black/50"
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900"
        role="dialog"
      >
        <h3 className="mb-4 text-base font-bold text-neutral-900 dark:text-neutral-100">{title}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-neutral-500">{fromLabel}</span>
            <input
              type="time"
              value={from}
              step={300}
              onChange={(e) => onChangeFrom(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-neutral-500">{toLabel}</span>
            <input
              type="time"
              value={to}
              step={300}
              onChange={(e) => onChangeTo(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-2">
          {onRemove && removeLabel && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950"
            >
              {removeLabel}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onApply}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function ConflictModal({
  title, hint, close, conflicts, onClose,
}: {
  title: string; hint: string; close: string;
  conflicts: ConflictAppointment[];
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50"
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900"
        role="dialog"
      >
        <div className="mb-3 flex items-center gap-2 text-amber-500">
          <AlertTriangle size={18} />
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{title}</h3>
        </div>
        <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{hint}</p>
        <ul className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800">
          {conflicts.map((c) => {
            const d = new Date(c.starts_at);
            const dateLabel = d.toLocaleString('uk-UA', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              timeZone: 'Europe/Kiev',
            });
            return (
              <li key={c.id} className="text-sm text-neutral-800 dark:text-neutral-200">
                <span className="font-semibold">{dateLabel}</span>
                {c.service_name && <> · {c.service_name}</>}
                {c.client_name && <> · {c.client_name}</>}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          {close}
        </button>
      </motion.div>
    </>
  );
}
