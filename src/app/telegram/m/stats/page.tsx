/** --- YAML
 * name: MasterMiniAppStats
 * description: Master Mini App finance — week/month tabs with revenue + counts + avg check + completion rate + top services. Title stripped (2026-04-19); + Доход / + Расход FABs open MiniBottomSheet forms posting to /api/telegram/m/finance-entry.
 * created: 2026-04-13
 * updated: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Target, Loader2, Award, XCircle, Plus, Minus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MiniBottomSheet } from '@/components/miniapp/bottom-sheet';
import { PageHeader } from '@/components/miniapp/shells';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  paymentMethods: readonly string[];
  expenseCategories: readonly string[];
  defaultExpenseCat: string;
  periodToday: string; periodWeek: string; periodMonth: string;
  income: string; expense: string;
  kpiRevenue: string; kpiBookings: string; kpiAvgCheck: string; kpiCompleted: string;
  kpiCompletedSub: (done: number, total: number) => string;
  noShowText: (n: number) => string; noShowHint: string;
  topServices: string; noData: string; noDataHint: string;
  allOperations: string; opVisit: string; opIncome: string; opExpense: string; opEmpty: string;
  tabIncome: string; tabExpense: string;
  newIncome: string; newExpense: string;
  amountLabel: string; amountPh: string;
  clientLabel: string; clientPh: string; serviceLabel: string; servicePh: string;
  payMethodLabel: string;
  noteLabel: string; notePh: string;
  catLabel: string;
  descLabel: string; descPh: string;
  vendorLabel: string; vendorPh: string;
  saving: string; save: string;
  errInvalidAmount: string; errNoInitData: string; errGeneric: string;
}> = {
  uk: {
    paymentMethods: ['Готівка', 'Картка', 'Переказ'],
    expenseCategories: ['Витратники', 'Оренда', 'Податки', 'Реклама', 'Обладнання', 'Їжа', 'Транспорт', 'Комунальні', 'Інше'],
    defaultExpenseCat: 'Інше',
    periodToday: 'Сьогодні', periodWeek: '7 днів', periodMonth: '30 днів',
    income: 'Дохід', expense: 'Витрата',
    kpiRevenue: 'Виручка', kpiBookings: 'Записів', kpiAvgCheck: 'Середній чек', kpiCompleted: 'Виконано',
    kpiCompletedSub: (d, t) => `${d} із ${t}`,
    noShowText: (n) => `${n} не прийшло`,
    noShowHint: 'Спробуй вимагати передплату для нових клієнтів',
    topServices: 'Топ-послуги', noData: 'Ще немає даних',
    noDataHint: 'Починай приймати клієнтів — статистика зʼявиться автоматично',
    allOperations: 'Усі операції', opVisit: 'Візит', opIncome: 'Дохід', opExpense: 'Витрата',
    opEmpty: 'Поки немає операцій за цей період',
    tabIncome: 'Доходи', tabExpense: 'Витрати',
    newIncome: 'Новий дохід', newExpense: 'Нова витрата',
    amountLabel: 'Сума, ₴', amountPh: '0',
    clientLabel: 'Клієнт (опційно)', clientPh: 'Почни друкувати імʼя',
    serviceLabel: 'Послуга (опційно)', servicePh: 'Почни друкувати назву',
    payMethodLabel: 'Спосіб оплати',
    noteLabel: 'Нотатка', notePh: 'Напр. «постійний клієнт»',
    catLabel: 'Категорія',
    descLabel: 'Опис', descPh: 'Що купив / за що платиш',
    vendorLabel: 'Постачальник (опційно)', vendorPh: 'Магазин / компанія',
    saving: 'Зберігаю…', save: 'Зберегти',
    errInvalidAmount: 'Введи коректну суму', errNoInitData: 'Немає initData', errGeneric: 'Помилка',
  },
  ru: {
    paymentMethods: ['Наличные', 'Карта', 'Перевод'],
    expenseCategories: ['Расходники', 'Аренда', 'Налоги', 'Реклама', 'Оборудование', 'Еда', 'Транспорт', 'Коммунальные', 'Другое'],
    defaultExpenseCat: 'Другое',
    periodToday: 'Сегодня', periodWeek: '7 дней', periodMonth: '30 дней',
    income: 'Доход', expense: 'Расход',
    kpiRevenue: 'Выручка', kpiBookings: 'Записей', kpiAvgCheck: 'Средний чек', kpiCompleted: 'Выполнено',
    kpiCompletedSub: (d, t) => `${d} из ${t}`,
    noShowText: (n) => `${n} не пришло`,
    noShowHint: 'Попробуй требовать предоплату для новых клиентов',
    topServices: 'Топ-услуги', noData: 'Ещё нет данных',
    noDataHint: 'Начни принимать клиентов — статистика появится автоматически',
    allOperations: 'Все операции', opVisit: 'Визит', opIncome: 'Доход', opExpense: 'Расход',
    opEmpty: 'Пока нет операций за этот период',
    tabIncome: 'Доходы', tabExpense: 'Расходы',
    newIncome: 'Новый доход', newExpense: 'Новый расход',
    amountLabel: 'Сумма, ₴', amountPh: '0',
    clientLabel: 'Клиент (опционально)', clientPh: 'Начни печатать имя',
    serviceLabel: 'Услуга (опционально)', servicePh: 'Начни печатать название',
    payMethodLabel: 'Способ оплаты',
    noteLabel: 'Заметка', notePh: 'Напр. «постоянный клиент»',
    catLabel: 'Категория',
    descLabel: 'Описание', descPh: 'Что купил / за что платишь',
    vendorLabel: 'Поставщик (опционально)', vendorPh: 'Магазин / компания',
    saving: 'Сохраняю…', save: 'Сохранить',
    errInvalidAmount: 'Введи корректную сумму', errNoInitData: 'Нет initData', errGeneric: 'Ошибка',
  },
  en: {
    paymentMethods: ['Cash', 'Card', 'Transfer'],
    expenseCategories: ['Supplies', 'Rent', 'Taxes', 'Marketing', 'Equipment', 'Food', 'Transport', 'Utilities', 'Other'],
    defaultExpenseCat: 'Other',
    periodToday: 'Today', periodWeek: '7 days', periodMonth: '30 days',
    income: 'Income', expense: 'Expense',
    kpiRevenue: 'Revenue', kpiBookings: 'Bookings', kpiAvgCheck: 'Avg check', kpiCompleted: 'Completed',
    kpiCompletedSub: (d, t) => `${d} of ${t}`,
    noShowText: (n) => `${n} no-shows`,
    noShowHint: 'Try requiring deposit for new clients',
    topServices: 'Top services', noData: 'No data yet',
    noDataHint: 'Start booking clients — stats will appear automatically',
    allOperations: 'All operations', opVisit: 'Visit', opIncome: 'Income', opExpense: 'Expense',
    opEmpty: 'No operations for this period yet',
    tabIncome: 'Income', tabExpense: 'Expenses',
    newIncome: 'New income', newExpense: 'New expense',
    amountLabel: 'Amount, ₴', amountPh: '0',
    clientLabel: 'Client (optional)', clientPh: 'Start typing a name',
    serviceLabel: 'Service (optional)', servicePh: 'Start typing a name',
    payMethodLabel: 'Payment method',
    noteLabel: 'Note', notePh: 'E.g. «regular client»',
    catLabel: 'Category',
    descLabel: 'Description', descPh: 'What you bought / paid for',
    vendorLabel: 'Vendor (optional)', vendorPh: 'Store / company',
    saving: 'Saving…', save: 'Save',
    errInvalidAmount: 'Enter a valid amount', errNoInitData: 'No initData', errGeneric: 'Error',
  },
};

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch { /* ignore */ }
  return null;
}

