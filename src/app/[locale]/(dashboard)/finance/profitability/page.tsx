/** --- YAML
 * name: Service Profitability Report
 * description: Real profit per service — material cost from inventory recipe vs revenue, sorted by margin.
 * created: 2026-04-12
 * updated: 2026-04-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useFxRates, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/hooks/use-fx-rates';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer, cardStyle, headingStyle, labelStyle } from '@/lib/dashboard-theme';

type RecipeItem = { item_id: string; quantity: number };
type Service = { id: string; name: string; price: number | null; inventory_recipe: RecipeItem[] | null };
type InventoryItem = { id: string; name: string; cost_per_unit: number | null; unit: string | null };
type Row = {
  id: string;
  name: string;
  price: number;
  cost: number;
  profit: number;
  margin: number;
  lines: { name: string; quantity: number; unit: string; costPerUnit: number; subtotal: number }[];
};

export default function ProfitabilityReportPage() {
  const { C } = usePageTheme();
  const supabase = createClient();
  const { master } = useMaster();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('UAH');
  const { convert, date: ratesDate, ready: fxReady } = useFxRates();

  const fmt = useCallback(
    (amount: number) => {
      const v = convert(amount, 'UAH', displayCurrency);
      return `${v.toFixed(2)} ${displayCurrency === 'UAH' ? CURRENCY : displayCurrency}`;
    },
    [convert, displayCurrency],
  );

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
          return {
            name: it.name,
            quantity: r.quantity,
            unit: it.unit ?? '',
            costPerUnit,
            subtotal: r.quantity * costPerUnit,
          };
        })
        .filter(Boolean) as Row['lines'];
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

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const price = rows.reduce((a, r) => a + r.price, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { price, cost, profit, margin };
  }, [rows]);

  function marginColor(margin: number): string {
    if (margin >= 60) return C.success;
    if (margin >= 30) return C.warning;
    return C.danger;
  }

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ ...headingStyle(C), display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={22} style={{ color: C.accent }} />
            Реальная прибыль по услугам
          </h1>
          <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 6 }}>
            Себестоимость рассчитывается из техкарты услуги × стоимость единицы из склада.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as SupportedCurrency)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              border: `1px solid ${C.border}`, background: C.surface, color: C.text,
              fontFamily: FONT, outline: 'none', cursor: 'pointer',
            }}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span style={{ fontSize: 10, color: C.textTertiary }}>
            {fxReady ? `курс на ${ratesDate}` : 'курс не загружен'}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard C={C} label="Услуг" value={rows.length.toString()} />
        <StatCard C={C} label="Выручка" value={fmt(totals.price)} />
        <StatCard C={C} label="Себестоимость" value={fmt(totals.cost)} />
        <StatCard C={C} label="Средняя маржа" value={`${totals.margin.toFixed(0)}%`} color={marginColor(totals.margin)} />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: 13, color: C.textSecondary }}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSecondary }}>Нет активных услуг. Добавь услуги на /services.</p>
      ) : (
        <div style={{ ...cardStyle(C), padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Услуга', 'Цена', 'Себестоимость', 'Прибыль', 'Маржа'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 11, fontWeight: 510, color: C.textTertiary, textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em', background: C.surfaceElevated,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: `1px solid ${C.border}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 510, fontSize: 13, color: C.text }}>{r.name}</div>
                    {r.lines.length > 0 ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: C.textTertiary }}>
                        {r.lines.map((l, i) => (
                          <span key={i}>
                            {i > 0 ? ' · ' : ''}
                            {l.name} ({l.quantity} {l.unit})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: 11, color: C.textTertiary }}>Нет техкарты</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 510, fontSize: 13, color: C.text }}>{fmt(r.price)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.textSecondary }}>{fmt(r.cost)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: r.profit < 0 ? C.danger : C.text }}>
                    {fmt(r.profit)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: marginColor(r.margin) }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {r.margin < 30 && <AlertTriangle size={12} />}
                      {r.margin.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ C, label, value, color }: { C: any; label: string; value: string; color?: string }) {
  return (
    <div style={{ ...cardStyle(C) }}>
      <div style={{ ...labelStyle(C) }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: color || C.text }}>{value}</div>
    </div>
  );
}
