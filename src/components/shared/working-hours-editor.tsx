/** --- YAML
 * name: WorkingHoursEditor
 * description: Multi-interval schedule editor matching master-schedule mock.
 *   Mobile: scrollable day strip + single-day drag grid + clear/copy actions.
 *   Desktop: sub-tabs (schedule|exceptions) + template toolbar + 7-column
 *   drag-select grid with 15-min snap + per-column copy-to-week footer.
 *   Cobalt brand accent. Saves via /api/me/working-hours with conflict check.
 * created: 2026-05-05
 * updated: 2026-05-16
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarX, Check, Copy, Info, Loader2, Plus, Trash2, X, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type WorkingHours, type WorkingDay, type WorkingInterval, type WeekDayKey,
  WEEK_DAY_KEYS, emptyWorkingHours,
} from '@/types/working-hours';
import { sanitizeIntervals } from '@/lib/working-hours/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────
const SNAP_MIN = 15;           // snap to 15-minute grid
const CELL_H   = 22;           // px per 15-min cell (compact yet draggable)
const HOUR_PX  = CELL_H * 4;  // 88px per hour
const TOTAL_PX = 24 * HOUR_PX; // full 24h column height

// ─── Helpers ─────────────────────────────────────────────────────────────────
const m2y   = (min: number) => (min / 60) * HOUR_PX;
const snapM = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const minToHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hhmm2min = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// ─── i18n ────────────────────────────────────────────────────────────────────
type Lang = 'uk' | 'ru' | 'en';

const DAY_SHORT: Record<Lang, Record<WeekDayKey, string>> = {
  uk: { monday:'Пн', tuesday:'Вт', wednesday:'Ср', thursday:'Чт', friday:'Пт', saturday:'Сб', sunday:'Нд' },
  ru: { monday:'Пн', tuesday:'Вт', wednesday:'Ср', thursday:'Чт', friday:'Пт', saturday:'Сб', sunday:'Вс' },
  en: { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' },
};
const DAY_FULL: Record<Lang, Record<WeekDayKey, string>> = {
  uk: { monday:'Понеділок', tuesday:'Вівторок', wednesday:'Середа', thursday:'Четвер', friday:'П’ятниця', saturday:'Субота', sunday:'Неділя' },
  ru: { monday:'Понедельник', tuesday:'Вторник', wednesday:'Среда', thursday:'Четверг', friday:'Пятница', saturday:'Суббота', sunday:'Воскресенье' },
  en: { monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday', thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday' },
};

function getLabels(lang: Lang) {
  if (lang === 'uk') return {
    save: 'Зберегти', saving: 'Зберігаємо…', saved: 'Збережено',
    cancel: 'Скасувати', clearAll: 'Очистити все', clearDay: 'Очистити', copyToWeek: 'На весь тиждень',
    regularTab: 'Регулярний графік', exceptionsTab: 'Винятки',
    exceptionsEmpty: 'Винятків поки немає',
    exceptionsEmptySub: 'Тут можна заблокувати конкретні дати — наприклад, відпустку або лікарняний. Клієнти не зможуть записатись на ці дні.',
    addException: 'Додати виняток', templateLabel: 'Швидкий шаблон:',
    hint: 'Виділи робочі години — клієнти бачитимуть лише ці інтервали при записі.',
    addSlot: 'Додати', weekend: 'Вихідний', from: 'Від', to: 'До',
    apply: 'Готово', remove: 'Видалити', editTitle: 'Робочий слот',
    conflictTitle: 'Не вдається зберегти',
    conflictHint: 'Ці записи опиняться поза робочим часом. Перенесіть або скасуйте їх:',
    close: 'Закрити', copyCol: 'На тиждень',
  };
  if (lang === 'en') return {
    save: 'Save', saving: 'Saving…', saved: 'Saved',
    cancel: 'Cancel', clearAll: 'Clear all', clearDay: 'Clear', copyToWeek: 'Apply to week',
    regularTab: 'Regular schedule', exceptionsTab: 'Exceptions',
    exceptionsEmpty: 'No exceptions yet',
    exceptionsEmptySub: 'Block specific dates — e.g. vacation or sick leave.',
    addException: 'Add exception', templateLabel: 'Quick template:',
    hint: 'Select working hours — clients will only see these slots when booking.',
    addSlot: 'Add', weekend: 'Off', from: 'From', to: 'To',
    apply: 'Apply', remove: 'Delete', editTitle: 'Working slot',
    conflictTitle: 'Can\'t save',
    conflictHint: 'These bookings would fall outside working hours:',
    close: 'Close', copyCol: 'Copy to week',
  };
  return {
    save: 'Сохранить', saving: 'Сохраняем…', saved: 'Сохранено',
    cancel: 'Отмена', clearAll: 'Очистить всё', clearDay: 'Очистить', copyToWeek: 'На всю неделю',
    regularTab: 'Регулярный график', exceptionsTab: 'Исключения',
    exceptionsEmpty: 'Исключений пока нет',
    exceptionsEmptySub: 'Здесь можно заблокировать конкретные даты — например, отпуск или больничный.',
    addException: 'Добавить исключение', templateLabel: 'Быстрый шаблон:',
    hint: 'Выдели рабочие часы — клиенты увидят только эти интервалы при записи.',
    addSlot: 'Добавить', weekend: 'Выходной', from: 'С', to: 'До',
    apply: 'Готово', remove: 'Удалить', editTitle: 'Рабочий слот',
    conflictTitle: 'Не удалось сохранить',
    conflictHint: 'Эти записи окажутся в нерабочее время. Перенесите или отмените их:',
    close: 'Закрыть', copyCol: 'На неделю',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConflictAppointment {
  id: string; starts_at: string; ends_at: string;
  client_name: string | null; service_name: string | null;
}

interface Props {
  initial?: WorkingHours | null;
  saveEndpoint?: string;
  initData?: string | null;
  lang?: Lang;
  onSaved?: (wh: WorkingHours) => void;
  onChange?: (wh: WorkingHours) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WorkingHoursEditor({
  initial, saveEndpoint, initData, lang = 'uk', onSaved, onChange,
}: Props) {
  const [hours, setHours] = useState<WorkingHours>(() => initial ?? emptyWorkingHours());
  const [savedHours, setSavedHours] = useState<WorkingHours>(() => initial ?? emptyWorkingHours());
  const [mobileDayIdx, setMobileDayIdx] = useState(() => (new Date().getDay() + 6) % 7);
  const [activeTab, setActiveTab] = useState<'regular' | 'exceptions'>('regular');
  const [editing, setEditing] = useState<{ day: WeekDayKey; index: number; start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictAppointment[] | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (initial) { setHours(initial); setSavedHours(initial); }
  }, [initial]);

  const dirty = useMemo(() => JSON.stringify(hours) !== JSON.stringify(savedHours), [hours, savedHours]);
  const L = useMemo(() => getLabels(lang), [lang]);
  const ds = DAY_SHORT[lang];
  const df = DAY_FULL[lang];
  const mobileDayKey = WEEK_DAY_KEYS[mobileDayIdx];
  const todayIdx = useMemo(() => (new Date().getDay() + 6) % 7, []);

  const weekDates = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
    return WEEK_DAY_KEYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.getDate();
    });
  }, []);

  function patch(next: WorkingHours) { setHours(next); onChange?.(next); }

  function toggleDay(d: WeekDayKey) {
    const cur = hours[d];
    if (cur.enabled) {
      patch({ ...hours, [d]: { ...cur, enabled: false } });
    } else {
      const intervals = cur.intervals.length > 0 ? cur.intervals : [{ start: '10:00', end: '19:00' }];
      patch({ ...hours, [d]: { enabled: true, intervals } });
    }
  }

  function commitDragSlot(d: WeekDayKey, startMin: number, endMin: number) {
    const start = minToHHMM(startMin);
    const end = minToHHMM(endMin);
    const draft = sanitizeIntervals([...hours[d].intervals, { start, end }]);
    patch({ ...hours, [d]: { enabled: draft.length > 0, intervals: draft } });
  }

  function deleteInterval(d: WeekDayKey, idx: number) {
    const next = hours[d].intervals.filter((_, i) => i !== idx);
    patch({ ...hours, [d]: { enabled: next.length > 0, intervals: next } });
  }

  function clearDay(d: WeekDayKey) {
    patch({ ...hours, [d]: { ...hours[d], intervals: [] } });
  }

  function copyToWeek(src: WeekDayKey) {
    const srcIntervals = hours[src].intervals;
    const next = { ...hours };
    WEEK_DAY_KEYS.forEach(d => {
      if (d !== src && next[d].enabled) {
        next[d] = { ...next[d], intervals: JSON.parse(JSON.stringify(srcIntervals)) };
      }
    });
    patch(next);
  }

  function applyTemplate(startMin: number, endMin: number) {
    const start = minToHHMM(startMin);
    const end = minToHHMM(endMin);
    const next = { ...hours };
    WEEK_DAY_KEYS.forEach(d => {
      if (next[d].enabled) next[d] = { ...next[d], intervals: [{ start, end }] };
    });
    patch(next);
  }

  function clearAll() {
    const next = { ...hours };
    WEEK_DAY_KEYS.forEach(d => { next[d] = { ...next[d], intervals: [] }; });
    patch(next);
  }

  function openEdit(d: WeekDayKey, idx: number) {
    const iv = hours[d].intervals[idx];
    setEditing({ day: d, index: idx, start: iv.start, end: iv.end });
  }

  function openAdd(d: WeekDayKey) {
    setEditing({ day: d, index: -1, start: '10:00', end: '12:00' });
  }

  function applyEditing() {
    if (!editing) return;
    const cur = hours[editing.day];
    const draft = [...cur.intervals];
    const newIv: WorkingInterval = { start: editing.start, end: editing.end };
    if (editing.index === -1) draft.push(newIv); else draft[editing.index] = newIv;
    const sane = sanitizeIntervals(draft);
    patch({ ...hours, [editing.day]: { enabled: sane.length > 0, intervals: sane } });
    setEditing(null);
  }

  async function save() {
    if (!saveEndpoint) { onSaved?.(hours); return; }
    setBusy(true); setConflicts(null);
    try {
      const res = await fetch(saveEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(initData ? { 'X-TG-Init-Data': initData } : {}) },
        body: JSON.stringify({ working_hours: hours }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data.conflicts)) { setConflicts(data.conflicts as ConflictAppointment[]); return; }
      if (!res.ok) { alert(data?.message ?? data?.error ?? 'Не удалось сохранить'); return; }
      setSavedHours(hours); onSaved?.(hours);
      setSavedToast(true); setTimeout(() => setSavedToast(false), 2000);
    } finally { setBusy(false); }
  }

  const TEMPLATES = [
    { label: '10:00–19:00', start: 600, end: 1140 },
    { label: '09:00–18:00', start: 540, end: 1080 },
    { label: '12:00–21:00', start: 720, end: 1260 },
    { label: '14:00–22:00', start: 840, end: 1320 },
  ];

  return (
    <div className="flex flex-col">

      {/* ══════ MOBILE (hidden md+) ═══════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col">

        {/* Hint */}
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-600">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{L.hint}</span>
        </div>

        {/* Day strip */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
          {WEEK_DAY_KEYS.map((d, i) => {
            const active = i === mobileDayIdx;
            const hasBlocks = hours[d].intervals.length > 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setMobileDayIdx(i)}
                className={[
                  'shrink-0 flex flex-col items-center justify-center min-w-[46px] px-2 py-2',
                  'rounded-xl border-[1.5px] cursor-pointer font-[inherit] transition-all',
                  active
                    ? 'border-blue-500 bg-white text-blue-600 shadow-md'
                    : i === todayIdx
                      ? 'border-blue-200 bg-neutral-100 text-neutral-500'
                      : 'border-transparent bg-neutral-100 text-neutral-500',
                ].join(' ')}
              >
                <span className="text-[10px] font-bold tracking-wider uppercase leading-none">{ds[d]}</span>
                <span className="text-base font-bold mt-0.5 leading-none">{weekDates[i]}</span>
                <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 transition-opacity ${hasBlocks ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>

        {/* Day toggle bar */}
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <span className="flex-1 text-sm font-semibold text-neutral-900">{df[mobileDayKey]}</span>
          <button
            type="button"
            onClick={() => toggleDay(mobileDayKey)}
            className={[
              'relative w-11 h-6 rounded-full border-none cursor-pointer shrink-0 transition-colors duration-[140ms]',
              hours[mobileDayKey].enabled ? 'bg-blue-600' : 'bg-neutral-300',
            ].join(' ')}
            aria-label="Toggle working day"
          >
            <span className={[
              'absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-[140ms]',
              hours[mobileDayKey].enabled ? 'translate-x-[23px]' : 'translate-x-[3px]',
            ].join(' ')} />
          </button>
        </div>

        {/* Single-day grid */}
        <div className="mx-4 mb-3 overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-200 bg-white" style={{ maxHeight: 400 }}>
          <div className="grid" style={{ gridTemplateColumns: '36px 1fr', height: TOTAL_PX }}>
            {/* Hour rail */}
            <div className="border-r border-neutral-200 bg-neutral-50 shrink-0">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-right text-[10px] font-semibold text-neutral-400 pr-1.5" style={{ height: HOUR_PX, paddingTop: 3 }}>
                  {String(h).padStart(2, '0')}
                </div>
              ))}
            </div>
            {/* Single column */}
            <DayColumn
              day={mobileDayKey}
              info={hours[mobileDayKey]}
              showHeader={false}
              onToggle={() => toggleDay(mobileDayKey)}
              onEdit={(i) => openEdit(mobileDayKey, i)}
              onDelete={(i) => deleteInterval(mobileDayKey, i)}
              onDragCommit={(s, e) => commitDragSlot(mobileDayKey, s, e)}
            />
          </div>
        </div>

        {/* Mobile actions */}
        <div className="mx-4 mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => clearDay(mobileDayKey)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-neutral-200 bg-white py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <Trash2 size={14} />
            {L.clearDay}
          </button>
          <button
            type="button"
            onClick={() => copyToWeek(mobileDayKey)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-none bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Copy size={14} />
            {L.copyToWeek}
          </button>
        </div>

        {/* Mobile save */}
        {saveEndpoint && (
          <div className="mx-4 mb-2">
            <SaveButton busy={busy} dirty={dirty} savedToast={savedToast} label={L.save} saving={L.saving} saved={L.saved} onClick={save} />
          </div>
        )}
      </div>

      {/* ══════ DESKTOP (hidden <md) ══════════════════════════════════════════ */}
      <div className="hidden md:flex md:flex-col gap-3">

        {/* Sub-tabs */}
        <div className="flex gap-1">
          {(['regular', 'exceptions'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-none font-[inherit]',
                activeTab === tab
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
              ].join(' ')}
            >
              {tab === 'regular' ? L.regularTab : L.exceptionsTab}
            </button>
          ))}
        </div>

        {/* Regular schedule pane */}
        {activeTab === 'regular' && (
          <>
            {/* Template toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-neutral-200 bg-neutral-50 px-4 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 shrink-0">{L.templateLabel}</span>
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t.start, t.end)}
                  className="inline-flex items-center px-2.5 py-1 rounded-full border-[1.5px] border-neutral-200 bg-white text-xs font-semibold text-neutral-500 cursor-pointer transition-all hover:border-blue-500 hover:text-blue-600 font-[inherit]"
                >
                  {t.label}
                </button>
              ))}
              <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[1.5px] border-neutral-200 bg-white text-xs font-semibold text-neutral-500 cursor-pointer transition-all hover:border-red-400 hover:text-red-500 font-[inherit]"
              >
                <Trash2 size={11} />
                {L.clearAll}
              </button>
            </div>

            {/* Week grid */}
            <div className="overflow-x-auto overflow-y-auto rounded-b-xl border border-neutral-200 bg-white" style={{ maxHeight: 500 }}>
              <div className="flex min-w-[680px]">

                {/* Hour rail */}
                <div className="sticky left-0 z-10 shrink-0 border-r border-neutral-200 bg-neutral-50 flex flex-col" style={{ width: 48 }}>
                  {/* Header spacer */}
                  <div className="border-b border-neutral-200 shrink-0" style={{ height: 64 }} />
                  {/* Hours 0–23 */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="text-right text-[10.5px] font-semibold text-neutral-400 pr-2 tabular-nums shrink-0"
                      style={{ height: HOUR_PX, paddingTop: 2, borderBottom: h < 23 ? '1px solid #f1f5f9' : 'none' }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                  {/* Footer spacer */}
                  <div className="shrink-0 border-t border-neutral-200 bg-neutral-50" style={{ height: 34 }} />
                </div>

                {/* 7 Day columns */}
                {WEEK_DAY_KEYS.map((d, i) => (
                  <DayColumn
                    key={d}
                    day={d}
                    dayShort={ds[d]}
                    dateNum={weekDates[i]}
                    isToday={i === todayIdx}
                    info={hours[d]}
                    showHeader={true}
                    copyLabel={L.copyCol}
                    onToggle={() => toggleDay(d)}
                    onEdit={(idx) => openEdit(d, idx)}
                    onDelete={(idx) => deleteInterval(d, idx)}
                    onDragCommit={(s, e) => commitDragSlot(d, s, e)}
                    onCopyToWeek={() => copyToWeek(d)}
                  />
                ))}
              </div>
            </div>

            {/* Desktop save */}
            {saveEndpoint && (
              <div className="flex justify-end">
                <SaveButton busy={busy} dirty={dirty} savedToast={savedToast} label={L.save} saving={L.saving} saved={L.saved} onClick={save} />
              </div>
            )}
          </>
        )}

        {/* Exceptions pane */}
        {activeTab === 'exceptions' && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 px-8 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <CalendarX size={26} />
            </div>
            <div>
              <div className="text-base font-bold text-neutral-900 mb-1">{L.exceptionsEmpty}</div>
              <div className="text-sm text-neutral-500 max-w-xs leading-relaxed">{L.exceptionsEmptySub}</div>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition">
              <Plus size={14} />
              {L.addException}
            </button>
          </div>
        )}
      </div>

      {/* ══════ Modals (shared) ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {editing && (
          <EditModal
            title={editing.index === -1 ? L.addSlot : L.editTitle}
            from={editing.start}
            to={editing.end}
            fromLabel={L.from}
            toLabel={L.to}
            applyLabel={L.apply}
            cancelLabel={L.cancel}
            removeLabel={editing.index >= 0 ? L.remove : null}
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
            title={L.conflictTitle}
            hint={L.conflictHint}
            close={L.close}
            conflicts={conflicts}
            onClose={() => setConflicts(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SaveButton ───────────────────────────────────────────────────────────────
function SaveButton({
  busy, dirty, savedToast, label, saving, saved, onClick,
}: {
  busy: boolean; dirty: boolean; savedToast: boolean;
  label: string; saving: string; saved: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || !dirty}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-blue-700 transition w-full md:w-auto"
    >
      {busy
        ? <><Loader2 size={15} className="animate-spin" />{saving}</>
        : savedToast
          ? <><Check size={15} />{saved}</>
          : label}
    </button>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────────
function DayColumn({
  day, dayShort = '', dateNum, isToday = false, info,
  showHeader, copyLabel,
  onToggle, onEdit, onDelete, onDragCommit, onCopyToWeek,
}: {
  day: WeekDayKey;
  dayShort?: string;
  dateNum?: number;
  isToday?: boolean;
  info: WorkingDay;
  showHeader: boolean;
  copyLabel?: string;
  onToggle: () => void;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
  onDragCommit: (startMin: number, endMin: number) => void;
  onCopyToWeek?: () => void;
}) {
  const enabled = info.enabled;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ startMin: number; endMin: number } | null>(null);

  function pxToMin(clientY: number): number {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    const px = clamp(clientY - rect.top, 0, TOTAL_PX);
    return clamp(snapM((px / HOUR_PX) * 60), 0, 24 * 60);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    e.preventDefault();
    const min = pxToMin(e.clientY);
    setDrag({ startMin: min, endMin: min + SNAP_MIN });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const min = pxToMin(e.clientY);
    setDrag(prev => prev ? { ...prev, endMin: Math.max(prev.startMin + SNAP_MIN, min) } : null);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const a = drag.startMin;
    const b = Math.max(drag.startMin + SNAP_MIN, drag.endMin);
    setDrag(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (b - a < SNAP_MIN) return;
    onDragCommit(a, b);
  }

  const previewTop = drag ? m2y(drag.startMin) : 0;
  const previewH   = drag ? Math.max(CELL_H, m2y(drag.endMin - drag.startMin)) : 0;

  return (
    <div className="flex flex-1 flex-col border-r border-neutral-200 last:border-r-0 min-w-0">

      {/* Column header (desktop only) */}
      {showHeader && (
        <div className="flex flex-col items-center justify-center gap-1 border-b border-neutral-200 py-2 shrink-0" style={{ height: 64 }}>
          <span className={`text-[11px] font-bold uppercase tracking-wider leading-none ${isToday ? 'text-blue-600' : 'text-neutral-500'}`}>
            {dayShort}
          </span>
          {dateNum !== undefined && (
            <span className={`text-lg font-bold leading-none ${isToday ? 'text-blue-600' : 'text-neutral-800'}`}>
              {dateNum}
            </span>
          )}
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="w-4 h-4 cursor-pointer rounded accent-blue-600"
            aria-label={`Toggle ${dayShort}`}
          />
        </div>
      )}

      {/* Time grid */}
      <div
        ref={gridRef}
        className={`relative flex-1 touch-none ${enabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={{
          height: TOTAL_PX,
          background: enabled ? undefined : 'repeating-linear-gradient(135deg, #f1f5f9 0 5px, transparent 5px 10px)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Hour lines */}
        {Array.from({ length: 25 }, (_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0"
            style={{ top: h * HOUR_PX, height: 1, background: h % 1 === 0 ? '#f1f5f9' : 'transparent' }}
          />
        ))}
        {/* Quarter lines (lighter) */}
        {Array.from({ length: 24 * 4 }, (_, i) => (
          i % 4 !== 0 ? (
            <div
              key={i}
              className="absolute left-0 right-0"
              style={{ top: i * CELL_H, height: 1, background: i % 2 === 0 ? '#f8fafc' : 'transparent', borderBottom: i % 2 === 0 ? '1px dashed #e2e8f0' : 'none' }}
            />
          ) : null
        ))}

        {/* Drag ghost */}
        {drag && (
          <div
            className="absolute left-[3px] right-[3px] rounded-md border-[1.5px] border-dashed border-blue-500 bg-blue-500/10 pointer-events-none z-[3] px-2 py-1 text-[11px] font-bold text-blue-600"
            style={{ top: previewTop, height: previewH }}
          >
            {minToHHMM(drag.startMin)} — {minToHHMM(Math.max(drag.startMin + SNAP_MIN, drag.endMin))}
          </div>
        )}

        {/* Working blocks */}
        {enabled && info.intervals.map((iv, i) => {
          const top = m2y(hhmm2min(iv.start));
          const height = Math.max(CELL_H, m2y(hhmm2min(iv.end) - hhmm2min(iv.start)));
          return (
            <WorkingBlock
              key={i}
              iv={iv}
              top={top}
              height={height}
              onEdit={() => onEdit(i)}
              onDelete={() => onDelete(i)}
            />
          );
        })}

        {/* Empty hint */}
        {enabled && info.intervals.length === 0 && !drag && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-neutral-400 font-medium text-center px-2 opacity-60">↕ drag</span>
          </div>
        )}
      </div>

      {/* Column footer (desktop: copy-to-week) */}
      {showHeader && onCopyToWeek && (
        <div className="flex items-center justify-center border-t border-neutral-200 py-1.5 shrink-0" style={{ height: 34 }}>
          {enabled && info.intervals.length > 0 ? (
            <button
              type="button"
              onClick={onCopyToWeek}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-semibold text-neutral-400 border-none bg-transparent cursor-pointer transition hover:text-blue-600 hover:bg-blue-50 font-[inherit]"
            >
              <Copy size={10} />
              {copyLabel}
            </button>
          ) : (
            <span className="text-[10px] text-neutral-300">–</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WorkingBlock ─────────────────────────────────────────────────────────────
function WorkingBlock({
  iv, top, height, onEdit, onDelete,
}: {
  iv: WorkingInterval; top: number; height: number;
  onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dur = hhmm2min(iv.end) - hhmm2min(iv.start);
  const durLabel = `${Math.floor(dur / 60)}${dur % 60 ? `:${String(dur % 60).padStart(2,'0')}` : ''} год`;

  return (
    <button
      type="button"
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute left-[3px] right-[3px] rounded-md bg-blue-50 border-[1.5px] border-blue-500 z-[2] text-left overflow-hidden transition"
      style={{ top, height, boxShadow: hovered ? '0 4px 12px rgba(37,99,235,0.2)' : undefined }}
    >
      <div className="px-2 py-1 text-[11px] font-bold text-blue-600 leading-tight">
        {iv.start} — {iv.end}
        {height > 40 && <div className="text-[10px] font-medium opacity-70 mt-0.5">{durLabel}</div>}
      </div>
      {hovered && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-[3px] right-[3px] w-[18px] h-[18px] rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-red-500 transition"
        >
          <X size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────
function EditModal({
  title, from, to, fromLabel, toLabel,
  applyLabel, cancelLabel, removeLabel,
  onChangeFrom, onChangeTo,
  onApply, onCancel, onRemove,
}: {
  title: string; from: string; to: string;
  fromLabel: string; toLabel: string;
  applyLabel: string; cancelLabel: string; removeLabel: string | null;
  onChangeFrom: (v: string) => void; onChangeTo: (v: string) => void;
  onApply: () => void; onCancel: () => void; onRemove?: () => void;
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
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-50 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
      >
        <h3 className="mb-4 text-base font-bold text-neutral-900">{title}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-neutral-500">{fromLabel}</span>
            <input
              type="time"
              value={from}
              step={SNAP_MIN * 60}
              onChange={(e) => onChangeFrom(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-mono text-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-neutral-500">{toLabel}</span>
            <input
              type="time"
              value={to}
              step={SNAP_MIN * 60}
              onChange={(e) => onChangeTo(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-mono text-neutral-900"
            />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-2">
          {onRemove && removeLabel && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition"
            >
              {removeLabel}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onApply}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── ConflictModal ────────────────────────────────────────────────────────────
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
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-50 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
      >
        <div className="mb-3 flex items-center gap-2 text-amber-500">
          <AlertTriangle size={18} />
          <h3 className="text-base font-bold text-neutral-900">{title}</h3>
        </div>
        <p className="mb-3 text-sm text-neutral-600">{hint}</p>
        <ul className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          {conflicts.map((c) => {
            const d = new Date(c.starts_at);
            const label = d.toLocaleString('uk-UA', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              timeZone: 'Europe/Kiev',
            });
            return (
              <li key={c.id} className="text-sm text-neutral-800">
                <span className="font-semibold">{label}</span>
                {c.service_name && <> · {c.service_name}</>}
                {c.client_name && <> · {c.client_name}</>}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-neutral-100 px-5 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200 transition"
        >
          {close}
        </button>
      </motion.div>
    </>
  );
}
