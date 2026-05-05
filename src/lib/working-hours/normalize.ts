/** --- YAML
 * name: working-hours normalize
 * description: Defensive нормализатор формата working_hours. Принимает старый
 *              single-interval JSON или новый multi-interval, всегда возвращает
 *              новый формат. Используется в slot-генерации, public-page-display
 *              и везде где читаем working_hours от мастера.
 * created: 2026-05-05
 * --- */

import {
  type WeekDayKey,
  type WorkingDay,
  type WorkingHours,
  type WorkingInterval,
  WEEK_DAY_KEYS,
  emptyWorkingHours,
  defaultWorkingHours,
} from '@/types/working-hours';

interface OldDay {
  start?: string;
  end?: string;
  closed?: boolean;
  break_start?: string;
  break_end?: string;
}

interface NewDay {
  enabled?: boolean;
  intervals?: Array<Partial<WorkingInterval>>;
}

type AnyDay = OldDay | NewDay | null | undefined;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidHHMM(s: unknown): s is string {
  return typeof s === 'string' && HHMM.test(s);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Сортирует и схлопывает пересекающиеся / соседние интервалы. */
export function sanitizeIntervals(raw: Array<Partial<WorkingInterval>>): WorkingInterval[] {
  const valid = raw
    .filter((iv) => isValidHHMM(iv.start) && isValidHHMM(iv.end))
    .map((iv) => ({ start: iv.start as string, end: iv.end as string }))
    .filter((iv) => toMinutes(iv.end) > toMinutes(iv.start));
  if (!valid.length) return [];
  valid.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const out: WorkingInterval[] = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const prev = out[out.length - 1];
    const cur = valid[i];
    if (toMinutes(cur.start) <= toMinutes(prev.end)) {
      // Перекрытие или примыкание — склеиваем
      prev.end = fromMinutes(Math.max(toMinutes(prev.end), toMinutes(cur.end)));
    } else {
      out.push(cur);
    }
  }
  return out;
}

function normalizeDay(raw: AnyDay): WorkingDay {
  if (raw == null) return { enabled: false, intervals: [] };
  if (typeof raw !== 'object') return { enabled: false, intervals: [] };

  // Новый формат
  if ('enabled' in raw || 'intervals' in raw) {
    const r = raw as NewDay;
    const intervals = Array.isArray(r.intervals) ? sanitizeIntervals(r.intervals) : [];
    const enabled = r.enabled !== false && intervals.length > 0;
    return { enabled, intervals };
  }

  // Старый формат
  const r = raw as OldDay;
  if (r.closed === true) return { enabled: false, intervals: [] };
  if (isValidHHMM(r.start) && isValidHHMM(r.end)) {
    return {
      enabled: true,
      intervals: sanitizeIntervals([{ start: r.start, end: r.end }]),
    };
  }
  return { enabled: false, intervals: [] };
}

/**
 * Принимает любую форму working_hours (jsonb из БД, undefined, null) и
 * возвращает строго типизированный новый формат. Если данные отсутствуют —
 * возвращает все дни выключенными (`emptyWorkingHours`). Defensive: никогда
 * не бросает, всегда возвращает валидную WorkingHours.
 */
export function normalizeWorkingHours(raw: unknown): WorkingHours {
  if (raw == null || typeof raw !== 'object') return emptyWorkingHours();
  const src = raw as Record<string, AnyDay>;
  const out = emptyWorkingHours();
  for (const k of WEEK_DAY_KEYS) {
    out[k] = normalizeDay(src[k]);
  }
  return out;
}

/**
 * То же что normalizeWorkingHours, но если ВСЕ дни пустые → возвращает
 * defaultWorkingHours (пн-пт 10-19). Удобно для booking-страниц где нужен
 * fallback когда мастер ещё не настроил.
 */
export function normalizeWithDefault(raw: unknown): WorkingHours {
  const out = normalizeWorkingHours(raw);
  const anyEnabled = WEEK_DAY_KEYS.some((k) => out[k].enabled && out[k].intervals.length);
  return anyEnabled ? out : defaultWorkingHours();
}

const DAY_FROM_DATE: WeekDayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

/** День недели из Date (по локальному часовому поясу JS). */
export function dayKeyFromDate(d: Date): WeekDayKey {
  return DAY_FROM_DATE[d.getDay()];
}

/** Проверка: попадает ли «HH:MM» в один из интервалов дня. */
export function isMinuteInside(day: WorkingDay, hhmm: string): boolean {
  if (!day.enabled || !day.intervals.length) return false;
  if (!isValidHHMM(hhmm)) return false;
  const m = toMinutes(hhmm);
  return day.intervals.some(
    (iv) => toMinutes(iv.start) <= m && m < toMinutes(iv.end),
  );
}

/** Проверка: попадает ли диапазон [from, to) полностью внутрь одного из интервалов. */
export function isRangeInside(day: WorkingDay, from: string, to: string): boolean {
  if (!day.enabled || !day.intervals.length) return false;
  if (!isValidHHMM(from) || !isValidHHMM(to)) return false;
  const fm = toMinutes(from);
  const tm = toMinutes(to);
  if (tm <= fm) return false;
  return day.intervals.some(
    (iv) => toMinutes(iv.start) <= fm && tm <= toMinutes(iv.end),
  );
}
