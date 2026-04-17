/** --- YAML
 * name: WorkPresetsPerVertical
 * description: Default work mode per vertical — slot duration, working hours, mobile/static, online consultations.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import type { VerticalKey } from './default-services';

export interface WorkPreset {
  /** Default slot length in minutes (used as step in the calendar) */
  slotMinutes: number;
  /** Typical work hours */
  workHours: { start: string; end: string };
  /** Master visits client's location (home/office) */
  mobileVisits: boolean;
  /** Master works online (Zoom, Meet, etc.) */
  onlineCapable: boolean;
  /** Typical appointment duration (used in service template defaults) */
  typicalDurationMinutes: number;
  /** Whether deposit/prepayment is typical */
  prepaymentTypical: boolean;
}

export const WORK_PRESETS: Record<VerticalKey, WorkPreset> = {
  beauty: {
    slotMinutes: 30,
    workHours: { start: '10:00', end: '20:00' },
    mobileVisits: false,
    onlineCapable: false,
    typicalDurationMinutes: 60,
    prepaymentTypical: false,
  },
  health: {
    // Dental, GP, physio
    slotMinutes: 30,
    workHours: { start: '09:00', end: '19:00' },
    mobileVisits: false,
    onlineCapable: true,
    typicalDurationMinutes: 45,
    prepaymentTypical: false,
  },
  auto: {
    // Plumber, electrician, auto mechanic, handyman
    slotMinutes: 60,
    workHours: { start: '08:00', end: '19:00' },
    mobileVisits: true,
    onlineCapable: false,
    typicalDurationMinutes: 90,
    prepaymentTypical: false,
  },
  tattoo: {
    slotMinutes: 60,
    workHours: { start: '12:00', end: '22:00' },
    mobileVisits: false,
    onlineCapable: false,
    typicalDurationMinutes: 180,
    prepaymentTypical: true, // deposit common
  },
  pets: {
    // Vet, groomer
    slotMinutes: 30,
    workHours: { start: '09:00', end: '19:00' },
    mobileVisits: true,
    onlineCapable: true,
    typicalDurationMinutes: 60,
    prepaymentTypical: false,
  },
  craft: {
    // Tailor, cobbler, watchmaker
    slotMinutes: 30,
    workHours: { start: '09:00', end: '19:00' },
    mobileVisits: false,
    onlineCapable: false,
    typicalDurationMinutes: 45,
    prepaymentTypical: true, // deposit for materials
  },
  fitness: {
    slotMinutes: 30,
    workHours: { start: '07:00', end: '22:00' },
    mobileVisits: true,
    onlineCapable: true,
    typicalDurationMinutes: 60,
    prepaymentTypical: false,
  },
  events: {
    // Photographer, DJ — usually single-day bookings, not slots
    slotMinutes: 60,
    workHours: { start: '10:00', end: '23:00' },
    mobileVisits: true,
    onlineCapable: false,
    typicalDurationMinutes: 240,
    prepaymentTypical: true,
  },
  education: {
    // Tutor, coach
    slotMinutes: 30,
    workHours: { start: '08:00', end: '22:00' },
    mobileVisits: false,
    onlineCapable: true,
    typicalDurationMinutes: 60,
    prepaymentTypical: false,
  },
  other: {
    slotMinutes: 30,
    workHours: { start: '09:00', end: '19:00' },
    mobileVisits: false,
    onlineCapable: false,
    typicalDurationMinutes: 60,
    prepaymentTypical: false,
  },
};

export function getWorkPreset(vertical: VerticalKey | null | undefined): WorkPreset {
  return WORK_PRESETS[vertical || 'other'] || WORK_PRESETS.other;
}

/**
 * AI tone per vertical — influences system prompt personality.
 * Used by src/lib/ai/openrouter.ts to adapt responses.
 */
export const AI_TONE_PER_VERTICAL: Record<VerticalKey, {
  tone: string;
  example: string;
}> = {
  beauty:    { tone: 'warm',         example: 'Привет! Смотрю, у тебя сегодня плотный день — 8 записей. Круто!' },
  health:    { tone: 'clinical',     example: 'Анализ приёмов: 12 визитов, средняя продолжительность 35 минут.' },
  auto:      { tone: 'direct',       example: '12 выездов на этой неделе. Загрузка высокая — стоит рассмотреть рост цен.' },
  tattoo:    { tone: 'casual',       example: 'Бро, загрузка топ — 4 сеанса в неделю. Депозитов на 8000.' },
  pets:      { tone: 'warm',         example: 'У вас 15 визитов на этой неделе — пушистики довольны 🐾' },
  craft:     { tone: 'professional', example: 'За неделю выполнено 12 заказов, средний чек 450 ₴.' },
  fitness:   { tone: 'motivational', example: 'Сильная неделя! 28 тренировок, 12 клиентов повысили прогресс.' },
  events:    { tone: 'professional', example: 'Подтверждено 3 мероприятия на месяц, сумма депозитов 15000 ₴.' },
  education: { tone: 'supportive',   example: 'За неделю 18 занятий, 3 ученика показали рост успеваемости.' },
  other:     { tone: 'professional', example: 'Отчёт за неделю: 20 встреч, выручка 15000 ₴.' },
};
