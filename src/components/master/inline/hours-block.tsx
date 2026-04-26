/** --- YAML
 * name: InlineHoursBlock
 * description: Часы работы — inline-editable. Для клиента: таблица 7 дней (если есть
 *              хоть один открытый день), иначе скрыто. Для владельца: либо таблица +
 *              pencil top-right, либо dashed-CTA «+ Настрой часы работы». Edit-sheet:
 *              на каждый день — toggle (Открыт/Выходной), время начала/конца, опц.
 *              кнопка «Скопировать на всю неделю».
 * created: 2026-04-26
 * --- */

'use client';

import { useState } from 'react';
import { Clock, Pencil, Plus, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';

interface DaySchedule {
  start: string;
  end: string;
  closed?: boolean;
}

type WorkingHours = Record<string, DaySchedule | null>;

const DAYS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
];

const SHORT: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс',
};

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialHours: WorkingHours | null;
}

function isOpen(d: DaySchedule | null | undefined): boolean {
  return !!d && !d.closed && !!d.start && !!d.end;
}

function defaultHours(): WorkingHours {
  return {
    mon: { start: '10:00', end: '19:00' },
    tue: { start: '10:00', end: '19:00' },
    wed: { start: '10:00', end: '19:00' },
    thu: { start: '10:00', end: '19:00' },
    fri: { start: '10:00', end: '19:00' },
    sat: { start: '11:00', end: '18:00', closed: true },
    sun: { start: '11:00', end: '18:00', closed: true },
  };
}

export function InlineHoursBlock({ masterId, masterProfileId, initialHours }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [hours, setHours] = useState<WorkingHours>(initialHours ?? {});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkingHours>(initialHours ?? defaultHours());
  const [saving, setSaving] = useState(false);

  const anyOpen = DAYS.some((d) => isOpen(hours?.[d.key]));

  function startEdit() {
    // Если у мастера ничего не задано — стартуем с разумных дефолтов
    const hasAny = Object.values(hours ?? {}).some((d) => isOpen(d));
    setDraft(hasAny ? { ...hours } : defaultHours());
    setOpen(true);
  }

  function toggleDay(key: string, openDay: boolean) {
    setDraft((prev) => {
      const cur = prev[key] ?? { start: '10:00', end: '19:00' };
      return { ...prev, [key]: { ...cur, closed: !openDay } };
    });
  }

  function setTime(key: string, field: 'start' | 'end', value: string) {
    setDraft((prev) => {
      const cur = prev[key] ?? { start: '10:00', end: '19:00' };
      return { ...prev, [key]: { ...cur, [field]: value } };
    });
  }

  function copyMondayToAll() {
    const mon = draft.mon;
    if (!mon || mon.closed) {
      toast.error('Сначала заполни понедельник');
      return;
    }
    const next: WorkingHours = { ...draft };
    for (const d of DAYS) {
      if (d.key === 'mon') continue;
      next[d.key] = { start: mon.start, end: mon.end, closed: false };
    }
    setDraft(next);
    toast.success('Скопировано на всю неделю');
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('masters')
        .update({ working_hours: draft })
        .eq('id', masterId);
      if (error) {
        toast.error(error.message || 'Не удалось сохранить');
        return;
      }
      setHours(draft);
      toast.success('Часы работы сохранены');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Часы работы"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={copyMondayToAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="size-3.5" />
            Пн на все дни
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-neutral-200 px-5 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Сохранить
            </button>
          </div>
        </div>
      }
    >
      <p className="mb-4 text-[13px] text-neutral-500">
        Когда тебе можно записаться. Клиенты увидят свободные слоты только в эти часы.
      </p>
      <ul className="space-y-2">
        {DAYS.map((d) => {
          const cur = draft[d.key];
          const isClosed = !cur || !!cur.closed;
          return (
            <li
              key={d.key}
              className={
                'flex items-center gap-3 rounded-2xl border p-3 transition-colors ' +
                (isClosed ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-300 bg-white')
              }
            >
              <button
                type="button"
                onClick={() => toggleDay(d.key, isClosed)}
                className={
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
                  (isClosed ? 'bg-neutral-300' : 'bg-neutral-900')
                }
                aria-label={isClosed ? 'Открыть день' : 'Закрыть день'}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ left: isClosed ? 2 : 22 }}
                />
              </button>
              <span className="w-24 shrink-0 text-[14px] font-semibold text-neutral-900">
                {d.label}
              </span>
              {isClosed ? (
                <span className="flex-1 text-[13px] text-neutral-400">Выходной</span>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={cur?.start ?? '10:00'}
                    onChange={(e) => setTime(d.key, 'start', e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] tabular-nums text-neutral-900 focus:border-neutral-400 focus:outline-none"
                  />
                  <span className="text-neutral-400">—</span>
                  <input
                    type="time"
                    value={cur?.end ?? '19:00'}
                    onChange={(e) => setTime(d.key, 'end', e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] tabular-nums text-neutral-900 focus:border-neutral-400 focus:outline-none"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </InlineEditSheet>
  );

  // Client view: hidden if no hours set
  if (!anyOpen && !isOwner) return null;

  // Owner empty state
  if (!anyOpen && isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={startEdit}
          className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-5 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 group-hover:bg-neutral-900 group-hover:text-white">
            <Plus className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-neutral-900">Настрой часы работы</span>
            <span className="mt-1 block text-[13px] text-neutral-500">
              Без них клиенты не увидят свободные слоты.
            </span>
          </span>
        </button>
        {sheet}
      </>
    );
  }

  // Filled — show table
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
          <Clock className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-neutral-900">Часы работы</p>
            {isOwner && (
              <button
                type="button"
                onClick={startEdit}
                className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Редактировать часы"
                title="Редактировать часы"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {DAYS.map((d) => {
              const cur = hours?.[d.key];
              const open = isOpen(cur);
              return (
                <li key={d.key} className="flex items-center justify-between">
                  <span className="text-neutral-500">{SHORT[d.key]}</span>
                  <span className={open ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
                    {open ? `${cur!.start} – ${cur!.end}` : 'Выходной'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {sheet}
    </div>
  );
}
