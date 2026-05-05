/** --- YAML
 * name: WorkingHours types
 * description: Multi-interval расписание мастера. Каждый день — флаг enabled
 *              + массив интервалов (start/end в формате "HH:MM"). Заменяет
 *              старый одно-интервальный формат с полем `closed`.
 * created: 2026-05-05
 * --- */

export type WeekDayKey =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export const WEEK_DAY_KEYS: WeekDayKey[] = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
];

export interface WorkingInterval {
  start: string; // "HH:MM"
  end: string;   // "HH:MM" — must be > start
}

export interface WorkingDay {
  enabled: boolean;
  intervals: WorkingInterval[]; // sorted by start, no overlaps
}

export type WorkingHours = Record<WeekDayKey, WorkingDay>;

/** Все дни выключены, без интервалов. */
export function emptyWorkingHours(): WorkingHours {
  return {
    monday:    { enabled: false, intervals: [] },
    tuesday:   { enabled: false, intervals: [] },
    wednesday: { enabled: false, intervals: [] },
    thursday:  { enabled: false, intervals: [] },
    friday:    { enabled: false, intervals: [] },
    saturday:  { enabled: false, intervals: [] },
    sunday:    { enabled: false, intervals: [] },
  };
}

/** Стандартное расписание: пн-пт 10:00-19:00, сб-вс выходной. */
export function defaultWorkingHours(): WorkingHours {
  const weekday: WorkingDay = {
    enabled: true,
    intervals: [{ start: '10:00', end: '19:00' }],
  };
  return {
    monday: weekday, tuesday: weekday, wednesday: weekday,
    thursday: weekday, friday: weekday,
    saturday: { enabled: false, intervals: [] },
    sunday:   { enabled: false, intervals: [] },
  };
}
