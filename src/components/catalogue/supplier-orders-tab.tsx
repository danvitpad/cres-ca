/** --- YAML
 * name: SupplierOrdersTab
 * description: Supplier orders list in Catalogue — draft/sent/confirmed/delivered/cancelled. Reads `supplier_orders` (Phase 2).
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, CURRENCY } from '@/lib/dashboard-theme';
import { EmptyState } from '@/components/shared/primitives/empty-state';

type OrderStatus = 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

interface OrderRow {
  id: string;
  status: OrderStatus;
  total_cost: number;
  currency: string;
  items: unknown[];
  created_at: string;
  supplier: { name: string } | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  confirmed: 'Подтверждён',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

export function SupplierOrdersTab() {
  const { C } = usePageTheme();
  const { master } = useMaster();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('supplier_orders')
      .select('id, status, total_cost, currency, items, created_at, supplier:suppliers(name)')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders((data as unknown as OrderRow[]) || []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: OrderStatus) =>
    s === 'delivered' ? C.success :
      s === 'cancelled' ? C.danger :
        s === 'confirmed' ? C.accent :
          s === 'sent' ? C.warning : C.textTertiary;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Заказы поставщикам</h2>
          <p style={{ fontSize: 12, color: C.textTertiary, margin: '4px 0 0 0' }}>
            Отслеживайте статус и стоимость пополнений склада
          </p>
        </div>
        <button
          onClick={() => toast.info('Создание заказа поставщику — появится в следующей итерации')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: C.accent, color: '#fff',
            fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Новый заказ
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.textTertiary, fontSize: 13 }}>Загрузка...</div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Truck size={28} />}
          title="Нет заказов"
          description="Создавайте заказы на расходники у поставщиков — отслеживайте статус, стоимость и автоматическое пополнение склада при доставке."
        />
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {orders.map((o, i) => {
            const dateStr = new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            return (
              <div
                key={o.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 140px 120px',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderBottom: i < orders.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 550, color: C.text }}>
                    {o.supplier?.name || 'Поставщик не указан'}
                  </div>
                  <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                    {(o.items || []).length} позиций
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: statusColor(o.status),
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {STATUS_LABEL[o.status]}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: C.text,
                  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                }}>
                  {Number(o.total_cost).toLocaleString()} {o.currency || CURRENCY}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
