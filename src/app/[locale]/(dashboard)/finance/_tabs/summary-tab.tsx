/** --- YAML
 * name: SummaryTab
 * description: Finance Сводка — 3 inner sub-tabs (Обзор / Доходы / Расходы) + period selector at top.
 *              Обзор: KPI + AI-insight + last appointments + top services.
 *              Доходы: payments table. Расходы: CRUD + table.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, Plus, Trash2,
  ArrowUpRight, ArrowDownRight,
  LayoutDashboard, TrendingUp, Receipt,
  Calendar as CalendarIcon, Trophy,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { toast } from 'sonner';
import { FONT, FONT_FEATURES, CURRENCY, KPI_GRADIENTS, type PageTheme } from '@/lib/dashboard-theme';
import {
  format, startOfDay, endOfDay, startOfWeek, startOfMonth,
  startOfQuarter, startOfYear, subMonths,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type Period = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'День', week: 'Неделя', month: 'Месяц',
  quarter: 'Квартал', half: 'Полгода', year: 'Год', all: 'Всё время',
};

/** Russian plural for "запись/записи/записей" */
function pluralRecord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'запись';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи';
  return 'записей';
}

function periodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  const to = endOfDay(now);
  switch (period) {
    case 'day': return { from: startOfDay(now), to };
    case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to };
    case 'month': return { from: startOfMonth(now), to };
    case 'quarter': return { from: startOfQuarter(now), to };
    case 'half': return { from: subMonths(startOfMonth(now), 5), to };
    case 'year': return { from: startOfYear(now), to };
    case 'all': return { from: new Date('2020-01-01'), to };
  }
}

function prevPeriodRange(period: Period): { from: Date; to: Date } {
  const { from, to } = periodRange(period);
  const ms = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - ms), to: new Date(from.getTime() - 1) };
}

type SubTab = 'overview' | 'income' | 'expenses';
const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

interface PaymentRow {
  id: string; amount: number; currency: string; type: string;
  payment_method: string | null; created_at: string;
  services: { name: string } | null;
  appointment: { client: { full_name: string } | null } | null;
}

interface ExpenseRow {
  id: string; date: string; amount: number; currency: string;
  category: string | null; description: string | null; vendor: string | null;
}

interface AppointmentRow {
  id: string; starts_at: string; status: string;
  services: { name: string } | null;
  clients: { full_name: string } | null;
}

interface TopServiceRow {
  name: string;
  total: number;
  count: number;
}

