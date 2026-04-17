/** --- YAML
 * name: SummaryTab
 * description: Finance summary tab — KPI cards, AI insight, income/expense lists with period selector.
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
  day: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц',
  quarter: 'Квартал', half: 'Полгода', year: 'Год', all: 'Всё время',
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

type SubTab = 'income' | 'expenses';
const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Еда', 'Транспорт', 'Коммунальные', 'Реклама', 'Оборудование', 'Прочее'];

interface PaymentRow {
  id: string; amount: number; currency: string; type: string;
  payment_method: string | null; created_at: string;
  services: { name: string } | null;
}

interface ExpenseRow {
  id: string; date: string; amount: number; currency: string;
  category: string | null; description: string | null; vendor: string | null;
}

export function SummaryTab({ C, isDark, period, setPeriod }: {
  C: PageTheme; isDark: boolean;
  period: Period; setPeriod: (p: Period) => void;
}) {
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { master } = useMaster();
  const [activeTab, setActiveTab] = useState<SubTab>('income');

  const [revenue, setRevenue] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevExpenseTotal, setPrevExpenseTotal] = useState(0);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Расходники');
  const [expVendor, setExpVendor] = useState('');
  const [loading, setLoading] = useState(true);

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
    setExpenseTotal((curE.data || []).reduce((s, e: any) => s + Number(e.amount), 0)); // eslint-disable-line @typescript-eslint/no-explicit-any

    const pp = (prevP.data || []) as { amount: number; type: string }[];
    setPrevRevenue(pp.filter(p => p.type !== 'refund').reduce((s, p) => s + Number(p.amount), 0));
    setPrevExpenseTotal((prevE.data || []).reduce((s, e: any) => s + Number(e.amount), 0)); // eslint-disable-line @typescript-eslint/no-explicit-any

    setPayments((allPayments.data as unknown as PaymentRow[]) || []);
    setExpenses((allExpenses.data ?? []) as ExpenseRow[]);
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
        setAiInsight(insight || null);
      }
    } catch { /* AI is optional */ }
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

  const netProfit = revenue - expenseTotal;
  const prevNet = prevRevenue - prevExpenseTotal;

  function pctChange(cur: number, prev: number): number {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
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

  return (
    <>
      {/* AI Insight */}
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
          {aiInsight ?? (aiLoading ? 'Анализирую ваши данные...' : 'Добавьте записи и расходы — я подскажу, как улучшить доход.')}
        </p>
      </motion.div>

      {/* KPI cards — gradient style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Доход', value: revenue, change: revChange, showChange: true, gradient: KPI_GRADIENTS.revenue },
          { label: 'Расходы', value: expenseTotal, extra: expenses.length > 0 ? `${expenses.length} записей` : undefined, gradient: KPI_GRADIENTS.expenses },
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
            {/* Decorative circle */}
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
            {!loading && card.showChange && card.change !== undefined && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 550,
                background: 'rgba(255,255,255,0.18)',
                padding: '3px 8px', borderRadius: 6,
                color: '#ffffff',
              }}>
                {card.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {card.change >= 0 ? '+' : ''}{card.change}%
                <span style={{ opacity: 0.6, fontWeight: 400 }}>vs пред.</span>
              </div>
            )}
            {!loading && card.extra && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{card.extra}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Sub-tabs: Доходы / Расходы */}
      <div style={{
        display: 'inline-flex', gap: 2,
        background: C.surfaceElevated,
        borderRadius: 10, padding: 3, marginBottom: 22,
      }}>
        {(['income', 'expenses'] as SubTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', border: 'none',
              background: activeTab === tab ? C.surface : 'transparent',
              cursor: 'pointer',
              fontSize: 13, fontWeight: 550, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
              color: activeTab === tab ? C.text : C.textTertiary,
              borderRadius: 7,
              transition: 'all 0.15s ease',
              boxShadow: activeTab === tab
                ? (isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)')
                : 'none',
            }}
          >
            {tab === 'income' ? 'Доходы' : 'Расходы'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'income' && (
          <motion.div key="income" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
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
                overflow: 'hidden',
              }}>
                {payments.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < payments.length - 1 ? `1px solid ${C.border}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 550 }}>{p.services?.name || 'Оплата'}</div>
                      <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 3 }}>
                        {format(new Date(p.created_at), 'd MMM, HH:mm', { locale: dfLocale })}
                        {p.payment_method && ` · ${p.payment_method === 'cash' ? 'Нал' : p.payment_method === 'card' ? 'Карта' : p.payment_method}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.success, flexShrink: 0 }}>
                      +{Number(p.amount).toLocaleString()} {CURRENCY}
                    </div>
                  </motion.div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span style={{ color: C.textSecondary }}>Итого</span>
                  <span style={{ color: C.success }}>{revenue.toLocaleString()} {CURRENCY}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div key="expenses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {/* Quick add */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
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
                overflow: 'hidden',
              }}>
                {expenses.map((e, i) => {
                  // Primary text: real description > vendor > category
                  const main = e.description || e.vendor || e.category || 'Расход';
                  // Sub: category tag (if not already in main)
                  const sub = e.category && e.category !== main ? e.category : null;
                  const d = new Date(e.date + 'T00:00:00');
                  const dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 140px 32px',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 20px',
                        borderBottom: i < expenses.length - 1 ? `1px solid ${C.border}` : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={ev => ev.currentTarget.style.background = C.rowHover}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                    >
                      {/* Date column */}
                      <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                        {dateStr}
                      </span>
                      {/* Description column */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 550, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {main}
                        </div>
                        {sub && (
                          <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>{sub}</div>
                        )}
                      </div>
                      {/* Amount column */}
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: C.danger,
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        −{Number(e.amount).toLocaleString()} {CURRENCY}
                      </span>
                      {/* Action column */}
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
                  gridTemplateColumns: '80px 1fr 140px 32px',
                  gap: 14,
                  padding: '14px 20px',
                  borderTop: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                  background: C.surfaceElevated,
                }}>
                  <span />
                  <span style={{ color: C.textSecondary }}>Итого</span>
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
