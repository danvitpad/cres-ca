/** --- YAML
 * name: BreakdownDonut
 * description: Category breakdown donut with center total + hover tooltip + legend with %. Built on recharts Pie. Used in /dashboard for revenue-by-service and expense-by-category.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import type { PageTheme } from '@/lib/dashboard-theme';
import { FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  slices: DonutSlice[];
  emptyText?: string;
  C: PageTheme;
  isDark: boolean;
}

export function BreakdownDonut({ title, subtitle, icon, slices, emptyText, C, isDark }: Props) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  const cardStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 22,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 320,
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={cardStyle}
    >
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{
          fontSize: 15, fontWeight: 650, color: C.text, margin: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {icon}
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 12, color: C.textTertiary, margin: '3px 0 0' }}>{subtitle}</p>
        )}
      </div>

      {slices.length === 0 || total === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.textTertiary, fontSize: 13,
        }}>
          {emptyText || 'Нет данных'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 20,
          alignItems: 'center',
          flex: 1,
        }}>
          {/* Donut with center total */}
          <div style={{ position: 'relative', width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                  stroke="none"
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <RTooltip
                  cursor={false}
                  contentStyle={{
                    background: isDark ? '#0f1011' : '#ffffff',
                    border: `1px solid ${C.borderStrong}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontFamily: FONT,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const n = Number(value);
                    const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0';
                    return [`${fmt(n)} ${CURRENCY} · ${pct}%`, name];
                  }}
                  labelStyle={{ display: 'none' }}
                  itemStyle={{ color: C.text, padding: 0 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total label */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 10, color: C.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Всего
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: C.text,
                fontVariantNumeric: 'tabular-nums', marginTop: 2,
              }}>
                {fmt(total)}
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>
                {CURRENCY}
              </div>
            </div>
          </div>

          {/* Legend with percentages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
            {slices.slice(0, 6).map((s) => {
              const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
              return (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, minWidth: 0,
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: s.color, flexShrink: 0,
                  }} />
                  <span style={{
                    color: C.textSecondary, flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                  <span style={{
                    color: C.text, fontWeight: 600, flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
