/** --- YAML
 * name: Dashboard Overview
 * description: Fresha-exact dashboard — 2x3 card grid with sales chart, upcoming visits, appointments, follow-ups, popular services, top employee
 * --- */

'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { TelegramLinkCard } from '@/components/dashboard/telegram-link-card';
import { DashboardKpiStrip } from '@/components/dashboard/dashboard-kpi-strip';
import { format, subDays, addDays, startOfDay, endOfDay, startOfMonth, subMonths, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

/* ─── Fresha-exact color palettes ─── */
const LIGHT = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '0.8px solid #e0e0e0',
  text: '#0d0d0d',
  textSecondary: '#737373',
  textMuted: '#a3a3a3',
  accent: '#6950f3',
  linkPurple: '#6950f3',
  statusBlue: '#3b82f6',
  statusBlueBg: '#eff6ff',
  success: '#22c55e',
  successBg: '#f0fdf4',
  chartGreen: '#22c55e',
  chartPurple: '#8b5cf6',
  divider: '0.8px solid #e5e5e5',
  rowHover: '#f5f5f5',
  tableBorder: '0.8px solid #e5e5e5',
};

const DARK = {
  pageBg: '#131313',
  cardBg: '#181818',
  cardBorder: '0.8px solid #333333',
  text: '#f5f5f5',
  textSecondary: '#bfbfbf',
  textMuted: '#666666',
  accent: '#6950f3',
  linkPurple: '#8880ff',
  statusBlue: '#5791f0',
  statusBlueBg: '#0c2040',
  success: '#2c7016',
  successBg: '#0a2010',
  chartGreen: '#10b981',
  chartPurple: '#8b5cf6',
  divider: '0.8px solid #333333',
  rowHover: '#1f1f1f',
  tableBorder: '0.8px solid #333333',
};

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  service?: { name: string; color: string } | null;
  client?: { full_name: string } | null;
  master?: { full_name: string } | null;
}

