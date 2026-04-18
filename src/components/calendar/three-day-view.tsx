/** --- YAML
 * name: ThreeDayView
 * description: Fresha-style 3-day calendar view — 3 columns with hourly grid, appointment blocks, current time line
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { AlertTriangle } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';
import { FONT } from '@/lib/dashboard-theme';

const HOUR_HEIGHT = 72;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_COL_WIDTH = 64;

const LIGHT = {
  pageBg: '#ffffff',
  nonWorkingBg: '#f8f6fd',
  gridBorder: 'rgba(124,58,237,0.08)',
  gridBorderSub: 'rgba(124,58,237,0.04)',
  text: '#1a1530',
  timeText: '#64607a',
  currentTime: '#ef4444',
  todayBg: 'rgba(124,58,237,0.04)',
  headerBg: '#ffffff',
  headerBorder: 'rgba(124,58,237,0.08)',
  headerShadow: 'rgba(124,58,237,0.06) 0px 2px 4px 0px',
  todayDot: '#7c3aed',
};

const DARK = {
  pageBg: '#0b0d17',
  nonWorkingBg: '#0f1120',
  gridBorder: 'rgba(139,92,246,0.1)',
  gridBorderSub: 'rgba(139,92,246,0.05)',
  text: '#eae8f4',
  timeText: '#a8a3be',
  currentTime: '#f87171',
  todayBg: 'rgba(139,92,246,0.1)',
  headerBg: '#111425',
  headerBorder: 'rgba(139,92,246,0.1)',
  headerShadow: 'rgba(0, 0, 0, 0.4) 0px 2px 4px 0px',
  todayDot: '#a78bfa',
};

const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

interface ThreeDayViewProps {
  startDate: Date;
  appointments: AppointmentData[];
  workStart: number;
  workEnd: number;
  /** Slot interval in minutes (5/10/15/30/60). Controls sub-hour grid lines. Default 10. */
  slotMinutes?: number;
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
  onDayClick: (date: Date) => void;
}

export function ThreeDayView({
  startDate,
  appointments,
  workStart,
  workEnd,
  slotMinutes = 10,
  onSlotClick,
  onAppointmentClick,
  onDayClick,
}: ThreeDayViewProps) {
  const t = useTranslations('calendar');
  const { resolvedTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
  const today = new Date();

  const days = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (workStart - 1) * HOUR_HEIGHT);
    }
  }, [workStart]);

  function getApptsForDay(day: Date) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate();
    });
  }

  function timeToY(dateStr: string): number {
    const d = new Date(dateStr);
    return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
  }

  function durationToH(startStr: string, endStr: string): number {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
    return (ms / 3_600_000) * HOUR_HEIGHT;
  }

  function isToday(day: Date) {
    return day.toDateString() === today.toDateString();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FONT }}>
      {/* Day headers — sticky */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${C.headerBorder}`,
          backgroundColor: C.headerBg,
          boxShadow: C.headerShadow,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
        {days.map((day, i) => {
          const isTodayDay = isToday(day);
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 0',
                borderLeft: i > 0 ? `1px solid ${C.gridBorder}` : undefined,
                cursor: 'pointer',
                backgroundColor: isTodayDay ? C.todayBg : 'transparent',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: C.timeText }}>
                {DAY_NAMES_RU[day.getDay()]}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: isTodayDay ? C.todayDot : C.text,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    backgroundColor: isTodayDay ? C.todayDot : 'transparent',
                    ...(isTodayDay ? { color: '#ffffff' } : {}),
                  }}
                >
                  {day.getDate()}
                </span>
                <span style={{ fontSize: 12, color: C.timeText }}>
                  {MONTH_NAMES_RU[day.getMonth()]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', position: 'relative', height: TOTAL_HEIGHT }}>
          {/* Time labels */}
          <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative' }}>
            {Array.from({ length: TOTAL_HOURS }, (_, hour) => (
              <div
                key={hour}
                style={{ position: 'absolute', top: hour * HOUR_HEIGHT, left: 0, right: 0 }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    transform: 'translateY(-50%)',
                    width: '100%',
                    textAlign: 'right',
                    paddingRight: 10,
                    fontSize: 11,
                    color: C.timeText,
                    userSelect: 'none',
                  }}
                >
                  {`${String(hour).padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayAppts = getApptsForDay(day);
            const isTodayDay = isToday(day);

            return (
              <div
                key={dayIndex}
                style={{
                  flex: 1,
                  position: 'relative',
                  borderLeft: `1px solid ${C.gridBorder}`,
                }}
              >
                {/* Hour lines + working/non-working zones + sub-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, hour) => {
                  const isWorking = hour >= workStart && hour < workEnd;
                  const subsPerHour = 60 / slotMinutes;
                  return (
                    <div
                      key={hour}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: hour * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                        borderTop: `1px solid ${C.gridBorder}`,
                        backgroundColor: !isWorking ? C.nonWorkingBg : (isTodayDay ? C.todayBg : 'transparent'),
                      }}
                    >
                      {/* Sub-hour lines based on slotMinutes */}
                      {Array.from({ length: subsPerHour - 1 }, (__, si) => {
                        const subY = ((si + 1) / subsPerHour) * HOUR_HEIGHT;
                        const isHalf = (si + 1) * slotMinutes === 30;
                        return (
                          <div
                            key={si}
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: subY,
                              borderTop: `1px solid ${isHalf ? C.gridBorderSub : 'rgba(229,229,229,0.2)'}`,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* Appointments */}
                {dayAppts.map((appt) => {
                  const top = timeToY(appt.starts_at);
                  const height = durationToH(appt.starts_at, appt.ends_at);
                  const color = appt.service?.color || '#6366f1';
                  const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show';
                  const startTime = new Date(appt.starts_at);

                  return (
                    <div
                      key={appt.id}
                      onClick={() => onAppointmentClick(appt)}
                      style={{
                        position: 'absolute',
                        left: 3,
                        right: 3,
                        top: Math.max(0, top),
                        height: Math.max(24, height),
                        zIndex: 10,
                        borderLeft: `3px solid ${color}`,
                        backgroundColor: `${color}18`,
                        borderRadius: 6,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        opacity: isCancelled ? 0.4 : 1,
                        fontSize: 11,
                        fontFamily: FONT,
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600, color, lineHeight: 1.2 }}>
                        {appt.client?.has_health_alert && (
                          <AlertTriangle style={{ width: 10, height: 10, color: '#ef4444', flexShrink: 0 }} />
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {height > 32 && (
                        <div style={{ color: C.timeText, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {appt.client?.full_name}
                        </div>
                      )}
                      {height > 48 && (
                        <div style={{ color: C.timeText, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                          {appt.service?.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Current time line */}
          {(() => {
            const now = new Date();
            const isThisRange = days.some((d) => d.toDateString() === now.toDateString());
            if (!isThisRange) return null;
            const y = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
            return (
              <div
                style={{
                  position: 'absolute',
                  top: y,
                  left: TIME_COL_WIDTH,
                  right: 0,
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: C.currentTime, marginLeft: -4, flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 2, backgroundColor: C.currentTime }} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
