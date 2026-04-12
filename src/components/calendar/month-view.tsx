/** --- YAML
 * name: MonthView
 * description: Fresha-style month calendar grid — day cells with appointment dots/counts, today highlight, click to day view
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import type { AppointmentData } from '@/hooks/use-appointments';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  pageBg: '#ffffff',
  headerBg: '#ffffff',
  headerBorder: '#e5e5e5',
  cellBg: '#ffffff',
  cellHover: '#f9f9f9',
  cellBorder: '#e5e5e5',
  otherMonthBg: '#fafafa',
  otherMonthText: '#c4c4c4',
  text: '#000000',
  textMuted: '#737373',
  todayBg: '#6950f3',
  todayText: '#ffffff',
  accent: '#6950f3',
  dotColors: ['#6950f3', '#a5dff8', '#f59e0b', '#10b981', '#ef4444', '#ec4899'],
  weekendBg: '#fafafa',
};

const DARK = {
  pageBg: '#000000',
  headerBg: '#000000',
  headerBorder: '#1a1a1a',
  cellBg: '#000000',
  cellHover: '#000000',
  cellBorder: '#1a1a1a',
  otherMonthBg: '#141414',
  otherMonthText: '#444444',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  todayBg: '#6950f3',
  todayText: '#ffffff',
  accent: '#8b7cf6',
  dotColors: ['#8b7cf6', '#60b8d6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'],
  weekendBg: '#151515',
};

const DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface MonthViewProps {
  currentDate: Date;
  appointments: AppointmentData[];
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
}

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startDow);

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // Stop if next week starts in next+1 month
    if (cursor.getMonth() !== month && w >= 4) break;
  }

  return weeks;
}

export function MonthView({ currentDate, appointments, onDayClick, onAppointmentClick }: MonthViewProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = getMonthGrid(year, month);

  function getApptsForDay(day: Date): AppointmentData[] {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate();
    });
  }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function cellKey(day: Date) {
    return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FONT, backgroundColor: C.pageBg }}>
      {/* Day-of-week headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${C.headerBorder}`,
          backgroundColor: C.headerBg,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {DAY_HEADERS.map((name, i) => (
          <div
            key={name}
            style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: i >= 5 ? C.accent : C.textMuted,
              borderLeft: i > 0 ? `1px solid ${C.cellBorder}` : undefined,
            }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              flex: 1,
              minHeight: 0,
            }}
          >
            {week.map((day, di) => {
              const isThisMonth = day.getMonth() === month;
              const isToday = isSameDay(day, today);
              const isWeekend = di >= 5;
              const dayAppts = getApptsForDay(day);
              const key = cellKey(day);
              const isHovered = hoveredCell === key;

              return (
                <div
                  key={key}
                  onClick={() => onDayClick(day)}
                  onMouseEnter={() => setHoveredCell(key)}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    borderLeft: di > 0 ? `1px solid ${C.cellBorder}` : undefined,
                    borderBottom: `1px solid ${C.cellBorder}`,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    backgroundColor: isHovered
                      ? C.cellHover
                      : !isThisMonth
                        ? C.otherMonthBg
                        : isWeekend
                          ? C.weekendBg
                          : C.cellBg,
                    transition: 'background-color 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minHeight: 80,
                  }}
                >
                  {/* Day number */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 9999,
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 500,
                        backgroundColor: isToday ? C.todayBg : 'transparent',
                        color: isToday ? C.todayText : !isThisMonth ? C.otherMonthText : C.text,
                      }}
                    >
                      {day.getDate()}
                    </span>
                    {dayAppts.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>
                        {dayAppts.length}
                      </span>
                    )}
                  </div>

                  {/* Appointment previews */}
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayAppts.slice(0, 3).map((appt) => {
                      const color = appt.service?.color || C.accent;
                      const startTime = new Date(appt.starts_at);
                      const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show';

                      return (
                        <div
                          key={appt.id}
                          onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 4px',
                            borderRadius: 3,
                            backgroundColor: `${color}15`,
                            borderLeft: `2px solid ${color}`,
                            cursor: 'pointer',
                            opacity: isCancelled ? 0.4 : 1,
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
                            {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appt.client?.full_name || appt.service?.name}
                          </span>
                        </div>
                      );
                    })}
                    {dayAppts.length > 3 && (
                      <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, paddingLeft: 4 }}>
                        +{dayAppts.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
