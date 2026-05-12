/** --- YAML
 * name: InlineHoursBlock
 * description: Часы работы — inline-editable. Для клиента: таблица 7 дней
 *              (если есть хоть один открытый день), иначе скрыто. Для владельца:
 *              либо таблица + pencil top-right, либо dashed-CTA «Настрой часы
 *              работы». Edit-sheet оборачивает универсальный
 *              `WorkingHoursEditor` (multi-interval) и сохраняет через
 *              /api/me/working-hours c проверкой конфликтов с будущими записями.
 * created: 2026-04-26
 * updated: 2026-05-05
 * --- */

'use client';

import { useState } from 'react';
import { Clock, Pencil, Plus } from 'lucide-react';
import { useIsOwner } from './use-is-owner';
import { InlineEditSheet } from './inline-edit-sheet';
import { WorkingHoursEditor } from '@/components/shared/working-hours-editor';
import {
  type WorkingHours,
  WEEK_DAY_KEYS,
  type WeekDayKey,
} from '@/types/working-hours';
import { normalizeWorkingHours } from '@/lib/working-hours/normalize';

const DAY_LABELS: Record<WeekDayKey, string> = {
  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср',
  thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс',
};

interface Props {
  masterId: string;
  masterProfileId: string | null;
  initialHours: unknown; // jsonb из БД, любой формат — нормализуем
}

export function InlineHoursBlock({ masterProfileId, initialHours }: Props) {
  const isOwner = useIsOwner(masterProfileId);
  const [hours, setHours] = useState<WorkingHours>(() => normalizeWorkingHours(initialHours));
  const [open, setOpen] = useState(false);

  const anyOpen = WEEK_DAY_KEYS.some((k) => hours[k].enabled && hours[k].intervals.length > 0);

  function startEdit() {
    setOpen(true);
  }

  function handleSaved(next: WorkingHours) {
    setHours(next);
    setOpen(false);
  }

  const sheet = (
    <InlineEditSheet
      open={open}
      onClose={() => setOpen(false)}
      title="Часы работы"
    >
      <p className="mb-4 text-[13px] text-neutral-500">
        Когда вам можно записаться. Клиенты увидят свободные слоты только в эти часы.
        Можно задать несколько окон в одном дне (например, до обеда + после).
      </p>
      <WorkingHoursEditor
        initial={hours}
        saveEndpoint="/api/me/working-hours"
        lang="ru"
        onSaved={handleSaved}
      />
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
          className="group flex w-full items-center gap-3 rounded-2xl p-5 text-left transition-colors"
          style={{
            background: 'var(--m-accent-soft)',
            border: '1.5px solid color-mix(in oklab, var(--m-accent) 30%, transparent)',
          }}
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
            {WEEK_DAY_KEYS.map((k) => {
              const day = hours[k];
              return (
                <li key={k} className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-neutral-500">{DAY_LABELS[k]}</span>
                  <span className={day.enabled && day.intervals.length ? 'text-right font-medium text-neutral-900' : 'text-neutral-400'}>
                    {day.enabled && day.intervals.length
                      ? day.intervals.map((iv) => `${iv.start} – ${iv.end}`).join(', ')
                      : 'Выходной'}
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
