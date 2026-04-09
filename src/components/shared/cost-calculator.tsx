/** --- YAML
 * name: CostCalculator
 * description: Per-procedure cost calculator showing material costs, gross profit, and margin
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface RecipeItem {
  item_id: string;
  quantity: number;
}

interface InventoryItem {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  currency: string;
}

interface CostCalculatorProps {
  serviceId: string;
  servicePrice: number;
  inventoryRecipe: RecipeItem[];
  masterId: string;
}

interface CostLine {
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  subtotal: number;
}

export function CostCalculator({ serviceId, servicePrice, inventoryRecipe, masterId }: CostCalculatorProps) {
  const t = useTranslations('finance');
  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState<CostLine[]>([]);

  useEffect(() => {
    if (!expanded || inventoryRecipe.length === 0) return;

    async function load() {
      const supabase = createClient();
      const itemIds = inventoryRecipe.map((r) => r.item_id);
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, cost_per_unit, unit, currency')
        .in('id', itemIds);

      const items = (data ?? []) as InventoryItem[];
      const itemMap = new Map(items.map((i) => [i.id, i]));

      const costLines: CostLine[] = inventoryRecipe
        .map((r) => {
          const item = itemMap.get(r.item_id);
          if (!item) return null;
          return {
            name: item.name,
            quantity: r.quantity,
            unit: item.unit,
            costPerUnit: item.cost_per_unit,
            subtotal: r.quantity * item.cost_per_unit,
          };
        })
        .filter(Boolean) as CostLine[];

      setLines(costLines);
    }
    load();
  }, [expanded, inventoryRecipe, masterId, serviceId]);

  const totalCost = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const grossProfit = servicePrice - totalCost;
  const margin = servicePrice > 0 ? (grossProfit / servicePrice) * 100 : 0;

  const marginColor = margin >= 60 ? 'text-emerald-600' : margin >= 30 ? 'text-amber-600' : 'text-red-600';
  const marginBg = margin >= 60
    ? 'bg-emerald-50 dark:bg-emerald-950'
    : margin >= 30
      ? 'bg-amber-50 dark:bg-amber-950'
      : 'bg-red-50 dark:bg-red-950';

  if (inventoryRecipe.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          {t('profitability')}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t px-3 py-3 space-y-2"
        >
          {/* Cost lines */}
          {lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {line.name} ({line.quantity} {line.unit} x {line.costPerUnit})
              </span>
              <span className="font-medium">{line.subtotal.toFixed(2)}</span>
            </div>
          ))}

          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('materialCost')}</span>
              <span className="font-medium">{totalCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('revenue')}</span>
              <span className="font-medium">{servicePrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{t('profit')}</span>
              <span className={grossProfit < 0 ? 'text-red-600' : ''}>
                {grossProfit.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Margin badge */}
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', marginColor, marginBg)}>
              {margin < 30 && <AlertTriangle className="h-3 w-3" />}
              {margin.toFixed(0)}% {t('margin')}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Service profitability ranking for the finance dashboard
 */
interface ServiceProfitability {
  name: string;
  price: number;
  cost: number;
  margin: number;
}

export function ProfitabilityRanking({ masterId }: { masterId: string }) {
  const t = useTranslations('finance');
  const [services, setServices] = useState<ServiceProfitability[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: servicesData } = await supabase
        .from('services')
        .select('name, price, inventory_recipe')
        .eq('master_id', masterId)
        .eq('is_active', true);

      if (!servicesData) return;

      // Gather all item IDs
      const allItemIds = new Set<string>();
      for (const s of servicesData) {
        const recipe = (s.inventory_recipe ?? []) as RecipeItem[];
        for (const r of recipe) allItemIds.add(r.item_id);
      }

      // Fetch costs
      const itemMap = new Map<string, number>();
      if (allItemIds.size > 0) {
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, cost_per_unit')
          .in('id', Array.from(allItemIds));
        for (const item of items ?? []) {
          itemMap.set(item.id, item.cost_per_unit ?? 0);
        }
      }

      const result: ServiceProfitability[] = servicesData.map((s) => {
        const recipe = (s.inventory_recipe ?? []) as RecipeItem[];
        const cost = recipe.reduce((sum, r) => sum + r.quantity * (itemMap.get(r.item_id) ?? 0), 0);
        const price = s.price ?? 0;
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        return { name: s.name, price, cost, margin };
      });

      result.sort((a, b) => b.margin - a.margin);
      setServices(result);
    }
    load();
  }, [masterId]);

  if (services.length === 0) return null;

  const maxPrice = Math.max(...services.map((s) => s.price), 1);

  return (
    <div className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="mb-3 text-sm font-semibold">{t('profitabilityRanking')}</h3>
      <div className="space-y-2">
        {services.map((s, i) => {
          const barColor = s.margin >= 60
            ? 'bg-emerald-500'
            : s.margin >= 30
              ? 'bg-amber-500'
              : 'bg-red-500';
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium">{s.name}</span>
                <span className={cn(
                  'text-[10px] font-bold',
                  s.margin >= 60 ? 'text-emerald-600' : s.margin >= 30 ? 'text-amber-600' : 'text-red-600',
                )}>
                  {s.margin.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${(s.price / maxPrice) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