export default function DashboardOverviewPage() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  const { master, loading: masterLoading } = useMaster();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Interactive state ── */
  const [salesPeriod, setSalesPeriod] = useState<7 | 30>(7);
  const [salesPopupOpen, setSalesPopupOpen] = useState(false);
  const [salesPendingPeriod, setSalesPendingPeriod] = useState<7 | 30>(7);

  const [visitsPeriod, setVisitsPeriod] = useState<7 | 30>(7);
  const [visitsPopupOpen, setVisitsPopupOpen] = useState(false);
  const [visitsPendingPeriod, setVisitsPendingPeriod] = useState<7 | 30>(7);

  const [chartTooltip, setChartTooltip] = useState<{
    x: number; y: number; date: string; sales: number; records: number;
  } | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (masterLoading) return;
    if (!master?.id) {
      setLoading(false);
      return;
    }
    async function fetchData() {
      const supabase = createClient();
      const sixtyDaysAgo = subDays(new Date(), 60);
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color), client:clients(full_name)')
        .eq('master_id', master!.id)
        .gte('starts_at', sixtyDaysAgo.toISOString())
        .lte('starts_at', sevenDaysFromNow.toISOString())
        .order('starts_at', { ascending: true });
      setAppointments((data as unknown as Appointment[]) || []);
      setLoading(false);
    }
    fetchData();
  }, [master?.id, masterLoading]);

  /* ── Computed data ── */
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  /* Sales chart data — dynamic period */
  const salesChart = useMemo(() => {
    const days: { label: string; dateNum: string; fullDate: string; sales: number; records: number }[] = [];
    for (let i = salesPeriod; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayAppts = appointments.filter(a => {
        const d = new Date(a.starts_at);
        return d >= dayStart && d <= dayEnd;
      });
      const completedAppts = dayAppts.filter(a => a.status === 'completed');
      days.push({
        label: format(day, 'EEE', { locale: dfLocale }).replace('.', ''),
        dateNum: format(day, 'd', { locale: dfLocale }),
        fullDate: format(day, 'EEEE, d MMM', { locale: dfLocale }),
        sales: completedAppts.reduce((s, a) => s + (a.price || 0), 0),
        records: dayAppts.filter(a => a.status !== 'cancelled').length,
      });
    }
    return days;
  }, [appointments, dfLocale, salesPeriod]);

  const totalSales7d = salesChart.reduce((s, d) => s + d.sales, 0);
  const totalRecords7d = salesChart.reduce((s, d) => s + d.records, 0);
  const totalVisitCost = appointments
    .filter(a => {
      const d = new Date(a.starts_at);
      return d >= subDays(now, salesPeriod) && a.status !== 'cancelled';
    })
    .reduce((s, a) => s + (a.price || 0), 0);

  /* Upcoming visits (next N days) */
  const upcomingVisits = useMemo(() => {
    const limit = addDays(now, visitsPeriod);
    return appointments
      .filter(a => {
        const d = new Date(a.starts_at);
        return d > now && d <= limit && a.status !== 'cancelled';
      })
      .slice(0, 8);
  }, [appointments, visitsPeriod]);

  /* Recent appointments (upcoming, for the Записи card) */
  const recentAppointments = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'cancelled')
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
      .slice(0, 5);
  }, [appointments]);

  /* Today's follow-up visits */
  const todayFollowUps = useMemo(() => {
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    return appointments.filter(a => {
      const d = new Date(a.starts_at);
      return d >= todayStart && d <= todayEnd && a.status !== 'cancelled';
    });
  }, [appointments]);

  /* Popular services */
  const popularServices = useMemo(() => {
    const thisMonthMap: Record<string, number> = {};
    const lastMonthMap: Record<string, number> = {};
    appointments.forEach(a => {
      if (a.status === 'cancelled' || !a.service?.name) return;
      const d = new Date(a.starts_at);
      if (d >= thisMonthStart) {
        thisMonthMap[a.service.name] = (thisMonthMap[a.service.name] || 0) + 1;
      } else if (d >= lastMonthStart && d < thisMonthStart) {
        lastMonthMap[a.service.name] = (lastMonthMap[a.service.name] || 0) + 1;
      }
    });
    const allNames = new Set([...Object.keys(thisMonthMap), ...Object.keys(lastMonthMap)]);
    return [...allNames]
      .map(name => ({ name, thisMonth: thisMonthMap[name] || 0, lastMonth: lastMonthMap[name] || 0 }))
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 5);
  }, [appointments, thisMonthStart, lastMonthStart]);

  /* Top employee revenue */
  const topEmployeeRevenue = useMemo(() => {
    return appointments
      .filter(a => new Date(a.starts_at) >= thisMonthStart && a.status === 'completed')
      .reduce((s, a) => s + (a.price || 0), 0);
  }, [appointments, thisMonthStart]);

  /* ── Chart hover handler (must be before any early returns to keep hook order stable) ── */
  const handleChartMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = chartRef.current;
    if (!svg || salesChart.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgWidth = rect.width;
    const cL = 50, cR = 520, viewBoxW = 570;
    const scale = svgWidth / viewBoxW;
    const chartMouseX = mouseX / scale;

    const xStep = salesChart.length > 1 ? (cR - cL) / (salesChart.length - 1) : 0;
    let closestIdx = 0;
    let closestDist = Infinity;
    salesChart.forEach((_, i) => {
      const cx = cL + i * xStep;
      const dist = Math.abs(chartMouseX - cx);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });

    if (closestDist < 30) {
      const d = salesChart[closestIdx];
      const cx = cL + closestIdx * xStep;
      setChartTooltip({ x: cx, y: 60, date: d.fullDate, sales: d.sales, records: d.records });
    } else {
      setChartTooltip(null);
    }
  }, [salesChart]);

  /* ── Loading state ── */
  if (masterLoading || loading) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 1184, margin: '0 auto', fontFamily: FONT }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      </div>
    );
  }

  /* ── Helpers ── */
  const currency = '₴';

  function formatStatusBadge(status: string) {
    const label = status === 'booked' || status === 'confirmed'
      ? t('booked')
      : status === 'completed'
        ? t('completed')
        : status === 'in_progress'
          ? t('inProgress')
          : status;
    return (
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: C.statusBlue,
        lineHeight: '16px',
      }}>
        {label}
      </span>
    );
  }

  function renderSalesChart() {
    const chartMaxSales = Math.max(...salesChart.map(d => d.sales), 1);
    const chartMaxRecords = Math.max(...salesChart.map(d => d.records), 1);
    const maxY = Math.max(chartMaxSales, 1);

    const cL = 50, cR = 520, cT = 10, cB = 170;
    const xStep = salesChart.length > 1 ? (cR - cL) / (salesChart.length - 1) : 0;

    const ySteps = 5;
    const yLabels = Array.from({ length: ySteps }, (_, i) =>
      Math.round(maxY * (1 - i / (ySteps - 1)))
    );

    const salesPts = salesChart.map((d, i) => {
      const x = cL + i * xStep;
      const y = maxY > 0 ? cB - ((d.sales / maxY) * (cB - cT)) : cB;
      return `${x},${y}`;
    }).join(' ');

    const recordsPts = salesChart.map((d, i) => {
      const x = cL + i * xStep;
      const y = chartMaxRecords > 0 ? cB - ((d.records / chartMaxRecords) * (cB - cT)) : cB;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg
        ref={chartRef}
        viewBox="0 0 570 220"
        style={{ width: '100%', height: 220, cursor: 'crosshair' }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleChartMouseMove}
        onMouseLeave={() => setChartTooltip(null)}
      >
        {/* Horizontal grid lines */}
        {Array.from({ length: ySteps }, (_, i) => {
          const y = cT + (i / (ySteps - 1)) * (cB - cT);
          return (
            <line key={i} x1={cL} y1={y} x2={cR} y2={y}
              stroke={C.textMuted} strokeWidth="0.5" opacity="0.3" />
          );
        })}
        {/* Vertical grid lines */}
        {salesChart.map((_, i) => {
          const x = cL + i * xStep;
          return (
            <line key={`v${i}`} x1={x} y1={cT} x2={x} y2={cB}
              stroke={C.textMuted} strokeWidth="0.5" opacity="0.3" />
          );
        })}
        {/* Y-axis labels */}
        {yLabels.map((label, i) => {
          const y = cT + (i / (ySteps - 1)) * (cB - cT);
          return (
            <text key={i} x={cL - 8} y={y + 4} textAnchor="end"
              fill={C.textSecondary} fontSize="11" fontFamily={FONT}>
              {label} {currency}
            </text>
          );
        })}
        {/* Sales line */}
        <polyline points={salesPts} fill="none" stroke={C.chartPurple}
          strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Records line */}
        <polyline points={recordsPts} fill="none" stroke={C.chartGreen}
          strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Data point dots — sales */}
        {salesChart.map((d, i) => {
          const x = cL + i * xStep;
          const y = maxY > 0 ? cB - ((d.sales / maxY) * (cB - cT)) : cB;
          return <circle key={`s${i}`} cx={x} cy={y} r="3.5" fill={C.chartPurple} />;
        })}
        {/* Data point dots — records */}
        {salesChart.map((d, i) => {
          const x = cL + i * xStep;
          const y = chartMaxRecords > 0 ? cB - ((d.records / chartMaxRecords) * (cB - cT)) : cB;
          return <circle key={`r${i}`} cx={x} cy={y} r="3.5" fill={C.chartGreen} />;
        })}
        {/* Hover vertical line */}
        {chartTooltip && (
          <line x1={chartTooltip.x} y1={cT} x2={chartTooltip.x} y2={cB}
            stroke={C.textSecondary} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        )}
        {/* X-axis labels */}
        {salesChart.map((d, i) => {
          const x = cL + i * xStep;
          return (
            <text key={i} x={x} y={cB + 18} textAnchor="middle"
              fill={C.textSecondary} fontSize="11" fontFamily={FONT}>
              {d.label} {d.dateNum}
            </text>
          );
        })}
        {/* Tooltip — rendered inside SVG as foreignObject */}
        {chartTooltip && (
          <foreignObject x={Math.max(0, chartTooltip.x - 90)} y={chartTooltip.y - 55} width="180" height="70">
            <div style={{
              backgroundColor: mounted && resolvedTheme === 'dark' ? '#000000' : '#ffffff',
              border: `1px solid ${mounted && resolvedTheme === 'dark' ? '#1a1a1a' : '#e0e0e0'}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              fontFamily: FONT,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              color: C.text,
              lineHeight: '16px',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{chartTooltip.date}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.chartPurple }} />
                {t('salesLabel')} {chartTooltip.sales.toLocaleString()} {currency}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.chartGreen }} />
                {t('recordsLabel')} {chartTooltip.records.toLocaleString()} {currency}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    );
  }

  /* ═══ Card style — Fresha exact ═══ */
  const cardStyle: React.CSSProperties = {
    backgroundColor: C.cardBg,
    borderRadius: 8,
    border: C.cardBorder,
    padding: 16,
    fontFamily: FONT,
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 600,
    color: C.text,
    lineHeight: '28px',
    margin: 0,
  };

  const cardSubtitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 400,
    color: C.textSecondary,
    lineHeight: '20px',
    marginTop: 0,
  };

  /* ═══ Helpers: dots menu & period popup (inline JSX, not components) ═══ */
  const dotsMenuStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    color: C.textSecondary, display: 'flex', alignItems: 'center',
  };

  function renderPeriodPopup(
    isOpen: boolean,
    pendingValue: 7 | 30,
    onPendingChange: (v: 7 | 30) => void,
    onApply: () => void,
    onClose: () => void,
    options: { value: 7 | 30; label: string }[],
  ) {
    if (!isOpen) return null;
    return (
      <motion.div
        key="period-popup"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'absolute',
          top: 56,
          right: 16,
          zIndex: 50,
          backgroundColor: C.cardBg,
          border: C.cardBorder,
          borderRadius: 8,
          padding: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          minWidth: 260,
          fontFamily: FONT,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          {t('timePeriod')}
        </div>
        <select
          value={pendingValue}
          onChange={(e) => onPendingChange(Number(e.target.value) as 7 | 30)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            fontFamily: FONT,
            border: C.cardBorder,
            borderRadius: 6,
            backgroundColor: C.cardBg,
            color: C.text,
            marginBottom: 16,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: FONT,
              border: C.cardBorder,
              borderRadius: 6,
              backgroundColor: 'transparent',
              color: C.text,
              cursor: 'pointer',
            }}
          >
            {t('close')}
          </button>
          <button
            type="button"
            onClick={onApply}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: FONT,
              border: 'none',
              borderRadius: 6,
              backgroundColor: C.accent,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('applyChanges')}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{
      fontFamily: FONT,
      backgroundColor: C.pageBg,
      minHeight: '100%',
      overflowY: 'auto',
    }}>
      <div style={{
        maxWidth: 1184,
        margin: '0 auto',
        padding: '32px 40px 96px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 32,
      }}>

        <div style={{ gridColumn: '1 / -1' }}>
          <DashboardKpiStrip
            masterId={master?.id ?? null}
            workingHours={(master?.working_hours as Record<string, { start: string; end: string } | null> | null) ?? null}
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        </div>
        <OnboardingChecklist master={master} theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'} />
        <TelegramLinkCard theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'} />

        {/* ═══ Card 1: Последние продажи (Recent Sales) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ ...cardStyle, position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={cardTitleStyle}>{t('recentSales')}</h3>
              <p style={cardSubtitleStyle}>{salesPeriod === 7 ? t('last7days') : t('last30days')}</p>
            </div>
            <button type="button" onClick={() => { setSalesPendingPeriod(salesPeriod); setSalesPopupOpen(true); }} style={dotsMenuStyle}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
            </button>
          </div>
          {renderPeriodPopup(
            salesPopupOpen,
            salesPendingPeriod,
            setSalesPendingPeriod,
            () => { setSalesPeriod(salesPendingPeriod); setSalesPopupOpen(false); },
            () => setSalesPopupOpen(false),
            [{ value: 7, label: t('lastNdays', { n: 7 }) }, { value: 30, label: t('lastNdays', { n: 30 }) }],
          )}

          {/* Big number */}
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: C.text,
            lineHeight: '36px',
            marginBottom: 8,
          }}>
            {totalSales7d.toLocaleString()} {currency}
          </div>

          {/* Stats row */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: C.text }}>{t('appointments')} </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{totalRecords7d}</span>
          </div>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: C.text }}>{t('visitCost')} </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{totalVisitCost.toLocaleString()} {currency}</span>
          </div>

          {/* Chart */}
          {renderSalesChart()}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.chartPurple }} />
              <span style={{ fontSize: 14, color: C.text }}>{t('salesLabel')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.chartGreen }} />
              <span style={{ fontSize: 14, color: C.text }}>{t('recordsLabel')}</span>
            </div>
          </div>
        </motion.div>

        {/* ═══ Card 2: Предстоящие визиты (Upcoming Visits) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ ...cardStyle, display: 'flex', flexDirection: 'column', position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={cardTitleStyle}>{t('upcomingVisits')}</h3>
              <p style={cardSubtitleStyle}>{visitsPeriod === 7 ? t('next7days') : t('next30days')}</p>
            </div>
            <button type="button" onClick={() => { setVisitsPendingPeriod(visitsPeriod); setVisitsPopupOpen(true); }} style={dotsMenuStyle}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
            </button>
          </div>
          {renderPeriodPopup(
            visitsPopupOpen,
            visitsPendingPeriod,
            setVisitsPendingPeriod,
            () => { setVisitsPeriod(visitsPendingPeriod); setVisitsPopupOpen(false); },
            () => setVisitsPopupOpen(false),
            [{ value: 7, label: t('nextNdays', { n: 7 }) }, { value: 30, label: t('nextNdays', { n: 30 }) }],
          )}

          {upcomingVisits.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
            }}>
              {/* Bar chart icon — Fresha style */}
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 20 }}>
                <rect x="8" y="28" width="6" height="12" rx="1" fill={C.text} opacity="0.6" />
                <rect x="17" y="20" width="6" height="20" rx="1" fill={C.text} opacity="0.6" />
                <rect x="26" y="12" width="6" height="28" rx="1" fill={C.text} opacity="0.6" />
                <rect x="35" y="24" width="6" height="16" rx="1" fill={C.text} opacity="0.6" />
              </svg>
              <div style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.text,
                textAlign: 'center',
                marginBottom: 12,
              }}>
                {t('emptySchedule')}
              </div>
              <div style={{
                fontSize: 15,
                color: C.textSecondary,
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: '22px',
              }}>
                {t('emptyScheduleDesc')}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {upcomingVisits.map((appt) => {
                const date = new Date(appt.starts_at);
                return (
                  <Link
                    key={appt.id}
                    href="/calendar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '12px 0',
                      borderBottom: C.divider,
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    {/* Date badge */}
                    <div style={{ textAlign: 'center', minWidth: 40 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: '24px' }}>
                        {format(date, 'd')}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: '16px' }}>
                        {format(date, 'MMM', { locale: dfLocale })}
                      </div>
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: '20px' }}>
                        {format(date, 'EEE, d MMM yyyy h:mma', { locale: dfLocale }).toLowerCase()}{' '}
                        {formatStatusBadge(appt.status)}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: '20px', marginTop: 2 }}>
                        {appt.service?.name || '—'}
                      </div>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: '20px', marginTop: 1 }}>
                        {appt.client?.full_name || '—'}, {(() => {
                          const start = new Date(appt.starts_at);
                          const end = new Date(appt.ends_at);
                          const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
                        })()} с {master?.profile?.full_name || '—'}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ═══ Card 3: Записи (Appointments) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ ...cardStyle, padding: '16px 0 0' }}
        >
          <div style={{ padding: '0 16px', marginBottom: 16 }}>
            <h3 style={cardTitleStyle}>{t('appointments')}</h3>
          </div>

          {recentAppointments.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, color: C.textSecondary }}>{t('noSalesDesc')}</div>
            </div>
          ) : (
            <div>
              {recentAppointments.map((appt) => {
                const date = new Date(appt.starts_at);
                return (
                  <Link
                    key={appt.id}
                    href={`/dashboard/drawer/appointment/${appt.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      padding: '16px 16px',
                      borderBottom: C.divider,
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    {/* Date badge */}
                    <div style={{
                      textAlign: 'center',
                      minWidth: 36,
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, lineHeight: '22px' }}>
                        {format(date, 'd')}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: '16px' }}>
                        {format(date, 'MMM', { locale: dfLocale })}
                      </div>
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, color: C.textSecondary, lineHeight: '20px' }}>
                          {format(date, 'EEE, d MMM yyyy', { locale: dfLocale })} {format(date, 'h:mma', { locale: dfLocale }).toLowerCase()}
                        </span>
                        {formatStatusBadge(appt.status)}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: '20px' }}>
                        {appt.service?.name || '—'}
                      </div>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: '20px', marginTop: 2 }}>
                        {appt.client?.full_name || '—'}, {(() => {
                          const start = new Date(appt.starts_at);
                          const end = new Date(appt.ends_at);
                          const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
                        })()} с {master?.profile?.full_name || '—'}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ═══ Card 4: Последующие визиты на сегодня (Today's Follow-up Visits) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}
        >
          <h3 style={{ ...cardTitleStyle, marginBottom: 0 }}>{t('todayUpcoming')}</h3>

          {todayFollowUps.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
            }}>
              {/* Calendar with clock icon */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ marginBottom: 20 }}>
                <rect x="6" y="10" width="34" height="32" rx="3" stroke={C.text} strokeWidth="2" fill="none" opacity="0.7" />
                <line x1="6" y1="18" x2="40" y2="18" stroke={C.text} strokeWidth="2" opacity="0.7" />
                <line x1="14" y1="10" x2="14" y2="6" stroke={C.text} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                <line x1="32" y1="10" x2="32" y2="6" stroke={C.text} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                <circle cx="40" cy="36" r="12" stroke={C.text} strokeWidth="2" fill={C.cardBg} opacity="0.7" />
                <line x1="40" y1="30" x2="40" y2="36" stroke={C.text} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                <line x1="40" y1="36" x2="45" y2="36" stroke={C.text} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              </svg>
              <div style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.text,
                textAlign: 'center',
                marginBottom: 12,
                lineHeight: '24px',
              }}>
                {t('noAppointmentsToday')}
              </div>
              <div style={{
                fontSize: 15,
                color: C.textSecondary,
                textAlign: 'center',
                lineHeight: '22px',
              }}>
                {t('goToCalendar').includes('алендарь') ? (
                  <>
                    Перейдите в раздел{' '}
                    <Link href="/calendar" style={{ color: C.linkPurple, textDecoration: 'none' }}>
                      {t('calendar').toLowerCase()}
                    </Link>
                    , чтобы добавить визиты
                  </>
                ) : (
                  <>
                    Go to{' '}
                    <Link href="/calendar" style={{ color: C.linkPurple, textDecoration: 'none' }}>
                      calendar
                    </Link>
                    {' '}to add visits
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, marginTop: 16 }}>
              {todayFollowUps.map((appt) => {
                const date = new Date(appt.starts_at);
                return (
                  <div key={appt.id} style={{
                    padding: '12px 0',
                    borderBottom: C.divider,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{ fontSize: 14, color: C.textSecondary, minWidth: 50 }}>
                      {format(date, 'HH:mm')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                        {appt.service?.name || '—'}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>
                        {appt.client?.full_name || '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ═══ Card 5: Популярные услуги (Popular Services) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={cardStyle}
        >
          <h3 style={{ ...cardTitleStyle, marginBottom: 20 }}>{t('popularServices')}</h3>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 120px',
            borderBottom: C.tableBorder,
            paddingBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary }}>{t('service')}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, textAlign: 'right' }}>{t('thisMonthCount')}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, textAlign: 'right' }}>{t('lastMonthCount')}</span>
          </div>

          {popularServices.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <span style={{ fontSize: 14, color: C.textSecondary }}>{t('noSalesDesc')}</span>
            </div>
          ) : (
            <div>
              {popularServices.map((s) => (
                <div key={s.name} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px',
                  padding: '14px 0',
                  borderBottom: C.tableBorder,
                }}>
                  <span style={{ fontSize: 14, color: C.text }}>{s.name}</span>
                  <span style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>{s.thisMonth}</span>
                  <span style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>{s.lastMonth}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ═══ Card 6: Лучший сотрудник (Top Employee) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}
        >
          <h3 style={{ ...cardTitleStyle, marginBottom: 0 }}>{t('topEmployee')}</h3>

          {topEmployeeRevenue === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
            }}>
              {/* Trending up icon */}
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 20 }}>
                <path d="M6 36L18 24L26 32L42 16" stroke={C.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                <path d="M32 16H42V26" stroke={C.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              </svg>
              <div style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.text,
                textAlign: 'center',
                marginBottom: 12,
              }}>
                {t('noSalesYet')}
              </div>
              <div style={{
                fontSize: 15,
                color: C.textSecondary,
                textAlign: 'center',
                maxWidth: 280,
                lineHeight: '22px',
              }}>
                {t('noSalesDesc')}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
              {/* Show master as top employee */}
              <div style={{
                width: 64, height: 64, borderRadius: 999,
                backgroundColor: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, color: '#fff',
                marginBottom: 12,
              }}>
                {(master?.profile?.full_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                {master?.profile?.full_name || '—'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>
                {topEmployeeRevenue.toLocaleString()} {currency}
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
