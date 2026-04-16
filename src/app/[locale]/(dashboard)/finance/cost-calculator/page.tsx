/** --- YAML
 * name: CostCalculatorPage
 * description: Detailed per-procedure cost calculator — shows material breakdown from inventory_recipe, calculates profit margin, highlights problem services
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { cn } from '@/lib/utils';

/* ── types ─────────────────────────────────────────────── */

type RecipeItem = { item_id: string; quantity: number };

type ServiceRaw = {
  id: string;
  name: string;
  price: number | null;
  inventory_recipe: RecipeItem[] | null;
};

type InvItem = {
  id: string;
  name: string;
  cost_per_unit: number | null;
  unit: string | null;
};

type CostLine = {
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  subtotal: number;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  materialsCost: number;
  profit: number;
  margin: number;
  lines: CostLine[];
};

/* ── theme tokens (Linear-style) ───────────────────────── */

const LIGHT = {
  bg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '#e5e5e5',
  text: '#0d0d0d',
  textMuted: '#737373',
  textLight: '#a3a3a3',
  accent: '#6950f3',
  accentSoft: '#f0f0ff',
  green: '#10b981',
  greenBg: 'rgba(16,185,129,0.08)',
  yellow: '#f59e0b',
  yellowBg: 'rgba(245,158,11,0.08)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.08)',
  tableBg: '#000000',
  tableText: '#f0f0f0',
  tableTextMuted: '#b3b3b3',
  tableBorder: '#2a2a2a',
  rowHover: '#111111',
};

const DARK = {
  bg: '#000000',
  cardBg: '#0a0a0a',
  cardBorder: '#1a1a1a',
  text: '#f0f0f0',
  textMuted: '#b3b3b3',
  textLight: '#666666',
  accent: '#8b7cf6',
  accentSoft: 'rgba(105,80,243,0.15)',
  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.1)',
  yellow: '#fbbf24',
  yellowBg: 'rgba(251,191,36,0.1)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.1)',
  tableBg: '#000000',
  tableText: '#f0f0f0',
  tableTextMuted: '#b3b3b3',
  tableBorder: '#1a1a1a',
  rowHover: '#0a0a0a',
};

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/* ── page ──────────────────────────────────────────────── */

