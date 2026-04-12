/** --- YAML
 * name: DailySalesPage
 * description: Fresha-exact daily sales report — transaction summary, cash flow summary, date navigation, mini week trend
 * --- */

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Plus, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { format, subDays, startOfDay, endOfDay, addDays, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

const LIGHT = {
  bg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e5e5',
  text: '#0d0d0d', textMuted: '#737373', textLight: '#a3a3a3',
  accent: '#6950f3', accentSoft: '#f0f0ff',
  success: '#10b981', danger: '#d4163a',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#2a2a2a', tableHeaderBg: '#111111',
  rowHover: '#111111', divider: '#2a2a2a',
  chartLine: '#6950f3', chartDot: '#6950f3',
};

const DARK = {
  bg: '#000000', cardBg: '#000000', cardBorder: '#1a1a1a',
  text: '#f0f0f0', textMuted: '#b3b3b3', textLight: '#666666',
  accent: '#8b7cf6', accentSoft: 'rgba(105,80,243,0.15)',
  success: '#34d399', danger: '#ef4444',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#1a1a1a', tableHeaderBg: '#000000',
  rowHover: '#0a0a0a', divider: '#1a1a1a',
  chartLine: '#8b7cf6', chartDot: '#8b7cf6',
};

interface DayData {
  sales: number;
  returns: number;
  total: number;
  serviceCount: number;
  productCount: number;
}

export default function DailySalesPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  const { master } = useMaster();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayData, setDayData] = useState<DayData>({ sales: 0, returns: 0, total: 0, serviceCount: 0, productCount: 0 });
  const [weekData, setWeekData] = useState<{ label: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const isToday = useMemo(() => {
    const now = new Date();
    return selectedDate.toDateString() === now.toDateString();
  }, [selectedDate]);

  const dateLabel = useMemo(() => {
    return format(selectedDate, 'EEEE d MMM, yyyy', { locale: dfLocale });
  }, [selectedDate, dfLocale]);

  const loadDayData = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    const { data: payments } = await supabase
      .from('payments')
      .select('amount, type, status')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .eq('status', 'completed');

    const completed = payments || [];
    const salesTotal = completed.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0);
    const returnsTotal = completed.filter(p => p.type === 'refund').reduce((s, p) => s + Number(p.amount), 0);

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, status, price')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)
      .eq('status', 'completed');

    setDayData({
      sales: completed.filter(p => p.type !== 'refund').length,
      returns: completed.filter(p => p.type === 'refund').length,
      total: salesTotal - returnsTotal,
      serviceCount: (appts || []).length,
      productCount: 0,
    });

    // Week trend
    const weekDays: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(selectedDate, i);
      const ds = startOfDay(day).toISOString();
      const de = endOfDay(day).toISOString();
      const { data: dp } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', ds)
        .lte('created_at', de)
        .eq('status', 'completed');
      weekDays.push({
        label: format(day, 'EEE', { locale: dfLocale }),
        total: (dp || []).reduce((s, p) => s + Number(p.amount), 0),
      });
    }
    setWeekData(weekDays);
    setLoading(false);
  }, [master?.id, selectedDate, dfLocale]);

  useEffect(() => { loadDayData(); }, [loadDayData]);

  const transactionRows = [
    { label: t('services'), sales: dayData.serviceCount, returns: 0, total: dayData.total },
    { label: t('additionalServices'), sales: 0, returns: 0, total: 0 },
    { label: t('products'), sales: dayData.productCount, returns: 0, total: 0 },
    { label: t('shipping'), sales: 0, returns: 0, total: 0 },
    { label: t('giftCardsType'), sales: 0, returns: 0, total: 0 },
    { label: t('subscriptions'), sales: 0, returns: 0, total: 0 },
    { label: t('giftToClient'), sales: 0, returns: 0, total: 0 },
  ];

  const cashFlowRows = [
    { label: t('cash'), collected: 0, refunded: 0 },
    { label: t('other'), collected: 0, refunded: 0 },
    { label: t('giftCardRedemption'), collected: 0, refunded: 0 },
    { label: t('collectedPayments'), collected: dayData.total, refunded: 0 },
    { label: t('ofWhichTips'), collected: 0, refunded: 0 },
  ];

  const weekMax = Math.max(...weekData.map(d => d.total), 1);

  // Mini SVG chart
  const chartW = 280;
  const chartH = 48;
  const chartPad = 4;
  const points = weekData.map((d, i) => ({
    x: chartPad + (i / Math.max(weekData.length - 1, 1)) * (chartW - chartPad * 2),
    y: chartPad + (1 - d.total / weekMax) * (chartH - chartPad * 2),
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ fontFamily: FONT, color: C.text, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('dailySales')}</h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>{t('dailySalesDesc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.cardBorder}`,
              background: C.cardBg, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Download size={14} />
            {t('export')}
          </button>
          <button
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} />
            {t('add')}
          </button>
        </div>
      </div>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => setSelectedDate(d => subDays(d, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, padding: 4 }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => setSelectedDate(new Date())}
          style={{
            padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.accent}`,
            background: isToday ? C.accent : 'transparent', color: isToday ? '#fff' : C.accent,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {t('today')}
        </button>
        <button
          onClick={() => setSelectedDate(d => addDays(d, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text, padding: 4 }}
        >
          <ChevronRight size={20} />
        </button>
        <span style={{ fontSize: 14, color: C.textMuted, textTransform: 'capitalize' }}>{dateLabel}</span>
      </div>

      {/* Week trend mini chart */}
      {weekData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
            padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={12} />
              {t('weekTrend')}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {dayData.total.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>UAH</span>
            </div>
          </div>
          <svg width={chartW} height={chartH} style={{ flexShrink: 0 }}>
            {points.length > 1 && (
              <>
                <polyline
                  points={polyline}
                  fill="none"
                  stroke={C.chartLine}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill={C.chartDot} />
                ))}
              </>
            )}
          </svg>
          <div style={{ display: 'flex', gap: 8 }}>
            {weekData.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, color: C.textMuted }}>
                {d.label}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Two tables side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Transaction summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ background: C.tableBg, borderRadius: 12, overflow: 'hidden' }}
        >
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tableBorder}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.tableText, margin: 0 }}>{t('transactionSummary')}</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('positionType')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('salesCount')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('returnsCount')}</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('totalAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < transactionRows.length - 1 ? `1px solid ${C.tableBorder}` : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: C.tableText }}>{row.label}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.tableText }}>{row.sales}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.tableText }}>{row.returns}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: C.tableText }}>{row.total.toFixed(3)} UAH</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Cash flow summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ background: C.tableBg, borderRadius: 12, overflow: 'hidden' }}
        >
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tableBorder}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.tableText, margin: 0 }}>{t('cashFlowSummary')}</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('paymentType')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('collected')}</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>{t('refunded')}</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < cashFlowRows.length - 1 ? `1px solid ${C.tableBorder}` : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: C.tableText }}>{row.label}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.tableText }}>{row.collected.toFixed(3)} UAH</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: C.tableText }}>{row.refunded.toFixed(3)} UAH</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