type Period = 'today' | 'week' | 'month';

interface AptRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  service_name: string;
}

interface OpRow {
  id: string;
  kind: 'visit' | 'income' | 'expense';
  amount: number;
  label: string;
  sublabel: string | null;
  date: string;
}

export default function MasterMiniAppStats() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AptRow[]>([]);
  const [manualIncomeTotal, setManualIncomeTotal] = useState(0);
  const [operations, setOperations] = useState<OpRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState<null | 'income' | 'expense'>(null);
  // Таб «Доходы» (визит + ручной доход) или «Расходы» (manual_expenses)
  const [opTab, setOpTab] = useState<'income' | 'expense'>('income');

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ initData: initData ?? null, period }),
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      type R = {
        id: string;
        starts_at: string;
        status: string;
        price: number | null;
        service: { name: string } | { name: string }[] | null;
      };
      const mapped: AptRow[] = ((json.appointments ?? []) as R[]).map((r) => {
        const svc = Array.isArray(r.service) ? r.service[0] : r.service;
        return {
          id: r.id,
          starts_at: r.starts_at,
          status: r.status,
          price: Number(r.price ?? 0),
          service_name: svc?.name ?? '—',
        };
      });
      setRows(mapped);
      setManualIncomeTotal(Number(json.manual_income_total ?? 0));
      setOperations((json.operations ?? []) as OpRow[]);
      setLoading(false);
    })();
  }, [userId, period, refreshKey]);

  const kpi = useMemo(() => {
    const active = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'cancelled_by_client' && r.status !== 'no_show');
    const completed = rows.filter((r) => r.status === 'completed');
    const noShow = rows.filter((r) => r.status === 'no_show').length;
    const aptRevenue = completed.reduce((a, r) => a + r.price, 0);
    const revenue = aptRevenue + manualIncomeTotal;
    const avg = completed.length > 0 ? aptRevenue / completed.length : 0;
    const completionRate = active.length > 0 ? Math.round((completed.length / active.length) * 100) : 0;
    return { total: active.length, completed: completed.length, revenue, avg, completionRate, noShow };
  }, [rows, manualIncomeTotal]);

  const topServices = useMemo(() => {
    const byService = new Map<string, { count: number; revenue: number }>();
    for (const r of rows) {
      if (r.status !== 'completed') continue;
      const existing = byService.get(r.service_name) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += r.price;
      byService.set(r.service_name, existing);
    }
    return Array.from(byService.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [rows]);

  const maxRevenue = Math.max(1, ...topServices.map((s) => s.revenue));

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const titleByLang = { uk: 'Фінанси', ru: 'Финансы', en: 'Finance' } as const;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader title={titleByLang[lang]} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="space-y-5 px-5 pt-2 pb-10"
      >
        {/* Period tabs — Today / 7 / 30 */}
        <div className="flex gap-1 rounded-2xl border border-neutral-200 bg-white p-1">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                haptic('light');
                setPeriod(p);
              }}
              className={`flex-1 rounded-xl py-2 text-[12px] font-semibold transition-colors ${
                period === p ? 'bg-white text-black' : 'text-neutral-600'
              }`}
            >
              {p === 'today' ? t.periodToday : p === 'week' ? t.periodWeek : t.periodMonth}
            </button>
          ))}
        </div>

        {/* Income / expense actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { haptic('selection'); setSheetOpen('income'); }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 py-3 text-[13px] font-semibold text-emerald-700 active:bg-emerald-100 transition-colors"
          >
            <Plus className="size-4" /> {t.income}
          </button>
          <button
            onClick={() => { haptic('selection'); setSheetOpen('expense'); }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 active:bg-rose-100 transition-colors"
          >
            <Minus className="size-4" /> {t.expense}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-white border-neutral-200" />
            <div className="h-24 animate-pulse rounded-2xl bg-white border-neutral-200" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={TrendingUp} label={t.kpiRevenue} value={`${kpi.revenue.toFixed(0)}₴`} accent="emerald" />
              <StatCard icon={Calendar} label={t.kpiBookings} value={kpi.total.toString()} accent="violet" />
              <StatCard icon={Target} label={t.kpiAvgCheck} value={`${kpi.avg.toFixed(0)}₴`} accent="amber" />
              <StatCard
                icon={Award}
                label={t.kpiCompleted}
                value={`${kpi.completionRate}%`}
                accent="sky"
                sub={t.kpiCompletedSub(kpi.completed, kpi.total)}
              />
            </div>

            {kpi.noShow > 0 && (
              <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5">
                <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-rose-500" />
                <XCircle className="size-5 text-rose-600" />
                <div>
                  <p className="text-[13px] font-semibold">{t.noShowText(kpi.noShow)}</p>
                  <p className="text-[11px] text-neutral-500">{t.noShowHint}</p>
                </div>
              </div>
            )}

            {topServices.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold">{t.topServices}</h2>
                <ul className="space-y-3">
                  {topServices.map((s) => (
                    <li key={s.name}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="shrink-0 text-neutral-600">
                          {s.count}× · {s.revenue.toFixed(0)}₴
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white border-neutral-200">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full bg-[var(--m-accent)]"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Доходы / Расходы — два таба. Доходы = visit+income, расходы =
                expense. По запросу Данила: «вместо все операции — табы». */}
            <div>
              <div className="mb-3 flex gap-1 rounded-2xl border border-neutral-200 bg-white p-1">
                {(['income', 'expense'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { haptic('light'); setOpTab(tab); }}
                    className={`flex-1 rounded-xl py-2 text-[12px] font-semibold transition-colors ${
                      opTab === tab ? (tab === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700') : 'text-neutral-600'
                    }`}
                  >
                    {tab === 'income' ? t.tabIncome : t.tabExpense}
                  </button>
                ))}
              </div>
              {(() => {
                const filtered = operations.filter((op) =>
                  opTab === 'income'
                    ? (op.kind === 'visit' || op.kind === 'income')
                    : op.kind === 'expense',
                );
                if (filtered.length === 0) {
                  return <p className="text-[12px] text-neutral-500">{t.opEmpty}</p>;
                }
                return (
                  <ul className="space-y-1.5">
                    {filtered.map((op) => {
                      const isDebit = op.kind === 'expense';
                      const tagText = op.kind === 'visit' ? t.opVisit : op.kind === 'income' ? t.opIncome : t.opExpense;
                      const tagBg = op.kind === 'visit' ? 'bg-[var(--m-accent-soft)] text-[var(--m-accent)]'
                        : op.kind === 'income' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700';
                      const dateLabel = new Date(op.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-US' : 'ru-RU', {
                        day: 'numeric', month: 'short',
                      });
                      return (
                        <li
                          key={op.id}
                          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
                        >
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tagBg}`}>
                            {tagText}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{op.label}</p>
                            {op.sublabel && (
                              <p className="truncate text-[11px] text-neutral-500">{op.sublabel}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-[13px] font-bold tabular-nums ${isDebit ? 'text-rose-600' : 'text-neutral-900'}`}>
                              {isDebit ? '−' : '+'}{op.amount.toFixed(0)}₴
                            </p>
                            <p className="text-[10px] text-neutral-400">{dateLabel}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>

            {rows.length === 0 && operations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold">{t.noData}</p>
                <p className="mt-1 text-xs text-neutral-500">{t.noDataHint}</p>
              </div>
            )}
          </>
        )}
      </motion.div>

      <MiniBottomSheet
        open={sheetOpen === 'income'}
        onClose={() => setSheetOpen(null)}
        title={t.newIncome}
      >
        <FinanceEntryForm
          kind="income"
          onSuccess={() => { setSheetOpen(null); setRefreshKey((k) => k + 1); }}
        />
      </MiniBottomSheet>

      <MiniBottomSheet
        open={sheetOpen === 'expense'}
        onClose={() => setSheetOpen(null)}
        title={t.newExpense}
      >
        <FinanceEntryForm
          kind="expense"
          onSuccess={() => { setSheetOpen(null); setRefreshKey((k) => k + 1); }}
        />
      </MiniBottomSheet>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'violet' | 'emerald' | 'amber' | 'sky';
  sub?: string;
}) {
  const accents: Record<string, string> = {
    violet: 'text-[var(--m-accent)]',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    sky: 'text-sky-600',
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <Icon className={`size-4 ${accents[accent]}`} />
      <p className="mt-3 text-xl font-bold text-neutral-900 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-400">{sub}</p>}
    </div>
  );
}

