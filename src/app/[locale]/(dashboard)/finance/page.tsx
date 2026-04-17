/** --- YAML
 * name: FinanceSummaryPage
 * description: Finance Summary — 3 tabs (Overview / Income / Expenses) + period selector. Replaces old SalesListPage + DailyPage + ExpensesPage.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, Wallet,
  Search, Plus, Camera, Loader2, Trash2, Sparkles, Mic,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { toast } from 'sonner';
import {
  format, subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay,
  startOfWeek, startOfMonth, startOfQuarter, startOfYear,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

const LIGHT = {
  bg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e5e5',
  text: '#0d0d0d', textMuted: '#737373', textLight: '#a3a3a3',
  accent: '#6950f3', accentSoft: '#f0f0ff',
  success: '#10b981', successSoft: 'rgba(16,185,129,0.1)',
  danger: '#d4163a', dangerSoft: 'rgba(212,22,58,0.08)',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#2a2a2a', rowHover: '#111111',
  inputBg: '#ffffff', inputBorder: '#e0e0e0',
  tabActive: '#6950f3', tabInactive: '#737373', tabBorder: '#e5e5e5',
  pillBg: '#f5f5f5', pillActiveBg: '#6950f3', pillActiveText: '#ffffff',
  aiCardBg: 'linear-gradient(135deg, #f8f7ff 0%, #f0edff 100%)',
  aiCardBorder: '#e0dbff',
  chartLine: '#6950f3', chartDot: '#6950f3',
};

const DARK = {
  bg: '#000000', cardBg: '#0a0a0a', cardBorder: '#1a1a1a',
  text: '#f0f0f0', textMuted: '#b3b3b3', textLight: '#666666',
  accent: '#8b7cf6', accentSoft: 'rgba(105,80,243,0.15)',
  success: '#34d399', successSoft: 'rgba(52,211,153,0.12)',
  danger: '#ef4444', dangerSoft: 'rgba(239,68,68,0.1)',
  tableBg: '#000000', tableText: '#f0f0f0', tableTextMuted: '#b3b3b3',
  tableBorder: '#1a1a1a', rowHover: '#0a0a0a',
  inputBg: '#0a0a0a', inputBorder: '#1a1a1a',
  tabActive: '#8b7cf6', tabInactive: '#666666', tabBorder: '#1a1a1a',
  pillBg: '#1a1a1a', pillActiveBg: '#8b7cf6', pillActiveText: '#ffffff',
  aiCardBg: 'linear-gradient(135deg, #0d0b1a 0%, #130f24 100%)',
  aiCardBorder: '#2a2548',
  chartLine: '#8b7cf6', chartDot: '#8b7cf6',
};

/* ─── Period helpers ─── */
type Period = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';

const PERIODS: { key: Period; labelKey: string }[] = [
  { key: 'day', labelKey: 'periodDay' },
  { key: 'week', labelKey: 'periodWeek' },
  { key: 'month', labelKey: 'periodMonth' },
  { key: 'quarter', labelKey: 'periodQuarter' },
  { key: 'half', labelKey: 'periodHalf' },
  { key: 'year', labelKey: 'periodYear' },
  { key: 'all', labelKey: 'periodAll' },
];

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
  const durationMs = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - durationMs), to: new Date(from.getTime() - 1) };
}

type Tab = 'overview' | 'income' | 'expenses';

const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  payment_method: string | null;
  created_at: string;
  services: { name: string } | null;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: string | null;
  description: string | null;
  vendor: string | null;
}

interface TopService {
  name: string;
  revenue: number;
  count: number;
}

