/** --- YAML
 * name: ReportsTab
 * description: Reports tab — 4 sub-tabs (Taxes / Lost Revenue / Forecast / Payments) extracted from reports page.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { type PageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import {
  Receipt, TrendingDown, TrendingUp, CreditCard, Download,
  AlertOctagon, Sparkles, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { format, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type Tab = 'taxes' | 'lost' | 'forecast' | 'payments';

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

interface MonthStat {
  key: string; year: number; month: number;
  revenue: number; tips: number; expenses: number; inventoryCost: number;
  net: number; tax: number; afterTax: number;
}

interface LostBucket { label: string; count: number; amount: number; hint: string; }

interface DayBucket {
  date: string; appointments: number; aptRevenue: number; subscriptions: number; total: number;
}

interface PaymentRow {
  id: string; amount: number; currency: string; type: string; status: string;
  payment_method: string | null; created_at: string;
  services: { name: string } | null;
}

export function ReportsTab({ C }: { C: PageTheme }) {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;

  const { master } = useMaster();
  const [activeTab, setActiveTab] = useState<Tab>('taxes');
  const [loading, setLoading] = useState(true);

  // Tax data
  const [months, setMonths] = useState<MonthStat[]>([]);
  const [taxRate, setTaxRate] = useState(5);

  // Lost revenue data
  const [lostBuckets, setLostBuckets] = useState<LostBucket[]>([]);
  const [topCancellers, setTopCancellers] = useState<{ name: string; count: number }[]>([]);

  // Forecast data
  const [forecastDays, setForecastDays] = useState<DayBucket[]>([]);

  // Payments data
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  // AI forecast
  const [aiForecast, setAiForecast] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  /* ─── Loaders ─── */

  const loadTaxes = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const rate = master.tax_rate_percent ?? 5;
    setTaxRate(rate);
    const now = new Date();
    const stats: MonthStat[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const [{ data: apts }, { data: exps }, { data: usage }] = await Promise.all([
        supabase.from('appointments')
          .select('id, tip_amount, payment:payments(amount)')
          .eq('master_id', master.id).eq('status', 'completed')
          .gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString()),
        supabase.from('expenses')
          .select('amount').eq('master_id', master.id)
          .gte('date', start.toISOString().slice(0, 10)).lte('date', end.toISOString().slice(0, 10)),
        supabase.from('inventory_usage')
          .select('quantity_used, item:inventory_items!inner(cost_per_unit, master_id)')
          .eq('item.master_id', master.id)
          .gte('recorded_at', start.toISOString()).lte('recorded_at', end.toISOString()),
      ]);

      let revenue = 0, tips = 0;
      for (const a of (apts ?? []) as unknown as { tip_amount: number | null; payment: { amount: number } | { amount: number }[] | null }[]) {
        const p = a.payment;
        const amt = Array.isArray(p) ? (p[0]?.amount ?? 0) : (p?.amount ?? 0);
        revenue += Number(amt);
        tips += Number(a.tip_amount ?? 0);
      }
      const expenses = (exps ?? []).reduce((a: number, e: any) => a + Number(e.amount ?? 0), 0);
      let inventoryCost = 0;
      for (const u of (usage ?? []) as unknown as { quantity_used: number; item: { cost_per_unit: number | null } | { cost_per_unit: number | null }[] | null }[]) {
        const item = Array.isArray(u.item) ? u.item[0] : u.item;
        inventoryCost += Number(u.quantity_used ?? 0) * Number(item?.cost_per_unit ?? 0);
      }
      const net = revenue - expenses - inventoryCost;
      const tax = net > 0 ? net * (rate / 100) : 0;
      stats.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        year: d.getFullYear(), month: d.getMonth() + 1,
        revenue, tips, expenses, inventoryCost, net, tax, afterTax: net - tax,
      });
    }
    setMonths(stats);
  }, [master?.id, master?.tax_rate_percent]);

  const loadLostRevenue = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [{ data: cancelled }, { data: noShows }, { data: waitlistRows }] = await Promise.all([
      supabase.from('appointments')
        .select('id, price, client:clients(full_name)')
        .eq('master_id', master.id)
        .in('status', ['cancelled', 'cancelled_by_client', 'cancelled_by_master'])
        .gte('starts_at', since),
      supabase.from('appointments')
        .select('id, price').eq('master_id', master.id).eq('status', 'no_show').gte('starts_at', since),
      supabase.from('waitlist')
        .select('id, service:services(price)').eq('master_id', master.id).gte('created_at', since),
    ]);

    const cancelledRows = ((cancelled ?? []) as unknown as { id: string; price: number; client: { full_name: string } | { full_name: string }[] | null }[])
      .map(r => ({ id: r.id, price: r.price, client: Array.isArray(r.client) ? r.client[0] ?? null : r.client }));
    const cancelledAmt = cancelledRows.reduce((a, r) => a + Number(r.price ?? 0), 0);
    const noShowAmt = (noShows ?? []).reduce((a: number, r: any) => a + Number(r.price ?? 0), 0);
    const waitlistAmt = ((waitlistRows ?? []) as unknown as { service: { price: number } | { price: number }[] | null }[])
      .reduce((a, r) => { const svc = Array.isArray(r.service) ? r.service[0] : r.service; return a + Number(svc?.price ?? 0); }, 0);

    setLostBuckets([
      { label: 'Отмены', count: cancelledRows.length, amount: cancelledAmt, hint: 'клиент отменил' },
      { label: 'No-show', count: (noShows ?? []).length, amount: noShowAmt, hint: 'не пришёл' },
      { label: 'Лист ожидания', count: (waitlistRows ?? []).length, amount: waitlistAmt, hint: 'не вписали' },
    ]);

    const counts = new Map<string, number>();
    for (const r of cancelledRows) {
      const name = r.client?.full_name ?? '—';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    setTopCancellers(
      Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count).slice(0, 5)
    );
  }, [master?.id]);

  const loadForecast = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 14);

    const empty: DayBucket[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      empty.push({ date: d.toISOString().slice(0, 10), appointments: 0, aptRevenue: 0, subscriptions: 0, total: 0 });
    }
    const byKey = new Map(empty.map(b => [b.date, b]));

    const { data: apts } = await supabase.from('appointments')
      .select('starts_at, price, status').eq('master_id', master.id)
      .in('status', ['confirmed', 'booked'])
      .gte('starts_at', today.toISOString()).lt('starts_at', horizon.toISOString());

    for (const a of (apts ?? []) as { starts_at: string; price: number | null }[]) {
      const b = byKey.get(a.starts_at.slice(0, 10));
      if (!b) continue;
      b.appointments += 1;
      b.aptRevenue += Number(a.price ?? 0);
    }

    for (const b of byKey.values()) b.total = b.aptRevenue + b.subscriptions;
    setForecastDays(Array.from(byKey.values()));
  }, [master?.id]);

  const loadPayments = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const { data } = await supabase.from('payments')
      .select('id, amount, currency, type, status, payment_method, created_at, services(name)')
      .gte('created_at', monthAgo).order('created_at', { ascending: false });

    setPayments((data as unknown as PaymentRow[]) || []);
  }, [master?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTaxes(), loadLostRevenue(), loadForecast(), loadPayments()])
      .finally(() => setLoading(false));
  }, [loadTaxes, loadLostRevenue, loadForecast, loadPayments]);

  // AI forecast
  const fetchAiForecast = useCallback(async () => {
    if (!master?.id || activeTab !== 'forecast') return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/finance/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'forecast', master_id: master.id }),
      });
      if (res.ok) { const { insight } = await res.json(); setAiForecast(insight); }
    } catch { /* optional */ }
    setAiLoading(false);
  }, [master?.id, activeTab]);

  useEffect(() => { fetchAiForecast(); }, [fetchAiForecast]);

  /* ─── Computed ─── */
  const taxTotals = useMemo(() => months.reduce(
    (acc, m) => ({ revenue: acc.revenue + m.revenue, tips: acc.tips + m.tips, expenses: acc.expenses + m.expenses, inventoryCost: acc.inventoryCost + m.inventoryCost, net: acc.net + m.net, tax: acc.tax + m.tax }),
    { revenue: 0, tips: 0, expenses: 0, inventoryCost: 0, net: 0, tax: 0 }
  ), [months]);

  const lostTotal = lostBuckets.reduce((a, b) => a + b.amount, 0);
  const forecastTotals = useMemo(() => ({
    sum: forecastDays.reduce((a, b) => a + b.total, 0),
    visits: forecastDays.reduce((a, b) => a + b.appointments, 0),
    maxDay: Math.max(0, ...forecastDays.map(b => b.total)),
  }), [forecastDays]);

  const isDark = C.bg !== '#ffffff' && C.bg !== '#fff' && C.bg !== 'white';

  // Simplified to just Taxes — lost/forecast/payments removed as unclear-purpose reports
  // per user feedback. Taxes provides concrete tax obligation + CSV export.
  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: 'taxes', label: 'Налоги', icon: Receipt },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text }}>Отчёты</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>Налоги, потери, прогнозы и платежи.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${C.border}`, marginBottom: 24 }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: FONT,
                color: activeTab === tab.key ? C.accent : C.textTertiary,
                borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: C.textSecondary }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          Загрузка...
        </div>
      )}

      {!loading && (
        <AnimatePresence mode="wait">
          {/* === TAXES TAB === */}
          {activeTab === 'taxes' && (
            <motion.div key="taxes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
                Ставка: {taxRate}%. Последние 6 месяцев.
              </p>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Выручка', value: taxTotals.revenue },
                  { label: 'Чаевые', value: taxTotals.tips, color: C.success },
                  { label: 'Расходы', value: taxTotals.expenses },
                  { label: 'Себестоимость', value: taxTotals.inventoryCost },
                  { label: 'Чистая прибыль', value: taxTotals.net, color: taxTotals.net > 0 ? C.success : C.danger },
                  { label: `Налог ${taxRate}%`, value: taxTotals.tax },
                ].map((s, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: s.color || C.text }}>{s.value.toFixed(0)} {CURRENCY}</div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Месяц', 'Выручка', 'Чай', 'Расходы', 'Себест.', 'Прибыль', 'Налог', 'После нал.', ''].map((h, i) => (
                        <th key={i} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(m => (
                      <tr key={m.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: C.text }}>{MONTHS_RU[m.month - 1]} {m.year}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.text }}>{m.revenue.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.success }}>{m.tips.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.textTertiary }}>{m.expenses.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.textTertiary }}>{m.inventoryCost.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: m.net < 0 ? C.danger : C.text }}>{m.net.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.text }}>{m.tax.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>{m.afterTax.toFixed(0)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => window.open(`/api/reports/monthly?year=${m.year}&month=${m.month}`, '_blank')}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                              background: 'transparent', color: C.textTertiary, fontSize: 11, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Download size={12} /> CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* === LOST REVENUE TAB === */}
          {activeTab === 'lost' && (
            <motion.div key="lost" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>За последние 30 дней.</p>

              {/* Total lost */}
              <div style={{
                background: C.dangerSoft, border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
                borderRadius: 12, padding: '20px 24px', marginBottom: 24,
              }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: C.danger, fontWeight: 600 }}>Итого упущено</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.danger, marginTop: 4 }}>{lostTotal.toFixed(0)} {CURRENCY}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {lostBuckets.map(b => (
                  <div key={b.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, color: C.textSecondary }}>{b.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{b.amount.toFixed(0)} {CURRENCY}</div>
                    <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>{b.count} &middot; {b.hint}</div>
                  </div>
                ))}
              </div>

              {topCancellers.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <AlertOctagon size={14} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Кто отменяет чаще</span>
                  </div>
                  <div style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {topCancellers.map((c, i) => (
                          <tr key={i} style={{ borderBottom: i < topCancellers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: C.text }}>{c.name}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: C.textTertiary }}>{c.count} отмен</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* === FORECAST TAB === */}
          {activeTab === 'forecast' && (
            <motion.div key="forecast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
                14-дневный прогноз по подтверждённым визитам.
              </p>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: C.textSecondary }}>К поступлению</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: C.success }}>{forecastTotals.sum.toFixed(0)} {CURRENCY}</div>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: C.textSecondary }}>Ожидаемые визиты</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{forecastTotals.visits}</div>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: C.textSecondary }}>Пиковый день</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{forecastTotals.maxDay.toFixed(0)} {CURRENCY}</div>
                </div>
              </div>

              {/* Bar chart */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ display: 'flex', height: 120, alignItems: 'flex-end', gap: 4 }}>
                  {forecastDays.map(b => {
                    const h = forecastTotals.maxDay > 0 ? (b.total / forecastTotals.maxDay) * 100 : 0;
                    return (
                      <div key={b.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          style={{
                            width: '100%', borderRadius: '4px 4px 0 0',
                            background: C.accent, height: `${h}%`,
                            minHeight: b.total > 0 ? 3 : 0, transition: 'height 0.3s ease',
                          }}
                          title={`${b.date}: ${b.total.toFixed(0)} ${CURRENCY}`}
                        />
                        <span style={{ fontSize: 9, color: C.textSecondary }}>{new Date(b.date).getDate()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: C.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Дата', 'Визиты', 'От визитов', 'Итого'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forecastDays.map(b => (
                      <tr key={b.date} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: C.text }}>
                          {new Date(b.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: C.textTertiary }}>{b.appointments || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: C.text }}>{b.aptRevenue ? b.aptRevenue.toFixed(0) : '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>{b.total ? b.total.toFixed(0) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Forecast */}
              <div style={{
                background: C.aiGradient, border: `1px solid ${C.aiBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Sparkles size={14} style={{ color: C.accent }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>AI-прогноз</span>
                  {aiLoading && <Loader2 size={14} className="animate-spin" style={{ color: C.accent }} />}
                </div>
                <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  {aiForecast || (aiLoading ? 'Генерируем прогноз...' : 'Прогноз станет доступен после накопления данных.')}
                </p>
              </div>
            </motion.div>
          )}

          {/* === PAYMENTS TAB === */}
          {activeTab === 'payments' && (
            <motion.div key="payments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Все транзакции за последние 30 дней.</p>

              {payments.length === 0 ? (
                <div style={{
                  background: C.surface, borderRadius: 12, padding: '60px 20px',
                  textAlign: 'center',
                }}>
                  <CreditCard size={32} style={{ color: C.accent, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Нет транзакций</p>
                </div>
              ) : (
                <div style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>ID</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Услуга</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Тип</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Метод</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Дата</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Сумма</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: C.textTertiary }}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 16px', fontSize: 13, color: C.accent, fontWeight: 500 }}>
                            #{p.id.slice(0, 7).toUpperCase()}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: C.text }}>{p.services?.name || '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: C.textTertiary }}>{p.type}</td>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: C.textTertiary }}>{p.payment_method || '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 13, color: C.textTertiary }}>
                            {format(new Date(p.created_at), 'd MMM HH:mm', { locale: dfLocale })}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>
                            {Number(p.amount).toLocaleString()} {p.currency}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                              background: p.status === 'completed' ? C.successSoft : C.dangerSoft,
                              color: p.status === 'completed' ? C.success : C.danger,
                            }}>
                              {p.status === 'completed' ? 'Завершён' : p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
