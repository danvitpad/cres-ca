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
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

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

const PAYMENT_METHODS = ['Наличные', 'Карта', 'Перевод'] as const;
const EXPENSE_CATEGORIES = ['Расходники', 'Аренда', 'Налоги', 'Реклама', 'Оборудование', 'Еда', 'Транспорт', 'Коммунальные', 'Другое'] as const;

export default function MasterMiniAppStats() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AptRow[]>([]);
  const [manualIncomeTotal, setManualIncomeTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState<null | 'income' | 'expense'>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const initData = getInitData();
      if (!initData) { setLoading(false); return; }
      const res = await fetch('/api/telegram/m/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, period }),
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-5 px-5 pt-6 pb-10"
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
              {p === 'today' ? 'Сегодня' : p === 'week' ? '7 дней' : '30 дней'}
            </button>
          ))}
        </div>

        {/* Income / expense actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { haptic('selection'); setSheetOpen('income'); }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 py-3 text-[13px] font-semibold text-emerald-700 active:bg-emerald-100 transition-colors"
          >
            <Plus className="size-4" /> Доход
          </button>
          <button
            onClick={() => { haptic('selection'); setSheetOpen('expense'); }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 active:bg-rose-100 transition-colors"
          >
            <Minus className="size-4" /> Расход
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
              <StatCard icon={TrendingUp} label="Выручка" value={`${kpi.revenue.toFixed(0)}₴`} accent="emerald" />
              <StatCard icon={Calendar} label="Записей" value={kpi.total.toString()} accent="violet" />
              <StatCard icon={Target} label="Средний чек" value={`${kpi.avg.toFixed(0)}₴`} accent="amber" />
              <StatCard
                icon={Award}
                label="Выполнено"
                value={`${kpi.completionRate}%`}
                accent="sky"
                sub={`${kpi.completed} из ${kpi.total}`}
              />
            </div>

            {kpi.noShow > 0 && (
              <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5">
                <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-rose-500" />
                <XCircle className="size-5 text-rose-600" />
                <div>
                  <p className="text-[13px] font-semibold">{kpi.noShow} не пришло</p>
                  <p className="text-[11px] text-neutral-500">Попробуй требовать предоплату для новых клиентов</p>
                </div>
              </div>
            )}

            {topServices.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold">Топ-услуги</h2>
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
                          className="h-full rounded-full bg-violet-500"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold">Ещё нет данных</p>
                <p className="mt-1 text-xs text-neutral-500">Начни принимать клиентов — статистика появится автоматически</p>
              </div>
            )}
          </>
        )}
      </motion.div>

      <MiniBottomSheet
        open={sheetOpen === 'income'}
        onClose={() => setSheetOpen(null)}
        title="Новый доход"
      >
        <FinanceEntryForm
          kind="income"
          onSuccess={() => { setSheetOpen(null); setRefreshKey((k) => k + 1); }}
        />
      </MiniBottomSheet>

      <MiniBottomSheet
        open={sheetOpen === 'expense'}
        onClose={() => setSheetOpen(null)}
        title="Новый расход"
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
    violet: 'text-violet-600',
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
      setError('Введи корректную сумму');
      return;
    }
    const initData = getInitData();
    if (!initData) {
      setError('Нет initData');
      return;
    }
    setSaving(true);
    const entry = kind === 'income'
      ? { kind: 'income' as const, amount: num, client_name: a, service_name: b, payment_method: c, note: d }
      : { kind: 'expense' as const, amount: num, category: a || 'Другое', description: b, vendor: c };
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
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div>
        <label className="text-[11px] uppercase tracking-wide text-neutral-400">Сумма, ₴</label>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-neutral-300 tabular-nums"
        />
      </div>

      {kind === 'income' ? (
        <>
          <Autocomplete
            label="Клиент (опционально)"
            value={a}
            onChange={setA}
            placeholder="Начни печатать имя"
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
            label="Услуга (опционально)"
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
            placeholder="Начни печатать название"
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
            <label className="text-[11px] uppercase tracking-wide text-neutral-400">Способ оплаты</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
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
          <Field label="Заметка" value={d} onChange={setD} placeholder="Напр. «постоянный клиент»" />
        </>
      ) : (
        <>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-neutral-400">Категория</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
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
          <Field label="Описание" value={b} onChange={setB} placeholder="Что купил / за что платишь" />
          <Field label="Поставщик (опционально)" value={c} onChange={setC} placeholder="Магазин / компания" />
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
        {saving ? 'Сохраняю…' : 'Сохранить'}
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