export default function CostCalculatorPage() {
  const t = useTranslations('finance');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  const { master, loading: masterLoading } = useMaster();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();

    const { data: services } = await supabase
      .from('services')
      .select('id, name, price, inventory_recipe')
      .eq('master_id', master.id)
      .eq('is_active', true);

    const svcs = (services as ServiceRaw[] | null) ?? [];

    // Collect all inventory item IDs
    const itemIds = new Set<string>();
    for (const s of svcs) {
      for (const r of s.inventory_recipe ?? []) itemIds.add(r.item_id);
    }

    // Fetch inventory items
    const itemMap = new Map<string, InvItem>();
    if (itemIds.size > 0) {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, cost_per_unit, unit')
        .in('id', Array.from(itemIds));
      for (const it of (items as InvItem[] | null) ?? []) itemMap.set(it.id, it);
    }

    // Compute rows
    const computed: ServiceRow[] = svcs.map((s) => {
      const recipe = s.inventory_recipe ?? [];
      const lines: CostLine[] = recipe
        .map((r) => {
          const it = itemMap.get(r.item_id);
          if (!it) return null;
          const costPerUnit = Number(it.cost_per_unit ?? 0);
          return {
            name: it.name,
            quantity: r.quantity,
            unit: it.unit ?? 'шт',
            costPerUnit,
            subtotal: r.quantity * costPerUnit,
          };
        })
        .filter(Boolean) as CostLine[];

      const materialsCost = lines.reduce((a, l) => a + l.subtotal, 0);
      const price = Number(s.price ?? 0);
      const profit = price - materialsCost;
      const margin = price > 0 ? (profit / price) * 100 : 0;

      return { id: s.id, name: s.name, price, materialsCost, profit, margin, lines };
    });

    computed.sort((a, b) => a.margin - b.margin); // worst margin first
    setRows(computed);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── summary stats ───────────────────────────────────── */

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const totalPrice = rows.reduce((a, r) => a + r.price, 0);
    const totalCost = rows.reduce((a, r) => a + r.materialsCost, 0);
    const avgMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

    const sorted = [...rows].sort((a, b) => b.margin - a.margin);
    const mostProfitable = sorted[0];
    const leastProfitable = sorted[sorted.length - 1];

    return { avgMargin, mostProfitable, leastProfitable, totalPrice, totalCost };
  }, [rows]);

  /* ── helpers ─────────────────────────────────────────── */

  function marginColor(margin: number) {
    if (margin >= 50) return C.green;
    if (margin >= 30) return C.yellow;
    return C.red;
  }

  function marginBg(margin: number) {
    if (margin >= 50) return C.greenBg;
    if (margin >= 30) return C.yellowBg;
    return C.redBg;
  }

  function marginLabel(margin: number) {
    if (margin >= 50) return 'Отличная маржа';
    if (margin >= 30) return 'Средняя маржа';
    return 'Низкая маржа';
  }

  if (masterLoading || loading) {
    return (
      <div style={{ fontFamily: FONT, color: C.text, padding: 24 }}>
        <div style={{ fontSize: 14, color: C.textMuted }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, color: C.text, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={24} style={{ color: C.accent }} />
            Калькулятор себестоимости
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 6 }}>
            Реальная стоимость каждой процедуры на основе расходников из техкарты
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 12,
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <Package size={40} style={{ color: C.textLight, marginBottom: 12, display: 'inline-block' }} />
          <p style={{ fontSize: 14, color: C.textMuted }}>
            Нет активных услуг с техкартой. Добавь услуги и укажи расходники в настройках услуги.
          </p>
        </div>
      ) : (
        <>
          {/* Service cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {rows.map((row, idx) => {
              const isExpanded = expandedId === row.id;
              const mColor = marginColor(row.margin);
              const mBg = marginBg(row.margin);

              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{
                    background: C.tableBg,
                    border: `1px solid ${C.tableBorder}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {/* Service header row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 100px 100px 120px 32px',
                      alignItems: 'center',
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.tableText,
                      textAlign: 'left',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{row.name}</div>
                      <div style={{ fontSize: 11, color: C.tableTextMuted, marginTop: 2 }}>
                        {row.lines.length > 0
                          ? `${row.lines.length} материал${row.lines.length > 1 ? 'ов' : ''}`
                          : 'Нет техкарты'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: C.tableTextMuted }}>Цена</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{row.price.toFixed(0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: C.tableTextMuted }}>Расход</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{row.materialsCost.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: C.tableTextMuted }}>Прибыль</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: row.profit < 0 ? C.red : C.tableText }}>
                        {row.profit.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          color: mColor,
                          background: mBg,
                        }}
                      >
                        {row.margin < 30 && <AlertTriangle size={12} />}
                        {row.margin.toFixed(0)}%
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      style={{
                        color: C.tableTextMuted,
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>

                  {/* Expanded recipe details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          style={{
                            borderTop: `1px solid ${C.tableBorder}`,
                            padding: '16px 20px',
                          }}
                        >
                          {row.lines.length === 0 ? (
                            <p style={{ fontSize: 13, color: C.tableTextMuted }}>
                              Техкарта пуста. Укажите расходники в настройках услуги.
                            </p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                                  <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.tableTextMuted }}>
                                    Материал
                                  </th>
                                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 500, color: C.tableTextMuted }}>
                                    Расход
                                  </th>
                                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 500, color: C.tableTextMuted }}>
                                    Цена за ед.
                                  </th>
                                  <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 500, color: C.tableTextMuted }}>
                                    Итого
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.lines.map((line, li) => (
                                  <tr key={li} style={{ borderBottom: `1px solid ${C.tableBorder}` }}>
                                    <td style={{ padding: '10px 0', fontSize: 13, color: C.tableText }}>
                                      {line.name}
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, color: C.tableText }}>
                                      {line.quantity} {line.unit}
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, color: C.tableTextMuted }}>
                                      {line.costPerUnit.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.tableText }}>
                                      {line.subtotal.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={3} style={{ padding: '12px 0', fontSize: 13, fontWeight: 600, color: C.tableText }}>
                                    Итого себестоимость
                                  </td>
                                  <td style={{ padding: '12px 0', textAlign: 'right', fontSize: 14, fontWeight: 700, color: C.tableText }}>
                                    {row.materialsCost.toFixed(2)} UAH
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          )}

                          {/* Mini margin bar */}
                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                background: C.tableBorder,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, row.margin))}%`,
                                  height: '100%',
                                  borderRadius: 3,
                                  background: mColor,
                                  transition: 'width 0.3s',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, color: mColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {marginLabel(row.margin)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Summary section */}
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginBottom: 32,
              }}
            >
              {/* Average margin */}
              <div
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 12,
                  padding: '20px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <DollarSign size={14} style={{ color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                    Средняя маржа
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: marginColor(summary.avgMargin),
                  }}
                >
                  {summary.avgMargin.toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  по {rows.length} активным услугам
                </div>
              </div>

              {/* Most profitable */}
              <div
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 12,
                  padding: '20px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp size={14} style={{ color: C.green }} />
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                    Самая прибыльная
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {summary.mostProfitable.name}
                </div>
                <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: 4 }}>
                  {summary.mostProfitable.margin.toFixed(0)}% маржа
                  <span style={{ color: C.textMuted, fontWeight: 400 }}>
                    {' '}({summary.mostProfitable.profit.toFixed(0)} UAH прибыль)
                  </span>
                </div>
              </div>

              {/* Least profitable */}
              <div
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 12,
                  padding: '20px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingDown size={14} style={{ color: C.red }} />
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                    Наименее прибыльная
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {summary.leastProfitable.name}
                </div>
                <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginTop: 4 }}>
                  {summary.leastProfitable.margin.toFixed(0)}% маржа
                  {summary.leastProfitable.margin < 30 && (
                    <span style={{ color: C.textMuted, fontWeight: 400 }}>
                      {' '} — рекомендуем пересмотреть цену
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
