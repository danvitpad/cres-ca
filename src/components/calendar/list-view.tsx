/** --- YAML
 * name: ListView
 * description: Flat scrollable list of appointments grouped by date — replaces removed Finance "Записи" tab. Click opens detail drawer.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useTheme } from 'next-themes';
import { CalendarX, Clock } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';
import { FONT } from '@/lib/dashboard-theme';
import { EmptyState } from '@/components/shared/primitives/empty-state';

interface ListViewProps {
  appointments: AppointmentData[];
  onAppointmentClick: (appt: AppointmentData) => void;
  onDayClick?: (date: Date) => void;
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Подтверждена',
  pending: 'Ожидает',
  completed: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayHeader(d: Date, today: Date) {
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const prefix = sameDay ? 'Сегодня' : isTomorrow ? 'Завтра' : WEEKDAYS[d.getDay()];
  return `${prefix}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ListView({ appointments, onAppointmentClick, onDayClick }: ListViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const C = isDark
    ? {
      bg: '#0a0b0f', surface: '#1a1a1d', border: 'rgba(45,212,191,0.12)',
      text: '#f5f3ff', textSecondary: '#c9c2e6', textTertiary: '#8781a5',
      hover: '#151830', accent: '#2dd4bf', success: '#10b981', danger: '#ef4444',
      warning: '#f59e0b', sectionBg: 'rgba(45,212,191,0.04)',
    }
    : {
      bg: '#faf8ff', surface: '#ffffff', border: 'rgba(13,148,136,0.10)',
      text: '#0a0a0a', textSecondary: '#4a4666', textTertiary: '#8781a5',
      hover: '#fafafa', accent: '#0d9488', success: '#16a34a', danger: '#dc2626',
      warning: '#d97706', sectionBg: 'rgba(13,148,136,0.03)',
    };

  if (appointments.length === 0) {
    return (
      <div style={{ padding: 48, background: C.bg, minHeight: '100%' }}>
        <EmptyState
          icon={<CalendarX size={28} />}
          title="Нет записей в этом периоде"
          description="Переключите период или создайте запись — она появится здесь."
        />
      </div>
    );
  }

  const today = new Date();
  const groups = new Map<string, { date: Date; items: AppointmentData[] }>();
  for (const a of appointments) {
    const key = dayKey(a.starts_at);
    if (!groups.has(key)) groups.set(key, { date: new Date(a.starts_at), items: [] });
    groups.get(key)!.items.push(a);
  }
  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  const statusColor = (s: string) =>
    s === 'completed' ? C.success :
      s === 'cancelled' || s === 'no_show' ? C.danger :
        s === 'confirmed' ? C.accent : C.warning;

  return (
    <div style={{
      height: '100%', overflow: 'auto', background: C.bg,
      fontFamily: FONT, padding: '24px 36px 48px',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {sortedGroups.map(({ date, items }) => {
          const dayTotal = items.reduce((sum, a) => sum + (a.price || 0), 0);
          const currency = items[0]?.currency || 'UAH';
          return (
            <section key={dayKey(date.toISOString())}>
              <div
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  marginBottom: 10, padding: '0 4px',
                  cursor: onDayClick ? 'pointer' : 'default',
                }}
                onClick={() => onDayClick?.(date)}
              >
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.text,
                  letterSpacing: '-0.01em',
                }}>
                  {formatDayHeader(date, today)}
                </div>
                <div style={{ fontSize: 12, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                  {items.length} {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}
                  {' · '}
                  {dayTotal.toLocaleString('ru-RU')} {currency}
                </div>
              </div>

              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                {items.map((a, i) => {
                  const last = i === items.length - 1;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onAppointmentClick(a)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 1fr 120px 110px',
                        alignItems: 'center',
                        gap: 14,
                        width: '100%',
                        padding: '14px 18px',
                        borderBottom: last ? 'none' : `1px solid ${C.border}`,
                        background: 'transparent',
                        border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        textAlign: 'left', cursor: 'pointer',
                        fontFamily: FONT,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 14, fontWeight: 600, color: C.text,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        <Clock size={12} style={{ color: C.textTertiary }} />
                        {formatTime(a.starts_at)}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 550, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.client?.full_name || 'Без клиента'}
                        </div>
                        <div style={{
                          fontSize: 12, color: C.textTertiary, marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {a.service?.color && (
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: a.service.color, flexShrink: 0,
                            }} />
                          )}
                          {a.service?.name || 'Услуга не указана'}
                        </div>
                      </div>

                      <span style={{
                        fontSize: 11, fontWeight: 600, color: statusColor(a.status),
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>

                      <span style={{
                        fontSize: 14, fontWeight: 600, color: C.text,
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        {Number(a.price || 0).toLocaleString('ru-RU')} {a.currency || 'UAH'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
