/** --- YAML
 * name: WorkingHoursEditor
 * description: Multi-interval редактор расписания мастера. На каждый день —
 *              чекбокс «работаю», список интервалов (карточки), «+ Добавить
 *              слот» открывает модалку с двумя time-input'ами. Шаг 5 минут.
 *              Используется в onboarding / settings / inline edit на публичной
 *              странице мастера. Сохраняет через /api/me/working-hours;
 *              отдельно показывает 409-конфликты с будущими записями.
 * created: 2026-05-05
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

const DAY_NAMES_RU: Record<WeekDayKey, string> = {
  monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда',
  thursday: 'Четверг', friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье',
};
const DAY_NAMES_UK: Record<WeekDayKey, string> = {
  monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа',
  thursday: 'Четвер', friday: 'Пʼятниця', saturday: 'Субота', sunday: 'Неділя',
};

function dayName(k: WeekDayKey, lang: 'ru' | 'uk' | 'en'): string {
  if (lang === 'uk') return DAY_NAMES_UK[k];
  if (lang === 'en') return k.charAt(0).toUpperCase() + k.slice(1);
  return DAY_NAMES_RU[k];
}

interface ConflictAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  service_name: string | null;
}

interface Props {
  initial?: WorkingHours | null;
  /** Куда сохранять. Если опущено — компонент только локально хранит и
   *  отдаёт onChange; родитель сам сохранит как захочет (например, в
   *  onboarding wizard где сохранение в конце). */
  saveEndpoint?: string;
  /** Telegram initData header для авторизации Mini App-юзера. */
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
        addSlot: '+ Додати слот',
        save: 'Зберегти',
        saving: 'Зберігаємо…',
        saved: 'Збережено',
        weekend: 'Вихідний',
        from: 'Від', to: 'До',
        cancel: 'Скасувати', apply: 'Готово', remove: 'Видалити',
        editTitle: 'Робочий слот',
        conflictTitle: 'Не вдається зберегти',
        conflictHint: 'Ці записи опиняться поза робочим часом. Перенесіть або скасуйте їх, потім спробуйте знову:',
        close: 'Закрити',
      };
    }
    if (lang === 'en') {
      return {
        addSlot: '+ Add slot',
        save: 'Save', saving: 'Saving…', saved: 'Saved',
        weekend: 'Day off',
        from: 'From', to: 'To',
        cancel: 'Cancel', apply: 'Apply', remove: 'Delete',
        editTitle: 'Working slot',
        conflictTitle: 'Can’t save',
        conflictHint: 'These bookings would fall outside working hours. Reschedule or cancel them and try again:',
        close: 'Close',
      };
    }
    return {
      addSlot: '+ Добавить слот',
      save: 'Сохранить', saving: 'Сохраняем…', saved: 'Сохранено',
      weekend: 'Выходной',
      from: 'С', to: 'До',
      cancel: 'Отмена', apply: 'Готово', remove: 'Удалить',
      editTitle: 'Рабочий слот',
      conflictTitle: 'Не получилось сохранить',
      conflictHint: 'Эти записи окажутся в нерабочее время. Перенеси или отмени их, потом сохраняй заново:',
      close: 'Закрыть',
    };
  }, [lang]);

  return (
    <div className="flex flex-col gap-3">
      {WEEK_DAY_KEYS.map((d) => (
        <DayRow
          key={d}
          day={d}
          name={dayName(d, lang)}
          info={hours[d]}
          weekendLabel={labels.weekend}
          addLabel={labels.addSlot}
          onToggle={() => toggleDay(d)}
          onAdd={() => openAdd(d)}
          onEdit={(i) => openEdit(d, i)}
          onDelete={(i) => deleteInterval(d, i)}
        />
      ))}

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

function DayRow({
  day, name, info, weekendLabel, addLabel,
  onToggle, onAdd, onEdit, onDelete,
}: {
  day: WeekDayKey;
  name: string;
  info: WorkingDay;
  weekendLabel: string;
  addLabel: string;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={info.enabled}
          onChange={onToggle}
          className="size-5 cursor-pointer accent-emerald-500"
          aria-label={`${day} working`}
        />
        <span className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {name}
        </span>
        {!info.enabled && (
          <span className="text-xs text-neutral-400">{weekendLabel}</span>
        )}
      </label>

      {info.enabled && (
        <div className="mt-3 flex flex-col gap-2">
          {info.intervals.length === 0 && (
            <p className="text-xs text-neutral-400 px-1">—</p>
          )}
          {info.intervals.map((iv, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(i)}
                className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm font-mono text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                {iv.start} — {iv.end}
              </button>
              <button
                type="button"
                onClick={() => onDelete(i)}
                className="rounded-full p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                aria-label="delete interval"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="mt-1 inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <Plus size={14} /> {addLabel.replace(/^\+\s*/, '')}
          </button>
        </div>
      )}
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