interface ClientOpt { id: string; full_name: string | null; phone: string | null }
interface ServiceOpt { id: string; name: string | null; price: number | null; currency: string | null }

function FinanceEntryForm({
  kind,
  onSuccess,
}: {
  kind: 'income' | 'expense';
  onSuccess: () => void;
}) {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const tForm = I18N[lang];
  const [amount, setAmount] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState(''); // method or vendor
  const [d, setD] = useState(''); // note or description
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);

  // Подгружаем варианты для autocomplete (только в income-режиме нужны).
  useEffect(() => {
    if (kind !== 'income') return;
    const initData = getInitData();
    if (!initData) return;
    fetch('/api/telegram/m/finance-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j?.clients) setClients(j.clients);
      if (j?.services) setServices(j.services);
    }).catch(() => { /* tolerant */ });
  }, [kind]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError(tForm.errInvalidAmount);
      return;
    }
    const initData = getInitData();
    if (!initData) {
      setError(tForm.errNoInitData);
      return;
    }
    setSaving(true);
    const entry = kind === 'income'
      ? { kind: 'income' as const, amount: num, client_name: a, service_name: b, payment_method: c, note: d }
      : { kind: 'expense' as const, amount: num, category: a || tForm.defaultExpenseCat, description: b, vendor: c };
    try {
      const res = await fetch('/api/telegram/m/finance-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, entry }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'save_failed');
      }
      haptic('success');
      onSuccess();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : tForm.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div>
        <label className="text-[11px] uppercase tracking-wide text-neutral-400">{tForm.amountLabel}</label>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tForm.amountPh}
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-neutral-300 tabular-nums"
        />
      </div>

      {kind === 'income' ? (
        <>
          <Autocomplete
            label={tForm.clientLabel}
            value={a}
            onChange={setA}
            placeholder={tForm.clientPh}
            suggestions={clients
              .filter((cl) => cl.full_name)
              .map((cl) => ({
                key: cl.id,
                label: cl.full_name!,
                hint: cl.phone ?? undefined,
                value: cl.full_name!,
              }))}
          />
          <Autocomplete
            label={tForm.serviceLabel}
            value={b}
            onChange={(v, picked) => {
              setB(v);
              // Если мастер выбрал услугу из списка, подставим её цену в поле «Сумма»,
              // если он ещё ничего не вписал.
              if (picked && !amount) {
                const svc = services.find((s) => s.name === v);
                if (svc?.price) setAmount(String(svc.price));
              }
            }}
            placeholder={tForm.servicePh}
            suggestions={services
              .filter((s) => s.name)
              .map((s) => ({
                key: s.id,
                label: s.name!,
                hint: s.price ? `${s.price} ${s.currency ?? '₴'}` : undefined,
                value: s.name!,
              }))}
          />
          <div>
            <label className="text-[11px] uppercase tracking-wide text-neutral-400">{tForm.payMethodLabel}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {tForm.paymentMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setC(m)}
                  className={`rounded-xl border py-2 text-[12px] font-semibold transition-colors ${c === m ? 'border-white/30 bg-neutral-100 text-neutral-900' : 'border-neutral-200 bg-white text-neutral-600 active:bg-neutral-50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Field label={tForm.noteLabel} value={d} onChange={setD} placeholder={tForm.notePh} />
        </>
      ) : (
        <>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-neutral-400">{tForm.catLabel}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tForm.expenseCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setA(cat)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${a === cat ? 'border-white/30 bg-neutral-100 text-neutral-900' : 'border-neutral-200 bg-white text-neutral-600 active:bg-neutral-50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <Field label={tForm.descLabel} value={b} onChange={setB} placeholder={tForm.descPh} />
          <Field label={tForm.vendorLabel} value={c} onChange={setC} placeholder={tForm.vendorPh} />
        </>
      )}

      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-[12px] text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-white py-4 text-[14px] font-bold text-black active:bg-white/90 transition-colors disabled:opacity-50"
      >
        {saving ? tForm.saving : tForm.save}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-300"
      />
    </div>
  );
}

interface Suggestion {
  key: string;
  label: string;
  hint?: string;
  /** Что подставится в поле при клике (по умолчанию label). */
  value?: string;
}

function Autocomplete({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string, picked?: boolean) => void;
  placeholder?: string;
  suggestions: Suggestion[];
}) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Закрываем дропдаун при клике мимо
  useEffect(() => {
    if (!focused) return;
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [focused]);

  useEscapeKey(focused, () => setFocused(false));

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [value, suggestions]);

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-300"
      />
      {focused && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-[#1c1c1c] shadow-xl">
          {filtered.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                onChange(s.value ?? s.label, true);
                setFocused(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] active:bg-neutral-50"
            >
              <span className="truncate">{s.label}</span>
              {s.hint && <span className="shrink-0 text-[11px] text-neutral-400">{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
