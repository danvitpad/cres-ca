/** --- YAML
 * name: ServicesTab
 * description: Merged profitability + cost calculator — service table with expandable cost breakdown from inventory_recipe.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useFxRates, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/hooks/use-fx-rates';
import {
  type PageTheme,
  FONT, FONT_FEATURES, CURRENCY,
  cardStyle, labelStyle,
} from '@/lib/dashboard-theme';

/* ─── Types ─── */

type RecipeItem = { item_id: string; quantity: number };
type Service = { id: string; name: string; price: number | null; inventory_recipe: RecipeItem[] | null };
type InventoryItem = { id: string; name: string; cost_per_unit: number | null; unit: string | null };
type Line = { name: string; quantity: number; unit: string; costPerUnit: number; subtotal: number };
type Row = { id: string; name: string; price: number; cost: number; profit: number; margin: number; lines: Line[] };

/* ─── Component ─── */

export function ServicesTab({ C }: { C: PageTheme }) {
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('UAH');
  const { convert, date: ratesDate, ready: fxReady } = useFxRates();

  const fmt = useCallback(
    (amount: number) => {
      const v = convert(amount, 'UAH', displayCurrency);
      return `${v.toFixed(2)} ${displayCurrency === 'UAH' ? CURRENCY : displayCurrency}`;
    },
    [convert, displayCurrency],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* ─── Data loading ─── */

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);

    const { data: services } = await supabase
      .from('services')
      .select('id, name, price, inventory_recipe')
      .eq('master_id', master.id)
      .eq('is_active', true);

    const svcs = (services as Service[] | null) ?? [];

    const itemIds = new Set<string>();
    for (const s of svcs) for (const r of s.inventory_recipe ?? []) itemIds.add(r.item_id);

    const itemMap = new Map<string, InventoryItem>();
    if (itemIds.size > 0) {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, cost_per_unit, unit')
        .in('id', Array.from(itemIds));
      for (const it of (items as InventoryItem[] | null) ?? []) itemMap.set(it.id, it);
    }

    const computed: Row[] = svcs.map((s) => {
      const recipe = s.inventory_recipe ?? [];
      const lines = recipe
        .map((r) => {
          const it = itemMap.get(r.item_id);
          if (!it) return null;
          const costPerUnit = Number(it.cost_per_unit ?? 0);
          return { name: it.name, quantity: r.quantity, unit: it.unit ?? '', costPerUnit, subtotal: r.quantity * costPerUnit };
        })
        .filter(Boolean) as Line[];
      const cost = lines.reduce((a, l) => a + l.subtotal, 0);
      const price = Number(s.price ?? 0);
      const profit = price - cost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      return { id: s.id, name: s.name, price, cost, profit, margin, lines };
    });

    computed.sort((a, b) => b.margin - a.margin);
    setRows(computed);
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => { load(); }, [load]);

  /* ─── Derived stats ─── */

  const totals = useMemo(() => {
    const price = rows.reduce((a, r) => a + r.price, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { price, cost, profit, margin };
  }, [rows]);

  function marginColor(m: number): string {
    if (m >= 60) return C.success;
    if (m >= 30) return C.warning;
    return C.danger;
  }

  /* ─── Styles ─── */

  const thStyle = (align: 'left' | 'right'): React.CSSProperties => ({
    padding: '10px 16px', textAlign: align,
    fontSize: 11, fontWeight: 510, color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: '0.04em', background: C.surfaceElevated,
  });

  const tdStyle = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({
    padding: '12px 16px', textAlign: align, fontSize: 13,
  });

  /* ─── Render ─── */

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
      {/* Currency selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 4, alignItems: 'center' }}>
        <select
          value={displayCurrency}
          onChange={(e) => setDisplayCurrency(e.target.value as SupportedCurrency)}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${C.border}`, background: C.surface, color: C.text,
            fontFamily: FONT, outline: 'none', cursor: 'pointer',
          }}
        >
          {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 10, color: C.textTertiary }}>
          {fxReady ? `курс на ${ratesDate}` : 'курс не загружен'}
        </span>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Услуг', value: rows.length.toString() },
          { label: 'Выручка (потенц.)', value: fmt(totals.price) },
          { label: 'Себестоимость', value: fmt(totals.cost) },
          { label: 'Средняя маржа', value: `${totals.margin.toFixed(0)}%`, color: marginColor(totals.margin) },
        ].map((card) => (
          <div key={card.label} style={{ ...cardStyle(C) }}>
            <div style={{ ...labelStyle(C) }}>{card.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: card.color || C.text }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: 13, color: C.textSecondary }}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSecondary }}>
          Добавьте услуги в каталоге, чтобы увидеть рентабельность
        </p>
      ) : (
        <div style={{ ...cardStyle(C), padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...thStyle('left'), width: 28 }} />
                {['Услуга', 'Цена', 'Себестоимость', 'Прибыль', 'Маржа'].map((h, i) => (
                  <th key={h} style={thStyle(i === 0 ? 'left' : 'right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      style={{ borderTop: `1px solid ${C.border}`, cursor: r.lines.length > 0 ? 'pointer' : 'default', transition: 'background 0.1s' }}
                      onClick={() => r.lines.length > 0 && toggle(r.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Chevron */}
                      <td style={{ padding: '12px 8px 12px 16px', width: 28 }}>
                        {r.lines.length > 0 && (
                          <motion.span
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'inline-flex', color: C.textTertiary }}
                          >
                            <ChevronDown size={14} />
                          </motion.span>
                        )}
                      </td>

                      <td style={{ ...tdStyle('left'), fontWeight: 510, color: C.text }}>{r.name}</td>
                      <td style={{ ...tdStyle(), fontWeight: 510, color: C.text }}>{fmt(r.price)}</td>
                      <td style={{ ...tdStyle(), color: C.textSecondary }}>{fmt(r.cost)}</td>
                      <td style={{ ...tdStyle(), fontWeight: 600, color: r.profit < 0 ? C.danger : C.text }}>{fmt(r.profit)}</td>
                      <td style={{ ...tdStyle(), fontWeight: 600, color: marginColor(r.margin) }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {r.margin < 30 && <AlertTriangle size={12} />}
                          {r.margin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>

                    {/* Expandable cost breakdown */}
                    <AnimatePresence>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: 'hidden', background: C.surfaceElevated }}
                            >
                              <div style={{ padding: '12px 16px 12px 58px' }}>
                                <div style={{ fontSize: 11, fontWeight: 510, color: C.textTertiary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Техкарта
                                </div>
                                {r.lines.map((l, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 8,
                                      padding: '4px 0', fontSize: 12, color: C.textSecondary,
                                      borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
                                    }}
                                  >
                                    <span style={{ color: C.text }}>{l.name}</span>
                                    <span style={{ textAlign: 'right' }}>{l.quantity} {l.unit}</span>
                                    <span style={{ textAlign: 'right' }}>{fmt(l.costPerUnit)}/{l.unit || 'ед.'}</span>
                                    <span style={{ textAlign: 'right', fontWeight: 510, color: C.text }}>{fmt(l.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