export function SummaryTab({ C, isDark, period, setPeriod }: {
  C: PageTheme; isDark: boolean;
  period: Period; setPeriod: (p: Period) => void;
}) {
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { master } = useMaster();
  const [activeTab, setActiveTab] = useState<SubTab>('overview');

  const [revenue, setRevenue] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevExpenseTotal, setPrevExpenseTotal] = useState(0);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [lastAppointments, setLastAppointments] = useState<AppointmentRow[]>([]);
  const [topServices, setTopServices] = useState<TopServiceRow[]>([]);

  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Расходники');
  const [expVendor, setExpVendor] = useState('');

  // Manual income entry (payments not tied to an appointment)
  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState('cash');
  const [incNote, setIncNote] = useState('');

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { from, to } = periodRange(period);
    const prev = prevPeriodRange(period);

    const [curP, curE, prevP, prevE, allPayments, allExpenses, apts] = await Promise.all([
      supabase.from('payments').select('amount, type')
        .eq('master_id', master.id).eq('status', 'completed')
        .gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
      supabase.from('expenses').select('amount')
        .eq('master_id', master.id)
        .gte('date', from.toISOString().slice(0, 10)).lte('date', to.toISOString().slice(0, 10)),
      supabase.from('payments').select('amount, type')
        .eq('master_id', master.id).eq('status', 'completed')
        .gte('created_at', prev.from.toISOString()).lte('created_at', prev.to.toISOString()),
      supabase.from('expenses').select('amount')
        .eq('master_id', master.id)
        .gte('date', prev.from.toISOString().slice(0, 10)).lte('date', prev.to.toISOString().slice(0, 10)),
      supabase.from('payments').select('id, amount, currency, type, payment_method, created_at, services(name), appointment:appointments(client:clients(full_name))')
        .eq('master_id', master.id).eq('status', 'completed')
        .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('expenses').select('id, date, amount, currency, category, description, vendor')
        .eq('master_id', master.id)
        .gte('date', from.toISOString().slice(0, 10)).lte('date', to.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      // Last 5 appointments in period
      supabase.from('appointments').select('id, starts_at, status, services(name), clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString())
        .order('starts_at', { ascending: false }).limit(5),
    ]);

    const cp = (curP.data || []) as { amount: number; type: string }[];
    setRevenue(cp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));
    setExpenseTotal((curE.data || []).reduce((s, e: any) => s + Number(e.amount), 0)); // eslint-disable-line @typescript-eslint/no-explicit-any

    const pp = (prevP.data || []) as { amount: number; type: string }[];
    setPrevRevenue(pp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));
    setPrevExpenseTotal((prevE.data || []).reduce((s, e: any) => s + Number(e.amount), 0)); // eslint-disable-line @typescript-eslint/no-explicit-any

    const paymentsData = (allPayments.data as unknown as PaymentRow[]) || [];
    setPayments(paymentsData);
    setExpenses((allExpenses.data ?? []) as ExpenseRow[]);
    setLastAppointments((apts.data as unknown as AppointmentRow[]) || []);

    // Compute top services from paymentsData
    const svcMap = new Map<string, { total: number; count: number }>();
    paymentsData.forEach(p => {
      if (p.type === 'refund') return;
      const name = p.services?.name || 'Без услуги';
      const entry = svcMap.get(name) || { total: 0, count: 0 };
      entry.total += Number(p.amount);
      entry.count += 1;
      svcMap.set(name, entry);
    });
    const top = Array.from(svcMap.entries())
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    setTopServices(top);
  }, [master?.id, period]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const ch1 = supabase
      .channel(`fin_p_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `master_id=eq.${master.id}` }, () => loadData())
      .subscribe();
    const ch2 = supabase
      .channel(`fin_e_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `master_id=eq.${master.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [master?.id, loadData]);

  const fetchAiInsight = useCallback(async () => {
    if (!master?.id) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/finance/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'period_summary', master_id: master.id, period }),
      });
      if (res.ok) {
        const { insight } = await res.json();
        const cleaned = insight?.trim() || null;
        // Previously we filtered out "generic" AI replies, which made the whole
        // banner flash on and then disappear. Now we always show whatever the
        // backend returns (or a fallback below in render).
        setAiInsight(cleaned);
      } else {
        setAiInsight(null);
      }
    } catch {
      setAiInsight(null);
    }
    setAiLoading(false);
  }, [master?.id, period]);

  useEffect(() => { fetchAiInsight(); }, [fetchAiInsight]);

  async function addExpense() {
    if (!master?.id || !expAmount) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        master_id: master.id,
        date: new Date().toISOString().slice(0, 10),
        amount: Number(expAmount),
        currency: 'UAH',
        category: expCategory,
        description: [expCategory, expVendor].filter(Boolean).join(' — '),
        vendor: expVendor || null,
      })
      .select('id, date, amount, currency, category, description, vendor')
      .single();
    if (error) { toast.error(error.message); return; }
    setExpenses(prev => [data as ExpenseRow, ...prev]);
    setExpenseTotal(prev => prev + Number(expAmount));
    setExpAmount('');
    setExpVendor('');
    toast.success('Расход добавлен');
  }

  async function removeExpense(id: string, amount: number) {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setExpenseTotal(prev => prev - amount);
    toast.success('Удалено');
  }

  async function addManualIncome() {
    if (!master?.id || !incAmount) return;
    const amt = Number(incAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Введите сумму'); return; }
    const supabase = createClient();
    const { data, error } = await supabase
      .from('payments')
      .insert({
        master_id: master.id,
        amount: amt,
        currency: 'UAH',
        type: 'manual',
        payment_method: incMethod,
        status: 'completed',
        notes: incNote || null,
      })
      .select('id, amount, currency, type, payment_method, created_at, services(name), appointment:appointments(client:clients(full_name))')
      .single();
    if (error) { toast.error(error.message); return; }
    setPayments(prev => [data as unknown as PaymentRow, ...prev]);
    setRevenue(prev => prev + amt);
    setIncAmount('');
    setIncNote('');
    toast.success('Доход добавлен');
  }

  const netProfit = revenue - expenseTotal;
  const prevNet = prevRevenue - prevExpenseTotal;

  function pctChange(cur: number, prev: number): number | null {
    if (cur === prev) return 0;
    if (prev === 0) return null;
    return Math.round(((cur - prev) / Math.abs(prev)) * 100);
  }

  const revChange = pctChange(revenue, prevRevenue);
  const netChange = pctChange(netProfit, prevNet);
  const expensesListTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const inputStyle = {
    padding: '8px 10px', borderRadius: 6,
    border: `1px solid ${C.border}`, background: 'transparent',
    color: C.text, fontSize: 13, fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES, outline: 'none',
  };

  const SUB_TABS: { key: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: 'overview', label: 'Обзор',  icon: LayoutDashboard },
    { key: 'income',   label: 'Доходы', icon: TrendingUp },
    { key: 'expenses', label: 'Расходы', icon: Receipt },
  ];

  const periods: Period[] = ['day', 'week', 'month', 'quarter', 'half', 'year', 'all'];

  return (
    <>
      {/* Period selector pills */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        marginBottom: 20,
      }}>
        {periods.map(p => {
          const active = p === period;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: active ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                background: active ? C.accentSoft : 'transparent',
                color: active ? C.accent : C.textSecondary,
                fontSize: 12, fontWeight: active ? 600 : 500,
                fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* Sub-tabs bar */}
      <div style={{
        display: 'inline-flex', gap: 2,
        background: C.surfaceElevated,
        borderRadius: 10, padding: 3, marginBottom: 22,
      }}>
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: 'none',
                background: active ? C.surface : 'transparent',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 550, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                color: active ? C.text : C.textTertiary,
                borderRadius: 7,
                transition: 'all 0.15s ease',
                boxShadow: active
                  ? (isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)')
                  : 'none',
              }}
            >
              <Icon size={14} style={{ opacity: active ? 1 : 0.65 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {/* AI Insight — always visible (was hiding when insight came back null, causing flicker) */}
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                background: C.aiGradient,
                border: `1px solid ${C.aiBorder}`,
                borderRadius: 14, padding: '18px 22px', marginBottom: 24,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={14} style={{ color: C.accent }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  AI-помощник
                </span>
                {aiLoading && <Loader2 size={13} className="animate-spin" style={{ color: C.accent }} />}
              </div>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, margin: 0 }}>
                {aiLoading
                  ? 'Анализирую ваши данные...'
                  : aiInsight
                    ? aiInsight
                    : 'Пока нечего прокомментировать — добавьте больше записей или расходов, и помощник даст рекомендации.'}
              </p>
            </motion.div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Доход', value: revenue, change: revChange, showChange: true, gradient: KPI_GRADIENTS.revenue },
                { label: 'Расходы', value: expenseTotal, extra: expenses.length > 0 ? `${expenses.length} ${pluralRecord(expenses.length)}` : undefined, gradient: KPI_GRADIENTS.expenses },
                { label: 'Чистая прибыль', value: netProfit, change: netChange, showChange: true, danger: netProfit < 0, gradient: KPI_GRADIENTS.profit },
              ].map((card, idx) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{
                    background: card.gradient,
                    borderRadius: 16,
                    padding: '22px 24px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isDark
                      ? '0 4px 20px rgba(0,0,0,0.3)'
                      : '0 4px 20px rgba(124,58,237,0.1)',
                  }}
                >
                  <div style={{
                    position: 'absolute', right: -20, top: -20,
                    width: 100, height: 100, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                  }} />
                  <div style={{
                    position: 'absolute', right: 20, bottom: -30,
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                  }} />
                  <div style={{
                    fontSize: 12, fontWeight: 510, color: 'rgba(255,255,255,0.75)',
                    marginBottom: 10, letterSpacing: '0.03em', textTransform: 'uppercase',
                  }}>
                    {card.label}
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 650, letterSpacing: '-0.5px', marginBottom: 8,
                    color: '#ffffff',
                  }}>
                    {loading ? '—' : (
                      <>
                        {card.value.toLocaleString()}
                        <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.6, marginLeft: 2 }}>{CURRENCY}</span>
                      </>
                    )}
                  </div>
                  {!loading && card.showChange && card.change !== null && card.change !== undefined && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 550,
                      background: 'rgba(255,255,255,0.18)',
                      padding: '3px 8px', borderRadius: 6,
                      color: '#ffffff',
                    }}>
                      {card.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {card.change >= 0 ? '+' : ''}{card.change}%
                      <span style={{ opacity: 0.6, fontWeight: 400 }}>к прошлому периоду</span>
                    </div>
                  )}
                  {!loading && card.showChange && card.change === null && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
                    }}>
                      первый период — нет предыдущих данных
                    </div>
                  )}
                  {!loading && card.extra && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{card.extra}</div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Two-column: Top services + Last appointments */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 18, marginBottom: 12,
            }}>
              {/* Top services */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trophy size={16} style={{ color: C.accent }} />
                  <h3 style={{
                    fontSize: 14, fontWeight: 600, color: C.text,
                    margin: 0, letterSpacing: '-0.1px',
                  }}>
                    Топ услуги
                  </h3>
                </div>
                {topServices.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>
                    Нет продаж за период
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topServices.map((s, i) => {
                      const medals = ['#f59e0b', '#94a3b8', '#b45309'];
                      return (
                        <div key={s.name} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px',
                          background: i === 0 ? C.accentSoft : 'transparent',
                          border: `1px solid ${i === 0 ? C.aiBorder : C.border}`,
                          borderRadius: 10,
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: medals[i],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                            flexShrink: 0,
                          }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 13, fontWeight: 550, color: C.text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                              {s.count} {s.count === 1 ? 'продажа' : 'продаж'}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: C.success,
                            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                          }}>
                            {s.total.toLocaleString()} {CURRENCY}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Last appointments */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <CalendarIcon size={16} style={{ color: C.accent }} />
                  <h3 style={{
                    fontSize: 14, fontWeight: 600, color: C.text,
                    margin: 0, letterSpacing: '-0.1px',
                  }}>
                    Последние записи
                  </h3>
                </div>
                {lastAppointments.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>
                    Нет записей за период
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {lastAppointments.map((a, i) => {
                      const d = new Date(a.starts_at);
                      const dateStr = format(d, 'd MMM, HH:mm', { locale: dfLocale });
                      const statusColor =
                        a.status === 'completed' ? C.success :
                        a.status === 'cancelled' ? C.danger :
                        a.status === 'no_show'   ? C.warning : C.textTertiary;
                      return (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 0',
                          borderBottom: i < lastAppointments.length - 1 ? `1px solid ${C.border}` : 'none',
                        }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: statusColor, flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 13, fontWeight: 550, color: C.text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {a.clients?.full_name || 'Клиент'}
                            </div>
                            <div style={{
                              fontSize: 11, color: C.textTertiary, marginTop: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {a.services?.name || '—'}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 12, color: C.textSecondary,
                            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                          }}>
                            {dateStr}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'income' && (
          <motion.div key="income" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {/* Manual income entry row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, marginBottom: 16,
            }}>
              <input type="number" value={incAmount} onChange={e => setIncAmount(e.target.value)} placeholder="Сумма"
                style={{ ...inputStyle, width: 120 }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <select value={incMethod} onChange={e => setIncMethod(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
                <option value="other">Другое</option>
              </select>
              <input value={incNote} onChange={e => setIncNote(e.target.value)} placeholder="Комментарий (необязательно)"
                style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
                onKeyDown={e => { if (e.key === 'Enter') addManualIncome(); }}
              />
              <button onClick={addManualIncome} disabled={!incAmount || !master?.id}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: C.success, color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: FONT,
                  cursor: !incAmount || !master?.id ? 'not-allowed' : 'pointer',
                  opacity: !incAmount || !master?.id ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={14} /> Добавить доход
              </button>
            </div>

            {payments.length === 0 ? (
              <div style={{
                padding: '56px 20px', textAlign: 'center', color: C.textTertiary, fontSize: 14,
                background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
              }}>
                Нет оплат за выбранный период
              </div>
            ) : (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                overflowX: 'auto',
              }}>
                {payments.map((p, i) => {
                  const dateStr = format(new Date(p.created_at), 'd MMM', { locale: dfLocale });
                  const serviceName = p.services?.name || 'Оплата';
                  const clientName = p.appointment?.client?.full_name || '—';
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1.2fr 1fr 140px',
                        minWidth: 520,
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 20px',
                        borderBottom: i < payments.length - 1 ? `1px solid ${C.border}` : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                      <span style={{
                        fontSize: 14, fontWeight: 550, color: C.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {serviceName}
                      </span>
                      <span style={{
                        fontSize: 13, color: C.textSecondary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {clientName}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: C.success,
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        +{Number(p.amount).toLocaleString()} {CURRENCY}
                      </span>
                    </motion.div>
                  );
                })}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1.2fr 1fr 140px',
                  minWidth: 520,
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span />
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span />
                  <span style={{ color: C.success, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    +{revenue.toLocaleString()} {CURRENCY}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div key="expenses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, marginBottom: 16,
            }}>
              <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="Сумма"
                style={{ ...inputStyle, width: 100 }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <select value={expCategory} onChange={e => setExpCategory(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={expVendor} onChange={e => setExpVendor(e.target.value)} placeholder="Описание"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
                onKeyDown={e => { if (e.key === 'Enter') addExpense(); }}
              />
              <button onClick={addExpense} disabled={!expAmount || !master?.id}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: !expAmount ? C.surfaceElevated : C.accent,
                  color: !expAmount ? C.textTertiary : '#fff',
                  fontSize: 13, fontWeight: 510, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                  cursor: !expAmount ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.15s',
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            {expenses.length === 0 ? (
              <div style={{
                padding: '56px 20px', textAlign: 'center', color: C.textTertiary, fontSize: 14,
                background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
              }}>
                Нет расходов за период
              </div>
            ) : (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                overflowX: 'auto',
              }}>
                {expenses.map((e, i) => {
                  let category = e.category || 'Прочее';
                  if (category === 'other' || category === 'Other' || category === 'revenue_voice') category = 'Прочее';
                  const description = e.description || e.vendor || '';
                  const d = new Date(e.date + 'T00:00:00');
                  const dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1.2fr 1fr 140px 32px',
                        minWidth: 560,
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 20px',
                        borderBottom: i < expenses.length - 1 ? `1px solid ${C.border}` : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={ev => ev.currentTarget.style.background = C.rowHover}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                        {dateStr}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 550, color: C.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {category}
                      </span>
                      <span style={{
                        fontSize: 13, color: C.textSecondary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {description || '—'}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: C.danger,
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        −{Number(e.amount).toLocaleString()} {CURRENCY}
                      </span>
                      <button
                        onClick={() => removeExpense(e.id, Number(e.amount))}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: C.textTertiary, padding: 4, borderRadius: 4,
                          opacity: 0.35, transition: 'opacity 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                        onMouseLeave={ev => ev.currentTarget.style.opacity = '0.35'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1.2fr 1fr 140px 32px',
                  minWidth: 560,
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span />
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span />
                  <span style={{ color: C.danger, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    −{expensesListTotal.toLocaleString()} {CURRENCY}
                  </span>
                  <span />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
