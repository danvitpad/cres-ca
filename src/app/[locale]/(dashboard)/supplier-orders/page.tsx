/** --- YAML
 * name: Supplier orders
 * description: Страница заказов поставщикам: низкие остатки → рекомендации по поставщикам → одним кликом создать draft
 *              → скачать PDF-накладную. История всех заказов со статусом.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Package, AlertTriangle, CheckCircle2, Clock, Truck, XCircle, FileDown, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface RecItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  threshold: number;
  shortfall: number;
  cost_per_unit: number;
}

interface RecGroup {
  supplier_id: string | null;
  supplier_name: string;
  items: RecItem[];
}

interface OrderRow {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';
  total_cost: number;
  currency: string;
  created_at: string;
  items: Array<{ name: string; quantity: number }>;
}

const STATUS_LABEL: Record<OrderRow['status'], string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  confirmed: 'Подтверждён',
  delivered: 'Получен',
  cancelled: 'Отменён',
};

const STATUS_ICON: Record<OrderRow['status'], typeof Clock> = {
  draft: Clock,
  sent: Truck,
  confirmed: CheckCircle2,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [sendingTg, setSendingTg] = useState<string | null>(null);

  async function sendViaTelegram(orderId: string) {
    setSendingTg(orderId);
    try {
      const res = await fetch(`/api/supplier-orders/${orderId}/send-telegram`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.error === 'supplier_telegram_missing') {
          toast.error('У поставщика не указан Telegram ID — добавьте его в разделе «Склад → Поставщики».');
        } else if (j.error === 'no_supplier') {
          toast.error('К заказу не привязан поставщик.');
        } else {
          toast.error(j.error || 'Ошибка отправки');
        }
        return;
      }
      toast.success('Заказ отправлен в Telegram');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingTg(null);
    }
  }

  async function load() {
    const res = await fetch('/api/supplier-orders');
    if (res.ok) {
      const j = await res.json();
      setOrders(j.orders ?? []);
      setRecommendations(j.recommendations ?? []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createOrder(group: RecGroup) {
    setCreating(group.supplier_id ?? '__none__');
    try {
      const res = await fetch('/api/supplier-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: group.supplier_id,
          items: group.items.map((it) => ({
            name: it.name,
            quantity: it.shortfall,
            unit: it.unit,
            unit_price: it.cost_per_unit,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Ошибка');
      }
      const { id } = await res.json();
      toast.success('Заказ создан');
      window.open(`/api/supplier-orders/${id}/pdf`, '_blank');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Package className="size-6 text-primary" />
          Заказы поставщикам
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Низкие остатки → рекомендации по поставщикам → одним кликом черновик + PDF.
        </p>
      </div>

      {recommendations.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="size-4 text-amber-500" />
            Требуется пополнение ({recommendations.reduce((s, g) => s + g.items.length, 0)})
          </h2>
          <div className="space-y-3">
            {recommendations.map((group) => (
              <div
                key={group.supplier_id ?? 'none'}
                className="rounded-2xl border border-amber-500/20 bg-amber-50/30 p-5 dark:bg-amber-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{group.supplier_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? 'позиция' : 'позиций'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => createOrder(group)}
                    disabled={creating === (group.supplier_id ?? '__none__')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    <FileDown className="size-3.5" />
                    {creating === (group.supplier_id ?? '__none__') ? 'Создание…' : 'Сформировать заказ'}
                  </button>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {group.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                      <span>{it.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {it.quantity} / {it.threshold} {it.unit} → +{it.shortfall} {it.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">История заказов</h2>
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Заказов пока нет
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Поставщик</th>
                  <th className="px-4 py-3 text-left font-medium">Статус</th>
                  <th className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const Icon = STATUS_ICON[o.status];
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {o.supplier_name ?? <span className="text-muted-foreground">—</span>}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {o.items.length} поз.
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Icon className="size-3.5" />
                          {STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {o.total_cost.toLocaleString()} {o.currency}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {o.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => sendViaTelegram(o.id)}
                              disabled={sendingTg === o.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10 disabled:opacity-50"
                            >
                              <Send className="size-3.5" />
                              {sendingTg === o.id ? '…' : 'TG'}
                            </button>
                          )}
                          <a
                            href={`/api/supplier-orders/${o.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Download className="size-3.5" />
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
