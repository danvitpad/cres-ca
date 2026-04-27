/** --- YAML
 * name: FinancePage
 * description: Finance single-screen — 4 StatCards + AI insight + PillTabs (Обзор/Доходы/Расходы). Period via PeriodSelector dropdown. RPC `master_period_metrics` for KPIs. Voice-created rows marked with 🎙 (Phase 8.2).
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, Plus, Trash2,
  Calendar as CalendarIcon, Trophy,
  CreditCard, Receipt, TrendingUp, Wallet, Mic,
  ArrowRight,
} from 'lucide-react';
import { format, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer, type PageTheme } from '@/lib/dashboard-theme';
import { StatCard } from '@/components/shared/primitives/stat-card';
import { type PillTabItem } from '@/components/shared/pill-tabs';
import { PeriodSelector, makePeriod, type Period, type PeriodKey } from '@/components/shared/period-selector';
import { MyPayoutsBanner } from '@/components/finance/my-payouts-banner';
import { ExportMenu } from '@/components/finance/export-menu';
import { RecurringExpensesTab } from '@/components/catalogue/recurring-expenses-tab';
import { humanizeError } from '@/lib/format/error';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type SubTab = 'overview' | 'income' | 'expenses' | 'recurring';
const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

interface PeriodMetrics {
  revenue: number;
  expenses: number;
  profit: number;
  appointments_count: number;
  avg_check: number;
  new_clients_count: number;
}

interface PaymentRow {
  id: string; amount: number; currency: string; type: string;
  payment_method: string | null; created_at: string;
  appointment: {
    id?: string;
    service: { name: string } | null;
    client: { full_name: string } | null;
  } | null;
}

interface ManualIncomeRow {
  id: string; amount: number; currency: string; date: string;
  client_name: string | null; service_name: string | null;
  payment_method: string | null; category: string | null; note: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: string; date: string; amount: number; currency: string;
  category: string | null; description: string | null; vendor: string | null;
  payment_method: string | null;
}

interface AppointmentRow {
  id: string; starts_at: string; status: string; price: number | null;
  services: { name: string } | null;
  clients: { full_name: string } | null;
}

interface TopServiceRow {
  name: string;
  total: number;
  count: number;
}

function prevPeriod(p: Period): { start: Date; end: Date } {
  const ms = p.end.getTime() - p.start.getTime();
  return { start: new Date(p.start.getTime() - ms - 1), end: new Date(p.start.getTime() - 1) };
}

function pctChange(cur: number, prev: number): number | undefined {
  if (cur === prev) return 0;
  if (prev === 0) return undefined;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

export default function FinancePage() {
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C } = usePageTheme();
  const { master } = useMaster();

  const [periodKey, setPeriodKey] = useState<PeriodKey>('month');
  const period = useMemo(() => makePeriod(periodKey), [periodKey]);
  const [activeTab, setActiveTab] = useState<SubTab>('overview');

  const [current, setCurrent] = useState<PeriodMetrics | null>(null);
  const [previous, setPrevious] = useState<PeriodMetrics | null>(null);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [manualIncomes, setManualIncomes] = useState<ManualIncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [lastAppointments, setLastAppointments] = useState<AppointmentRow[]>([]);
  const [topServices, setTopServices] = useState<TopServiceRow[]>([]);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Расходники');
  const [expVendor, setExpVendor] = useState('');
  const [expDate, setExpDate] = useState(todayIso);
  const [expPaymentMethod, setExpPaymentMethod] = useState('cash');

  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState('cash');
  const [incNote, setIncNote] = useState('');
  const [incDate, setIncDate] = useState(todayIso);
  const [incCategory, setIncCategory] = useState('Услуга');

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const prev = prevPeriod(period);

    const [curMetrics, prevMetrics, allPayments, allManual, allExpenses, apts] = await Promise.all([
      supabase.rpc('master_period_metrics', {
        p_master_id: master.id,
        p_start: period.start.toISOString(),
        p_end: period.end.toISOString(),
      }),
      supabase.rpc('master_period_metrics', {
        p_master_id: master.id,
        p_start: prev.start.toISOString(),
        p_end: prev.end.toISOString(),
      }),
      supabase.from('payments').select('id, amount, currency, type, payment_method, created_at, appointment:appointments(id, service:services(name), client:clients(full_name))')
        .eq('master_id', master.id).eq('status', 'completed')
        .gte('created_at', period.start.toISOString()).lte('created_at', period.end.toISOString())
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('manual_incomes').select('id, amount, currency, date, client_name, service_name, payment_method, category, note, created_at')
        .eq('master_id', master.id)
        .gte('date', period.start.toISOString().slice(0, 10)).lte('date', period.end.toISOString().slice(0, 10))
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('expenses').select('id, date, amount, currency, category, description, vendor, payment_method')
        .eq('master_id', master.id)
        .gte('date', period.start.toISOString().slice(0, 10)).lte('date', period.end.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      supabase.from('appointments').select('id, starts_at, status, price, services(name), clients(full_name)')
        .eq('master_id', master.id)
        .gte('starts_at', period.start.toISOString()).lte('starts_at', period.end.toISOString())
        .order('starts_at', { ascending: false }).limit(500),
    ]);

    const curRow = Array.isArray(curMetrics.data) ? curMetrics.data[0] : curMetrics.data;
    const prevRow = Array.isArray(prevMetrics.data) ? prevMetrics.data[0] : prevMetrics.data;
    setCurrent(curRow as PeriodMetrics | null);
    setPrevious(prevRow as PeriodMetrics | null);

    const paymentsData = (allPayments.data as unknown as PaymentRow[]) || [];
    setPayments(paymentsData);
    setManualIncomes((allManual.data ?? []) as ManualIncomeRow[]);
    setExpenses((allExpenses.data ?? []) as ExpenseRow[]);
    setLastAppointments((apts.data as unknown as AppointmentRow[]) || []);

    // Top services — count from completed appointments + payments (excludes refunds)
    const svcMap = new Map<string, { total: number; count: number }>();
    paymentsData.forEach(p => {
      if (p.type === 'refund') return;
      const name = p.appointment?.service?.name || 'Без услуги';
      const entry = svcMap.get(name) || { total: 0, count: 0 };
      entry.total += Number(p.amount);
      entry.count += 1;
      svcMap.set(name, entry);
    });
    type AptWithSvc = {
      id: string;
      status: string;
      price: number | null;
      services: { name: string } | { name: string }[] | null;
    };
    ((apts.data as unknown as AptWithSvc[]) || []).forEach(a => {
      if (a.status !== 'completed') return;
      const svc = Array.isArray(a.services) ? a.services[0] : a.services;
      const name = svc?.name || 'Без услуги';
      const entry = svcMap.get(name) || { total: 0, count: 0 };
      entry.total += Number(a.price || 0);
      entry.count += 1;
      svcMap.set(name, entry);
    });
    setTopServices(
      Array.from(svcMap.entries())
        .map(([name, { total, count }]) => ({ name, total, count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3),
    );
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
    const ch3 = supabase
      .channel(`fin_mi_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_incomes', filter: `master_id=eq.${master.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, [master?.id, loadData]);

  const fetchAiInsight = useCallback(async () => {
    if (!master?.id) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/finance/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'period_summary', master_id: master.id, period: periodKey }),
      });
      if (res.ok) {
        const { insight } = await res.json();
        setAiInsight(insight?.trim() || null);
      } else {
        setAiInsight(null);
      }
    } catch {
      setAiInsight(null);
    }
    setAiLoading(false);
  }, [master?.id, periodKey]);

  useEffect(() => { fetchAiInsight(); }, [fetchAiInsight]);

  async function addExpense() {
    if (!master?.id || !expAmount) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        master_id: master.id,
        date: expDate || new Date().toISOString().slice(0, 10),
        amount: Number(expAmount),
        currency: 'UAH',
        category: expCategory,
        description: expVendor || null,
        vendor: expVendor || null,
        payment_method: expPaymentMethod,
      })
      .select('id, date, amount, currency, category, description, vendor, payment_method')
      .single();
    if (error) { toast.error(humanizeError(error)); return; }
    setExpenses(prev => [data as ExpenseRow, ...prev]);
    setExpAmount('');
    setExpVendor('');
    setExpDate(todayIso());
    toast.success('Расход добавлен');
    loadData();
  }

  async function removeExpense(id: string) {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Удалено');
    loadData();
  }

  async function addManualIncome() {
    if (!master?.id || !incAmount) return;
    const amt = Number(incAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Введите сумму'); return; }
    const supabase = createClient();
    const { data, error } = await supabase
      .from('manual_incomes')
      .insert({
        master_id: master.id,
        amount: amt,
        currency: 'UAH',
        date: incDate || new Date().toISOString().slice(0, 10),
        payment_method: incMethod,
        category: incCategory || null,
        note: incNote || null,
      })
      .select('id, amount, currency, date, client_name, service_name, payment_method, category, note, created_at')
      .single();
    if (error) { toast.error(humanizeError(error)); return; }
    setManualIncomes(prev => [data as ManualIncomeRow, ...prev]);
    setIncAmount('');
    setIncNote('');
    setIncDate(todayIso());
    toast.success('Доход добавлен');
    loadData();
  }

  const revenue = Number(current?.revenue ?? 0);
  const expenseTotal = Number(current?.expenses ?? 0);
  const profit = Number(current?.profit ?? 0);
  const appointmentsCount = Number(current?.appointments_count ?? 0);

  const prevRevenue = Number(previous?.revenue ?? 0);
  const prevProfit = Number(previous?.profit ?? 0);
  const prevExpense = Number(previous?.expenses ?? 0);
  const prevAppointments = Number(previous?.appointments_count ?? 0);

  const inputStyle = {
    padding: '8px 10px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.text,
    fontSize: 13,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    outline: 'none',
  };

  const SUB_TABS: readonly PillTabItem[] = [
    { value: 'overview', label: 'Обзор' },
    { value: 'income', label: 'Доходы', count: payments.length + manualIncomes.length },
    { value: 'expenses', label: 'Расходы', count: expenses.length },
    { value: 'recurring', label: 'Постоянные расходы' },
  ];

  const expensesTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const incomeRows = useMemo(() => {
    const paymentRows = payments.map((p) => ({
      id: `p_${p.id}`,
      date: p.created_at,
      amount: Number(p.amount),
      title: p.appointment?.service?.name || 'Оплата',
      subtitle: p.appointment?.client?.full_name || '—',
      paymentMethod: p.payment_method ?? null,
      source: 'payment' as const,
    }));
    const manualRows = manualIncomes.map((m) => ({
      id: `m_${m.id}`,
      date: m.date + 'T00:00:00',
      amount: Number(m.amount),
      title: m.category || m.service_name || 'Ручной доход',
      subtitle: m.note || m.client_name || '—',
      paymentMethod: m.payment_method ?? null,
      source: 'manual' as const,
    }));
    // Completed appointments without an explicit payment row (auto-income).
    // Most masters mark appointments completed without separately creating a payment;
    // the KPI tile already counts these via master_period_metrics, so the table needs
    // to mirror that. Dedup against payments by appointment_id to avoid double-counting
    // for masters who use the explicit payment flow.
    const paidApptIds = new Set<string>();
    for (const p of payments) {
      const apt = p.appointment as { id?: string } | null | undefined;
      if (apt?.id) paidApptIds.add(apt.id);
    }
    const apptRows = lastAppointments
      .filter((a) => a.status === 'completed' && !paidApptIds.has(a.id) && Number(a.price ?? 0) > 0)
      .map((a) => ({
        id: `a_${a.id}`,
        date: a.starts_at,
        amount: Number(a.price ?? 0),
        title: (a.services as { name?: string } | null)?.name || 'Услуга',
        subtitle: (a.clients as { full_name?: string } | null)?.full_name || '—',
        paymentMethod: null as string | null,
        source: 'appointment' as const,
      }));
    return [...paymentRows, ...manualRows, ...apptRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [payments, manualIncomes, lastAppointments]);

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Наличные',
    card: 'Карта',
    transfer: 'Перевод',
    other: 'Другое',
  };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

  const incomeRowsTotal = useMemo(
    () => incomeRows.reduce((s, r) => s + r.amount, 0),
    [incomeRows],
  );

  return (
    <div style={{ ...pageContainer, color: C.text, background: C.bg, minHeight: '100%', paddingBottom: 96 }}>
      {/* Header: title + period dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>
            Финансы
          </h1>
          <p style={{ fontSize: 13, color: C.textTertiary, margin: '4px 0 0 0' }}>
            {format(period.start, 'd MMM', { locale: dfLocale })} — {format(period.end, 'd MMM yyyy', { locale: dfLocale })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PeriodSelector value={periodKey} onChange={(p) => setPeriodKey(p.key)} />
          <ExportMenu from={format(period.start, 'yyyy-MM-dd')} to={format(period.end, 'yyyy-MM-dd')} C={C} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <MyPayoutsBanner />
      </div>

      {/* 4 flat StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Доход"
          value={loading ? '—' : `${revenue.toLocaleString()} ${CURRENCY}`}
          trend={pctChange(revenue, prevRevenue)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Расходы"
          value={loading ? '—' : `${expenseTotal.toLocaleString()} ${CURRENCY}`}
          trend={pctChange(expenseTotal, prevExpense)}
          icon={<Receipt size={18} />}
        />
        <StatCard
          label="Прибыль"
          value={loading ? '—' : `${profit.toLocaleString()} ${CURRENCY}`}
          trend={pctChange(profit, prevProfit)}
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Записи"
          value={loading ? '—' : appointmentsCount.toLocaleString()}
          trend={pctChange(appointmentsCount, prevAppointments)}
          icon={<CalendarIcon size={18} />}
        />
      </div>

      {/* AI Insight + ask-anything bubble.
          Кликабельная подсказка превращается в строку ввода — мастер пишет
          конкретный вопрос («проверь топ-3 расхода», «почему за апрель меньше доход»),
          AI отвечает с контекстом 30 дней. */}
      <FinanceAiPanel
        insight={aiInsight}
        loading={aiLoading}
        C={C}
        onApplied={() => loadData()}
      />

      {/* ↑ см. определение FinanceAiPanel в конце файла */}

      {/* Tabs — Обзор / Доходы / Расходы (underline style matching dashboard) */}
      <div style={{
        marginBottom: 20,
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value as SubTab)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? C.accent : 'transparent'}`,
                color: isActive ? C.text : C.textSecondary,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'all 150ms ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  fontSize: 12,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: isActive ? C.accentSoft : 'transparent',
                  color: isActive ? C.accent : C.textTertiary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}
          >
            {/* Top services */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Trophy size={16} style={{ color: C.accent }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
                  Топ услуги
                </h3>
              </div>
              {topServices.length === 0 ? (
                <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>
                  Нет продаж за период
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topServices.map((s, i) => (
                    <div key={s.name} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 0',
                      borderBottom: i < topServices.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: C.textTertiary,
                        width: 20, textAlign: 'left',
                      }}>
                        #{i + 1}
                      </span>
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
                        fontSize: 13, fontWeight: 600, color: C.text,
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      }}>
                        {s.total.toLocaleString()} {CURRENCY}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last appointments */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CalendarIcon size={16} style={{ color: C.accent }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
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
                          a.status === 'no_show' ? C.warning : C.textTertiary;
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
          </motion.div>
        )}

        {activeTab === 'income' && (
          <motion.div
            key="income"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Quick-add income — Дата / Категория / Комментарий / Тип / Сумма */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 160px 1fr 140px 120px auto',
              gap: 8,
              padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, marginBottom: 16,
            }}>
              <input
                type="date" value={incDate} onChange={e => setIncDate(e.target.value)}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <select value={incCategory} onChange={e => setIncCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="Услуга">Услуга</option>
                <option value="Чаевые">Чаевые</option>
                <option value="Возврат">Возврат</option>
                <option value="Другое">Другое</option>
              </select>
              <input
                value={incNote} onChange={e => setIncNote(e.target.value)} placeholder="Комментарий"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
                onKeyDown={e => { if (e.key === 'Enter') addManualIncome(); }}
              />
              <select value={incMethod} onChange={e => setIncMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
                <option value="other">Другое</option>
              </select>
              <input
                type="number" value={incAmount} onChange={e => setIncAmount(e.target.value)} placeholder="Сумма"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <button
                onClick={addManualIncome} disabled={!incAmount || !master?.id}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: C.accent, color: '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: FONT,
                  cursor: !incAmount || !master?.id ? 'not-allowed' : 'pointer',
                  opacity: !incAmount || !master?.id ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={14} /> Добавить
              </button>
            </div>

            {incomeRows.length === 0 ? (
              <div style={{
                padding: '56px 20px', textAlign: 'center', color: C.textTertiary, fontSize: 14,
                background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
              }}>
                <CreditCard size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                <div>Нет оплат за выбранный период</div>
              </div>
            ) : (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1.4fr 1fr 110px 130px',
                  minWidth: 620,
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 11, fontWeight: 600, color: C.textTertiary,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <span>Дата</span>
                  <span>Категория</span>
                  <span>Комментарий</span>
                  <span>Тип</span>
                  <span style={{ textAlign: 'right' }}>Сумма</span>
                </div>
                {incomeRows.map((r, i) => {
                  const dateStr = fmtDate(r.date);
                  const methodLabel = r.paymentMethod ? (PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod) : '—';
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1.4fr 1fr 110px 130px',
                        minWidth: 620,
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 20px',
                        borderBottom: i < incomeRows.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                      <span style={{ fontSize: 14, fontWeight: 550, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.title}
                        {r.source === 'manual' && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.accent, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            · ручной
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 13, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.subtitle}
                      </span>
                      <span style={{ fontSize: 13, color: C.textSecondary }}>
                        {methodLabel}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.success, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        +{r.amount.toLocaleString()} {CURRENCY}
                      </span>
                    </div>
                  );
                })}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1.4fr 1fr 110px 130px',
                  minWidth: 620,
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span />
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span />
                  <span />
                  <span style={{ color: C.success, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    +{incomeRowsTotal.toLocaleString()} {CURRENCY}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div
            key="expenses"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Quick-add expense — Дата / Категория / Комментарий / Тип / Сумма */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 160px 1fr 140px 120px auto',
              gap: 8,
              padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, marginBottom: 16,
            }}>
              <input
                type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <select value={expCategory} onChange={e => setExpCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={expVendor} onChange={e => setExpVendor(e.target.value)} placeholder="Комментарий"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
                onKeyDown={e => { if (e.key === 'Enter') addExpense(); }}
              />
              <select value={expPaymentMethod} onChange={e => setExpPaymentMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
                <option value="other">Другое</option>
              </select>
              <input
                type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="Сумма"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <button
                onClick={addExpense} disabled={!expAmount || !master?.id}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: !expAmount ? C.surfaceElevated : C.accent,
                  color: !expAmount ? C.textTertiary : '#fff',
                  fontSize: 13, fontWeight: 600, fontFamily: FONT,
                  cursor: !expAmount ? 'default' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={14} /> Добавить
              </button>
            </div>

            {expenses.length === 0 ? (
              <div style={{
                padding: '56px 20px', textAlign: 'center', color: C.textTertiary, fontSize: 14,
                background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
              }}>
                <Receipt size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                <div>Нет расходов за период</div>
              </div>
            ) : (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1.4fr 1fr 110px 130px 32px',
                  minWidth: 660,
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 11, fontWeight: 600, color: C.textTertiary,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <span>Дата</span>
                  <span>Категория</span>
                  <span>Комментарий</span>
                  <span>Тип</span>
                  <span style={{ textAlign: 'right' }}>Сумма</span>
                  <span />
                </div>
                {expenses.map((e, i) => {
                  const rawCategory = e.category || '';
                  const isVoice = rawCategory === 'revenue_voice';
                  let category = e.category || 'Прочее';
                  if (category === 'other' || category === 'Other' || category === 'revenue_voice') category = 'Прочее';
                  const description = e.description || e.vendor || '';
                  const dateStr = fmtDate(e.date + 'T00:00:00');
                  const methodLabel = e.payment_method ? (PAYMENT_LABELS[e.payment_method] ?? e.payment_method) : '—';
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1.4fr 1fr 110px 130px 32px',
                        minWidth: 660,
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 20px',
                        borderBottom: i < expenses.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                      <span style={{ fontSize: 14, fontWeight: 550, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {category}
                        {isVoice && (
                          <Mic size={12} aria-label="Создано голосом" style={{ color: '#a78bfa', flexShrink: 0 }} />
                        )}
                      </span>
                      <span style={{ fontSize: 13, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {description || '—'}
                      </span>
                      <span style={{ fontSize: 13, color: C.textSecondary }}>
                        {methodLabel}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.danger, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        −{Number(e.amount).toLocaleString()} {CURRENCY}
                      </span>
                      <button
                        onClick={() => removeExpense(e.id)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: C.textTertiary, padding: 4, borderRadius: 4,
                          opacity: 0.5, transition: 'opacity 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                        onMouseLeave={ev => ev.currentTarget.style.opacity = '0.5'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1.4fr 1fr 110px 130px 32px',
                  minWidth: 660,
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span />
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span />
                  <span />
                  <span style={{ color: C.danger, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    −{expensesTotal.toLocaleString()} {CURRENCY}
                  </span>
                  <span />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'recurring' && (
          <motion.div
            key="recurring"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <RecurringExpensesTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────── Finance AI Panel ────────────────────── */
/* Hint card по умолчанию показывает текущий insight. Клик «Спросить AI»
   раскрывает строку ввода — мастер задаёт конкретный вопрос про свои
   деньги, ответ появляется ниже. Esc / клик мимо закрывает строку. */

type AiPlanCandidate = { id: string; summary: string; table: 'payments' | 'expenses' | 'manual_incomes' };
type AiActionResponse =
  | { intent: 'qa'; text: string }
  | { intent: 'delete'; text: string; plan: { action: 'delete'; candidates: AiPlanCandidate[] } };

interface UndoEntry { log_id: string; summary: string }

function FinanceAiPanel({
  insight, loading, C, onApplied,
}: {
  insight: string | null;
  loading: boolean;
  C: PageTheme;
  onApplied?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiActionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      if (busy || executing) return;
      setExpanded(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy && !executing) setExpanded(false);
    }
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, busy, executing]);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    setPlan(null);
    try {
      const res = await fetch('/api/finance/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'AI не смог обработать');
      } else {
        const r = data as AiActionResponse;
        if (r.intent === 'delete' && r.plan?.candidates?.length) {
          setPlan(r);
          setAnswer(r.text);
        } else {
          setAnswer(r.text || 'Ничего не нашёл.');
        }
        setQuestion('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (e) {
      toast.error((e as Error).message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function execute(c: AiPlanCandidate) {
    if (executing) return;
    setExecuting(true);
    try {
      const res = await fetch('/api/finance/ai-action/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: c.table,
          row_id: c.id,
          action: 'delete',
          user_question: answer ?? null,
          ai_response: plan?.text ?? null,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || 'Не удалось удалить');
        return;
      }
      const log_id = (data as { log_id?: string }).log_id;
      const summary = (data as { summary?: string }).summary || 'Готово';
      if (log_id) setUndoStack((prev) => [{ log_id, summary }, ...prev].slice(0, 5));
      toast.success(summary);
      setPlan(null);
      setAnswer(null);
      onApplied?.();
    } finally {
      setExecuting(false);
    }
  }

  async function undo(entry: UndoEntry) {
    const res = await fetch('/api/finance/ai-undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: entry.log_id }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || 'Не удалось откатить');
      return;
    }
    toast.success(`Откачено: ${entry.summary}`);
    setUndoStack((prev) => prev.filter((e) => e.log_id !== entry.log_id));
    onApplied?.();
  }

  return (
    <div
      ref={wrapRef}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 28,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: C.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={16} style={{ color: C.accent }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              AI-помощник
            </span>
          </div>
          {!expanded ? (
            // В свёрнутом виде сама подсказка кликабельна — клик по ней
            // на месте раскрывается в строку ввода (без отдельной кнопки «Спросить»).
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setAnswer(null);
                setPlan(null);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              style={{
                fontSize: 13, color: C.textSecondary, lineHeight: 1.55,
                margin: 0, padding: 0, textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              {loading
                ? 'Анализирую ваши данные...'
                : insight || 'Пока нечего прокомментировать — добавь больше записей или расходов, помощник даст рекомендации.'}
            </button>
          ) : (
            // Раскрытая форма ввода занимает то же место, где была подсказка.
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px 8px 14px', borderRadius: 999,
              background: C.surfaceElevated, border: `1px solid ${C.border}`,
            }}>
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
                }}
                placeholder="«Сколько я заработал за апрель?» / «Удали расход 500 ₴ от 15 апреля»"
                disabled={busy || executing}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  color: C.text, fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={() => { setExpanded(false); setQuestion(''); }}
                title="Закрыть"
                style={{
                  width: 28, height: 28, borderRadius: 999,
                  border: 'none', background: 'transparent', color: C.textSecondary,
                  cursor: 'pointer', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
              <button
                type="button"
                onClick={ask}
                disabled={busy || executing || question.trim().length < 2}
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  border: 'none', background: C.accent, color: '#fff',
                  cursor: busy || question.trim().length < 2 ? 'not-allowed' : 'pointer',
                  opacity: busy || question.trim().length < 2 ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Спросить"
              >
                {busy ? '…' : <ArrowRight size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* QA-ответ или подводка к плану */}
          {answer && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: C.accentSoft, color: C.text,
              fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line',
            }}>
              {answer}
            </div>
          )}

          {/* Кандидаты на удаление */}
          {plan && plan.intent === 'delete' && plan.plan.candidates.length > 0 && (
            <div style={{
              padding: 12, borderRadius: 10,
              background: C.surfaceElevated, border: `1px dashed ${C.warning}`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warning, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Подтверди удаление
              </div>
              {plan.plan.candidates.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  background: C.surface, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.text,
                }}>
                  <span style={{ flex: 1 }}>{c.summary}</span>
                  <button
                    type="button"
                    onClick={() => execute(c)}
                    disabled={executing}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: C.danger, color: '#fff', fontSize: 11, fontWeight: 600,
                      cursor: executing ? 'wait' : 'pointer', opacity: executing ? 0.5 : 1,
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPlan(null)}
                disabled={executing}
                style={{
                  alignSelf: 'flex-start', marginTop: 2,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: C.textSecondary, fontSize: 12,
                }}
              >
                Отмена
              </button>
            </div>
          )}

          {/* Стек последних AI-действий с кнопкой Откатить */}
          {undoStack.length > 0 && (
            <div style={{
              padding: 10, borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Последние действия AI · можно откатить
              </div>
              {undoStack.map((e) => (
                <div key={e.log_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: C.textSecondary,
                }}>
                  <span style={{ flex: 1 }}>{e.summary}</span>
                  <button
                    type="button"
                    onClick={() => undo(e)}
                    style={{
                      padding: '3px 9px', borderRadius: 6, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.text, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Откатить
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