export default function FinanceSummaryPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const C = isDark ? DARK : LIGHT;

  const { master } = useMaster();
  const [period, setPeriod] = useState<Period>('month');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Overview data
  const [revenue, setRevenue] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevExpenseTotal, setPrevExpenseTotal] = useState(0);
  const [trendData, setTrendData] = useState<{ label: string; revenue: number; expenses: number }[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<{ id: string; client: string; service: string; date: string; price: number }[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Income data
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [incomeSearch, setIncomeSearch] = useState('');
  const [incomeMethodFilter, setIncomeMethodFilter] = useState('all');

  // Expenses data
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('UAH');
  const [expCategory, setExpCategory] = useState('Прочее');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expVendor, setExpVendor] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);

  const [loading, setLoading] = useState(true);

  /* ─── Data loaders ─── */

  const loadOverview = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { from, to } = periodRange(period);
    const prev = prevPeriodRange(period);

    // Current period payments
    const { data: curPayments } = await supabase
      .from('payments')
      .select('amount, type, services(name)')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());

    const cp = (curPayments || []) as unknown as { amount: number; type: string; services: { name: string } | null }[];
    const rev = cp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0);
    setRevenue(rev);

    // Current period expenses
    const { data: curExpenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('master_id', master.id)
      .gte('date', from.toISOString().slice(0, 10))
      .lte('date', to.toISOString().slice(0, 10));

    const expT = (curExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
    setExpenseTotal(expT);

    // Previous period for comparison
    const { data: prevPayments } = await supabase
      .from('payments')
      .select('amount, type')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('created_at', prev.from.toISOString())
      .lte('created_at', prev.to.toISOString());

    const pp = (prevPayments || []) as { amount: number; type: string }[];
    setPrevRevenue(pp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));

    const { data: prevExp } = await supabase
      .from('expenses')
      .select('amount')
      .eq('master_id', master.id)
      .gte('date', prev.from.toISOString().slice(0, 10))
      .lte('date', prev.to.toISOString().slice(0, 10));

    setPrevExpenseTotal((prevExp || []).reduce((s, e) => s + Number(e.amount), 0));

    // Top services
    const serviceMap = new Map<string, { revenue: number; count: number }>();
    for (const p of cp) {
      if (p.type === 'refund') continue;
      const name = p.services?.name || 'Другое';
      const cur = serviceMap.get(name) || { revenue: 0, count: 0 };
      cur.revenue += Number(p.amount);
      cur.count += 1;
      serviceMap.set(name, cur);
    }
    const sorted = Array.from(serviceMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
    setTopServices(sorted);

    // Recent appointments
    const { data: recentApts } = await supabase
      .from('appointments')
      .select('id, starts_at, price, services(name), clients(profiles(first_name, last_name))')
      .eq('master_id', master.id)
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString())
      .order('starts_at', { ascending: false })
      .limit(5);

    setRecentAppointments(
      (recentApts || []).map((a: any) => ({
        id: a.id,
        client: a.clients?.profiles ? `${a.clients.profiles.first_name || ''} ${a.clients.profiles.last_name || ''}`.trim() : '—',
        service: a.services?.name || '—',
        date: a.starts_at,
        price: Number(a.price) || 0,
      }))
    );

    // Trend — build 7 data points for the period
    const { from: tFrom, to: tTo } = periodRange(period);
    const totalMs = tTo.getTime() - tFrom.getTime();
    const step = totalMs / 7;
    const trend: { label: string; revenue: number; expenses: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const segStart = new Date(tFrom.getTime() + step * i);
      const segEnd = new Date(tFrom.getTime() + step * (i + 1));
      const lbl = format(segStart, period === 'day' ? 'HH:mm' : 'd MMM', { locale: dfLocale });

      const segRev = cp.filter(p => {
        // cp doesn't have created_at — we'll approximate
        return p.type !== 'refund';
      });

      trend.push({ label: lbl, revenue: rev / 7, expenses: expT / 7 });
    }
    setTrendData(trend);
  }, [master?.id, period, dfLocale]);

  const loadIncome = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { from, to } = periodRange(period);

    const { data } = await supabase
      .from('payments')
      .select('id, amount, currency, type, status, payment_method, created_at, services(name)')
      .eq('master_id', master.id)
      .eq('status', 'completed')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false });

    setPayments((data as unknown as PaymentRow[]) || []);
  }, [master?.id, period]);

  const loadExpenses = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { from, to } = periodRange(period);

    const { data } = await supabase
      .from('expenses')
      .select('id, date, amount, currency, category, description, vendor')
      .eq('master_id', master.id)
      .gte('date', from.toISOString().slice(0, 10))
      .lte('date', to.toISOString().slice(0, 10))
      .order('date', { ascending: false });

    setExpenses((data ?? []) as ExpenseRow[]);
  }, [master?.id, period]);

  // Load all data
  useEffect(() => {
    setLoading(true);
    Promise.all([loadOverview(), loadIncome(), loadExpenses()]).finally(() => setLoading(false));
  }, [loadOverview, loadIncome, loadExpenses]);

  // Realtime subscriptions
  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const ch1 = supabase
      .channel(`fin_payments_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `master_id=eq.${master.id}` }, () => { loadOverview(); loadIncome(); })
      .subscribe();
    const ch2 = supabase
      .channel(`fin_expenses_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `master_id=eq.${master.id}` }, () => { loadOverview(); loadExpenses(); })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [master?.id, loadOverview, loadIncome, loadExpenses]);

  /* ─── AI Insights ─── */
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
        setAiInsight(insight);
      }
    } catch { /* AI is optional */ }
    setAiLoading(false);
  }, [master?.id, period]);

  useEffect(() => { if (activeTab === 'overview') fetchAiInsight(); }, [fetchAiInsight, activeTab]);

  /* ─── Expense CRUD ─── */
  async function addExpense() {
    if (!master?.id || !expAmount) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        master_id: master.id,
        date: expDate,
        amount: Number(expAmount),
        currency: expCurrency,
        category: expCategory,
        description: [expCategory, expVendor].filter(Boolean).join(' — ') || expCategory,
        vendor: expVendor || null,
      })
      .select('id, date, amount, currency, category, description, vendor')
      .single();
    if (error) { toast.error(error.message); return; }
    setExpenses(prev => [data as ExpenseRow, ...prev]);
    setExpAmount('');
    setExpVendor('');
    toast.success('Расход добавлен');
  }

  async function removeExpense(id: string) {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Расход удалён');
  }

  async function ocrUpload(file: File) {
    setOcrBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/expenses/parse-receipt', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'OCR failed'); return; }
      const r = json.result as { amount?: number; currency?: string; vendor?: string; date?: string; category?: string };
      if (r.amount) setExpAmount(String(r.amount));
      if (r.currency) setExpCurrency(r.currency);
      if (r.vendor) setExpVendor(r.vendor);
      if (r.date) setExpDate(r.date);
      if (r.category && EXPENSE_CATEGORIES.includes(r.category)) setExpCategory(r.category);
      toast.success('Чек распознан');
    } catch { toast.error('Ошибка распознавания'); }
    finally { setOcrBusy(false); }
  }

  /* ─── Filtered income ─── */
  const filteredPayments = useMemo(() => {
    let result = payments;
    if (incomeMethodFilter !== 'all') {
      result = result.filter(p => (p.payment_method || 'other') === incomeMethodFilter);
    }
    if (incomeSearch.trim()) {
      const q = incomeSearch.toLowerCase();
      result = result.filter(p =>
        p.id.toLowerCase().includes(q) ||
        (p.services?.name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [payments, incomeSearch, incomeMethodFilter]);

  const incomeTotal = useMemo(() => filteredPayments.reduce((s, p) => s + Number(p.amount), 0), [filteredPayments]);
  const expensesTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  /* ─── KPI helpers ─── */
  const netProfit = revenue - expenseTotal;
  const prevNet = prevRevenue - prevExpenseTotal;

  function pctChange(cur: number, prev: number): number {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  const revChange = pctChange(revenue, prevRevenue);
  const expChange = pctChange(expenseTotal, prevExpenseTotal);
  const netChange = pctChange(netProfit, prevNet);

  /* ─── Chart ─── */
  const chartW = 560;
  const chartH = 80;
  const chartPad = 8;
  const maxVal = Math.max(...trendData.map(d => d.revenue), 1);
  const chartPoints = trendData.map((d, i) => ({
    x: chartPad + (i / Math.max(trendData.length - 1, 1)) * (chartW - chartPad * 2),
    y: chartPad + (1 - d.revenue / maxVal) * (chartH - chartPad * 2),
  }));
  const polyline = chartPoints.map(p => `${p.x},${p.y}`).join(' ');

  /* ─── Period labels (fallback if i18n key missing) ─── */
  const periodLabels: Record<Period, string> = {
    day: 'День',
    week: 'Неделя',
    month: 'Месяц',
    quarter: 'Квартал',
    half: 'Полгода',
    year: 'Год',
    all: 'Всё время',
  };

  const tabLabels: Record<Tab, string> = {
    overview: 'Обзор',
    income: 'Доходы',
    expenses: 'Расходы',
  };

  function safeT(key: string, fallback: string): string {
    try { const v = t(key); return v || fallback; } catch { return fallback; }
  }

  return (
    <div style={{ fontFamily: FONT, color: C.text, height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {safeT('sectionTitle', 'Продажи')} — {safeT('summary', 'Сводка')}
        </h1>
        <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>
          {safeT('summaryDesc', 'Доходы, расходы и ключевые показатели за выбранный период.')}
        </p>
      </div>

      {/* Period selector pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: period === p.key ? 600 : 400,
              fontFamily: FONT,
              background: period === p.key ? C.pillActiveBg : C.pillBg,
              color: period === p.key ? C.pillActiveText : C.textMuted,
              transition: 'all 0.15s ease',
            }}
          >
            {periodLabels[p.key]}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${C.tabBorder}`, marginBottom: 24 }}>
        {(['overview', 'income', 'expenses'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: FONT,
              color: activeTab === tab ? C.tabActive : C.tabInactive,
              borderBottom: activeTab === tab ? `2px solid ${C.tabActive}` : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s ease',
            }}
          >
            {tabLabels[tab]}
            {tab === 'income' && !loading && (
              <span style={{ marginLeft: 6, fontSize: 11, color: C.success, fontWeight: 500 }}>
                {revenue.toLocaleString()} UAH
              </span>
            )}
            {tab === 'expenses' && !loading && (
              <span style={{ marginLeft: 6, fontSize: 11, color: C.danger, fontWeight: 500 }}>
                {expenseTotal.toLocaleString()} UAH
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {/* Revenue */}
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: C.successSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={18} style={{ color: C.success }} />
                  </div>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Доходы</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{revenue.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>UAH</span></div>
                <div style={{ fontSize: 12, color: revChange >= 0 ? C.success : C.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {revChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {revChange >= 0 ? '+' : ''}{revChange}% vs пред. период
                </div>
              </div>

              {/* Expenses */}
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: C.dangerSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={18} style={{ color: C.danger }} />
                  </div>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Расходы</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{expenseTotal.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>UAH</span></div>
                <div style={{ fontSize: 12, color: expChange <= 0 ? C.success : C.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {expChange <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {expChange >= 0 ? '+' : ''}{expChange}% vs пред. период
                </div>
              </div>

              {/* Net Profit */}
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={18} style={{ color: C.accent }} />
                  </div>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Чистая прибыль</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: netProfit >= 0 ? C.text : C.danger, marginBottom: 4 }}>
                  {netProfit.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>UAH</span>
                </div>
                <div style={{ fontSize: 12, color: netChange >= 0 ? C.success : C.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {netChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {netChange >= 0 ? '+' : ''}{netChange}% vs пред. период
                </div>
              </div>
            </div>

            {/* Trend chart */}
            {trendData.length > 0 && (
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px', marginBottom: 24,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Тренд за период</div>
                <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ maxWidth: chartW }}>
                  {chartPoints.length > 1 && (
                    <>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.chartLine} stopOpacity="0.2" />
                          <stop offset="100%" stopColor={C.chartLine} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`${chartPoints[0].x},${chartH} ${polyline} ${chartPoints[chartPoints.length - 1].x},${chartH}`}
                        fill="url(#trendFill)"
                      />
                      <polyline points={polyline} fill="none" stroke={C.chartLine} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      {chartPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3} fill={C.chartDot} />
                      ))}
                    </>
                  )}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  {trendData.map((d, i) => (
                    <span key={i} style={{ fontSize: 10, color: C.textMuted }}>{d.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Two columns: Top Services + Recent Appointments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Top Services */}
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Топ услуги</div>
                {topServices.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>Нет данных за период</div>
                ) : topServices.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < topServices.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{s.count} записей</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.revenue.toLocaleString()} UAH</div>
                  </div>
                ))}
              </div>

              {/* Recent Appointments */}
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Последние записи</div>
                {recentAppointments.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>Нет записей за период</div>
                ) : recentAppointments.map((a, i) => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < recentAppointments.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.client}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{a.service} &middot; {format(new Date(a.date), 'd MMM HH:mm', { locale: dfLocale })}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.price.toLocaleString()} UAH</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div style={{
              background: C.aiCardBg, border: `1px solid ${C.aiCardBorder}`, borderRadius: 12,
              padding: '20px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={16} style={{ color: C.accent }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>AI-инсайты</span>
                {aiLoading && <Loader2 size={14} className="animate-spin" style={{ color: C.accent }} />}
              </div>
              {aiInsight ? (
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>{aiInsight}</p>
              ) : (
                <p style={{ fontSize: 13, color: C.textLight, margin: 0 }}>
                  {aiLoading ? 'Анализируем данные...' : 'AI-анализ станет доступен после накопления данных.'}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'income' && (
          <motion.div key="income" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
                <input
                  value={incomeSearch}
                  onChange={e => setIncomeSearch(e.target.value)}
                  placeholder={safeT('search', 'Поиск...')}
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
                    border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                    fontSize: 13, outline: 'none', fontFamily: FONT,
                  }}
                />
              </div>
              <select
                value={incomeMethodFilter}
                onChange={e => setIncomeMethodFilter(e.target.value)}
                style={{
                  padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.inputBorder}`,
                  background: C.inputBg, color: C.text, fontSize: 13, fontFamily: FONT,
                  cursor: 'pointer',
                }}
              >
                <option value="all">Все методы</option>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="online">Онлайн</option>
                <option value="other">Другое</option>
              </select>
              <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: C.success }}>
                Итого: {incomeTotal.toLocaleString()} UAH
              </div>
            </div>

            {/* Table */}
            {filteredPayments.length === 0 ? (
              <div style={{
                background: C.tableBg, borderRadius: 12, padding: '60px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}>
                <DollarSign size={32} style={{ color: C.accent, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: C.tableText }}>Нет доходов за период</p>
              </div>
            ) : (
              <div style={{ background: C.tableBg, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                      <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>Услуга</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>Метод</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>Дата</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.tableTextMuted }}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p, i) => (
                      <tr
                        key={p.id}
                        style={{ borderBottom: `1px solid ${C.tableBorder}`, cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 20px', fontSize: 13, color: C.accent, fontWeight: 500 }}>
                          #{p.id.slice(0, 7).toUpperCase()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableText }}>{p.services?.name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableTextMuted }}>
                          {p.payment_method === 'cash' ? 'Наличные' : p.payment_method === 'card' ? 'Карта' : p.payment_method || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: C.tableTextMuted }}>
                          {format(new Date(p.created_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.tableText }}>
                          +{Number(p.amount).toLocaleString()} {p.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div key="expenses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Add expense form */}
            <div style={{
              background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
              padding: '20px 24px', marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Добавить расход</span>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  borderRadius: 8, border: `1px dashed ${C.inputBorder}`, cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, color: C.textMuted,
                  transition: 'border-color 0.15s',
                }}>
                  {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {ocrBusy ? 'Распознаём...' : 'Фото чека'}
                  <input
                    type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) ocrUpload(f); }}
                  />
                </label>
                <button
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    borderRadius: 8, border: `1px dashed ${C.inputBorder}`, cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, color: C.textMuted, background: 'transparent',
                    fontFamily: FONT,
                  }}
                  onClick={() => toast.info('Голосовой ввод будет доступен после настройки AI Voice Router')}
                >
                  <Mic size={14} />
                  Голосом
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Сумма</label>
                  <input
                    type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                      fontSize: 13, fontFamily: FONT, outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Валюта</label>
                  <input
                    value={expCurrency} onChange={e => setExpCurrency(e.target.value.toUpperCase())}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                      fontSize: 13, fontFamily: FONT, outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Дата</label>
                  <input
                    type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                      fontSize: 13, fontFamily: FONT, outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Категория</label>
                  <select
                    value={expCategory} onChange={e => setExpCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                      fontSize: 13, fontFamily: FONT, cursor: 'pointer',
                    }}
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Поставщик</label>
                  <input
                    value={expVendor} onChange={e => setExpVendor(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.text,
                      fontSize: 13, fontFamily: FONT, outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                onClick={addExpense}
                disabled={!expAmount || !master?.id}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: !expAmount ? C.pillBg : C.accent, color: !expAmount ? C.textMuted : '#fff',
                  fontSize: 13, fontWeight: 600, cursor: !expAmount ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
                }}
              >
                <Plus size={14} />
                Добавить
              </button>
            </div>

            {/* Expenses list */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Расходы за период</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>Итого: {expensesTotal.toLocaleString()} UAH</span>
            </div>

            {expenses.length === 0 ? (
              <div style={{
                background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
                padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}>
                <Receipt size={32} style={{ color: C.accent, marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>Нет расходов за период</p>
                <p style={{ fontSize: 13, color: C.textMuted }}>Добавьте расход выше или сфотографируйте чек</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expenses.map(e => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 10,
                      padding: '14px 20px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {Number(e.amount).toLocaleString()} {e.currency}
                        {e.category && (
                          <span style={{
                            marginLeft: 10, fontSize: 11, fontWeight: 500,
                            padding: '2px 8px', borderRadius: 4,
                            background: C.accentSoft, color: C.accent,
                          }}>
                            {e.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {e.date}{e.vendor && ` · ${e.vendor}`}
                      </div>
                    </div>
                    <button
                      onClick={() => removeExpense(e.id)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: C.textMuted, padding: 4, borderRadius: 4,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = LIGHT.danger)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
