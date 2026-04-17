/** --- YAML
 * name: FinanceSummaryPage
 * description: Finance home — answers "how am I doing?" in 2 seconds. AI insight first, big number, simple expense entry. Not an accounting tool.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Sparkles, Loader2,
  Plus, Trash2, ChevronDown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { toast } from 'sonner';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import {
  format, startOfDay, endOfDay, startOfWeek, startOfMonth,
  startOfQuarter, startOfYear, subMonths,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

/* ─── Period ─── */
type Period = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Сегодня',
  week: 'Эта неделя',
  month: 'Этот месяц',
  quarter: 'Квартал',
  half: 'Полгода',
  year: 'Год',
  all: 'Всё время',
};

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

type Tab = 'income' | 'expenses';

const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  type: string;
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

export default function FinanceSummaryPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C, isDark, mounted } = usePageTheme();

  const { master } = useMaster();
  const [period, setPeriod] = useState<Period>('month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('income');

  const [revenue, setRevenue] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevExpenseTotal, setPrevExpenseTotal] = useState(0);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  // Quick expense form
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Расходники');
  const [expVendor, setExpVendor] = useState('');

  const [loading, setLoading] = useState(true);

  /* ─── Data loading ─── */

  const loadData = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { from, to } = periodRange(period);
    const prev = prevPeriodRange(period);

    const [curP, curE, prevP, prevE, allPayments, allExpenses] = await Promise.all([
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
      supabase.from('payments').select('id, amount, currency, type, payment_method, created_at, services(name)')
        .eq('master_id', master.id).eq('status', 'completed')
        .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('expenses').select('id, date, amount, currency, category, description, vendor')
        .eq('master_id', master.id)
        .gte('date', from.toISOString().slice(0, 10)).lte('date', to.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
    ]);

    const cp = (curP.data || []) as { amount: number; type: string }[];
    setRevenue(cp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));
    setExpenseTotal((curE.data || []).reduce((s, e: any) => s + Number(e.amount), 0));

    const pp = (prevP.data || []) as { amount: number; type: string }[];
    setPrevRevenue(pp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));
    setPrevExpenseTotal((prevE.data || []).reduce((s, e: any) => s + Number(e.amount), 0));

    setPayments((allPayments.data as unknown as PaymentRow[]) || []);
    setExpenses((allExpenses.data ?? []) as ExpenseRow[]);
  }, [master?.id, period]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Realtime
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

  /* ─── AI Insight ─── */
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

  useEffect(() => { fetchAiInsight(); }, [fetchAiInsight]);

  /* ─── Expense CRUD ─── */
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

  /* ─── Computed ─── */
  const netProfit = revenue - expenseTotal;
  const prevNet = prevRevenue - prevExpenseTotal;

  function pctChange(cur: number, prev: number): number {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  const revChange = pctChange(revenue, prevRevenue);
  const netChange = pctChange(netProfit, prevNet);

  /* ─── Close dropdown on outside click ─── */
  useEffect(() => {
    if (!periodOpen) return;
    const close = () => setPeriodOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [periodOpen]);

  const expensesListTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  function safeT(key: string, fallback: string): string {
    try { const v = t(key); return v || fallback; } catch { return fallback; }
  }

  return (
    <div style={{
      fontFamily: FONT,
      fontFeatureSettings: FONT_FEATURES,
      color: C.text,
      background: C.bg,
      padding: '32px 40px',
      maxWidth: 860,
      margin: '0 auto',
      width: '100%',
    }}>
      {/* ─── Header row: Title + Period dropdown ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 510, letterSpacing: '-0.3px', margin: 0 }}>
          {safeT('summary', 'Финансы')}
        </h1>

        {/* Period dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setPeriodOpen(!periodOpen); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6,
              border: `1px solid ${C.borderStrong}`,
              background: C.surface, color: C.textSecondary,
              fontSize: 13, fontWeight: 510, fontFamily: FONT,
              fontFeatureSettings: '"cv01", "ss03"',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
          >
            {PERIOD_LABELS[period]}
            <ChevronDown size={14} style={{ opacity: 0.5 }} />
          </button>

          <AnimatePresence>
            {periodOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: C.surface, border: `1px solid ${C.borderStrong}`,
                  borderRadius: 8, padding: 4, minWidth: 160, zIndex: 50,
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0,0,0,0.5)'
                    : '0 8px 24px rgba(0,0,0,0.08)',
                }}
              >
                {(Object.keys(PERIOD_LABELS) as Period[]).map(key => (
                  <button
                    key={key}
                    onClick={e => { e.stopPropagation(); setPeriod(key); setPeriodOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', borderRadius: 4, border: 'none',
                      background: period === key ? C.accentSoft : 'transparent',
                      color: period === key ? C.accent : C.text,
                      fontSize: 13, fontWeight: period === key ? 510 : 400,
                      fontFamily: FONT, fontFeatureSettings: '"cv01", "ss03"',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (period !== key) e.currentTarget.style.background = C.surfaceElevated; }}
                    onMouseLeave={e => { if (period !== key) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {PERIOD_LABELS[key]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── AI Insight — FIRST thing the master sees ─── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: C.aiGradient,
          border: `1px solid ${C.aiBorder}`,
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={15} style={{ color: C.accent }} />
          <span style={{ fontSize: 12, fontWeight: 510, color: C.accent, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            AI-помощник
          </span>
          {aiLoading && <Loader2 size={13} className="animate-spin" style={{ color: C.accent }} />}
        </div>
        <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
          {aiInsight
            ? aiInsight
            : aiLoading
              ? 'Анализирую ваши данные...'
              : 'Добавьте записи и расходы — я подскажу, как улучшить доход.'
          }
        </p>
      </motion.div>

      {/* ─── Big numbers: Revenue / Expenses / Net ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {/* Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 510, color: C.textTertiary, marginBottom: 8, letterSpacing: '0.01em' }}>
            Доход
          </div>
          <div style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 6 }}>
            {loading ? '—' : `${revenue.toLocaleString()} ₴`}
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: revChange >= 0 ? C.success : C.danger }}>
              {revChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span style={{ fontWeight: 510 }}>{revChange >= 0 ? '+' : ''}{revChange}%</span>
              <span style={{ color: C.textTertiary, fontWeight: 400 }}>vs пред.</span>
            </div>
          )}
        </motion.div>

        {/* Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 510, color: C.textTertiary, marginBottom: 8, letterSpacing: '0.01em' }}>
            Расходы
          </div>
          <div style={{ fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 6 }}>
            {loading ? '—' : `${expenseTotal.toLocaleString()} ₴`}
          </div>
          {!loading && expenseTotal > 0 && (
            <div style={{ fontSize: 12, color: C.textTertiary }}>
              {expenses.length} записей
            </div>
          )}
        </motion.div>

        {/* Net */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 510, color: C.textTertiary, marginBottom: 8, letterSpacing: '0.01em' }}>
            На руки
          </div>
          <div style={{
            fontSize: 24, fontWeight: 510, letterSpacing: '-0.5px', marginBottom: 6,
            color: netProfit >= 0 ? C.text : C.danger,
          }}>
            {loading ? '—' : `${netProfit.toLocaleString()} ₴`}
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: netChange >= 0 ? C.success : C.danger }}>
              {netChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span style={{ fontWeight: 510 }}>{netChange >= 0 ? '+' : ''}{netChange}%</span>
              <span style={{ color: C.textTertiary, fontWeight: 400 }}>vs пред.</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Tabs: Доходы / Расходы ─── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 20,
      }}>
        {(['income', 'expenses'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 510, fontFamily: FONT,
              fontFeatureSettings: '"cv01", "ss03"',
              color: activeTab === tab ? C.text : C.textTertiary,
              borderBottom: activeTab === tab ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s ease',
            }}
          >
            {tab === 'income' ? 'Доходы' : 'Расходы'}
          </button>
        ))}
      </div>

      {/* ─── Tab content ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'income' && (
          <motion.div key="income" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {payments.length === 0 ? (
              <div style={{
                padding: '48px 20px', textAlign: 'center',
                color: C.textTertiary, fontSize: 14,
              }}>
                Нет оплат за выбранный период
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {payments.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 8,
                      transition: 'background 0.1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 510 }}>
                        {p.services?.name || 'Оплата'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                        {format(new Date(p.created_at), 'd MMM, HH:mm', { locale: dfLocale })}
                        {p.payment_method && ` · ${p.payment_method === 'cash' ? 'Нал' : p.payment_method === 'card' ? 'Карта' : p.payment_method}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 510, color: C.success, flexShrink: 0 }}>
                      +{Number(p.amount).toLocaleString()} ₴
                    </div>
                  </motion.div>
                ))}

                {/* Total */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '14px 16px', marginTop: 4,
                  borderTop: `1px solid ${C.border}`,
                  fontSize: 14, fontWeight: 510,
                }}>
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span style={{ color: C.success }}>{revenue.toLocaleString()} ₴</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div key="expenses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {/* Quick add form — compact, one row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, marginBottom: 16,
            }}>
              <input
                type="number"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                placeholder="Сумма"
                style={{
                  width: 100, padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.text, fontSize: 13, fontFamily: FONT,
                  fontFeatureSettings: '"cv01", "ss03"',
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
              />
              <select
                value={expCategory}
                onChange={e => setExpCategory(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.text, fontSize: 13, fontFamily: FONT,
                  fontFeatureSettings: '"cv01", "ss03"',
                  cursor: 'pointer',
                }}
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={expVendor}
                onChange={e => setExpVendor(e.target.value)}
                placeholder="Описание"
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.text, fontSize: 13, fontFamily: FONT,
                  fontFeatureSettings: '"cv01", "ss03"',
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = C.accent}
                onBlur={e => e.currentTarget.style.borderColor = C.border as string}
                onKeyDown={e => { if (e.key === 'Enter') addExpense(); }}
              />
              <button
                onClick={addExpense}
                disabled={!expAmount || !master?.id}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: !expAmount ? C.surfaceElevated : C.accent,
                  color: !expAmount ? C.textTertiary : '#fff',
                  fontSize: 13, fontWeight: 510, fontFamily: FONT,
                  fontFeatureSettings: '"cv01", "ss03"',
                  cursor: !expAmount ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'background 0.15s',
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Expenses list */}
            {expenses.length === 0 ? (
              <div style={{
                padding: '48px 20px', textAlign: 'center',
                color: C.textTertiary, fontSize: 14,
              }}>
                Нет расходов за период
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {expenses.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 8,
                      transition: 'background 0.1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.background = C.rowHover}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 510 }}>
                          {e.vendor || e.category || 'Расход'}
                        </div>
                        <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                          {e.date}
                          {e.category && ` · ${e.category}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 510, color: C.danger }}>
                        −{Number(e.amount).toLocaleString()} ₴
                      </span>
                      <button
                        onClick={() => removeExpense(e.id, Number(e.amount))}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: C.textTertiary, padding: 2, borderRadius: 4,
                          opacity: 0.4, transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.opacity = '1'}
                        onMouseLeave={ev => ev.currentTarget.style.opacity = '0.4'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {/* Total */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '14px 16px', marginTop: 4,
                  borderTop: `1px solid ${C.border}`,
                  fontSize: 14, fontWeight: 510,
                }}>
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span style={{ color: C.danger }}>{expensesListTotal.toLocaleString()} ₴</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
