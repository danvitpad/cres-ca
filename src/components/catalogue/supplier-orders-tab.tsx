/** --- YAML
 * name: SupplierOrdersTab
 * description: Supplier orders list + minimal create wizard. Reads `supplier_orders` + `suppliers` + `inventory_items`. Lets master create a draft order (pick supplier, add items from stock, save). Full send/deliver lifecycle stays server-side.
 * created: 2026-04-18
 * updated: 2026-04-20
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, X, Trash2 } from 'lucide-react';
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

interface SupplierOpt { id: string; name: string; }
interface InventoryOpt { id: string; name: string; cost_per_unit: number | null; quantity: number; }

interface OrderItem {
  inventory_item_id: string;
  name: string;
  qty: number;
  price_per_unit: number;
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

  // Create wizard state
  const [createOpen, setCreateOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [inventory, setInventory] = useState<InventoryOpt[]>([]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

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

  async function openCreate() {
    if (!master?.id) return;
    const supabase = createClient();
    const [{ data: sup }, { data: inv }] = await Promise.all([
      supabase.from('suppliers').select('id, name').eq('master_id', master.id).eq('is_active', true).order('name'),
      supabase.from('inventory_items').select('id, name, cost_per_unit, quantity').eq('master_id', master.id).order('name'),
    ]);
    setSuppliers((sup || []) as SupplierOpt[]);
    setInventory((inv || []) as InventoryOpt[]);
    setSupplierId(sup?.[0]?.id || '');
    setItems([]);
    setNote('');
    setCreateOpen(true);
  }

  function addInventoryItem(itemId: string) {
    const inv = inventory.find((i) => i.id === itemId);
    if (!inv) return;
    if (items.some((it) => it.inventory_item_id === itemId)) {
      toast.info('Позиция уже в заказе');
      return;
    }
    setItems((prev) => [...prev, {
      inventory_item_id: inv.id,
      name: inv.name,
      qty: 1,
      price_per_unit: Number(inv.cost_per_unit || 0),
    }]);
  }

  function updateItem(idx: number, patch: Partial<OrderItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((sum, it) => sum + it.qty * it.price_per_unit, 0);

  async function saveDraft() {
    if (!master?.id) return;
    if (!supplierId) { toast.error('Выберите поставщика'); return; }
    if (!items.length) { toast.error('Добавьте хотя бы одну позицию'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('supplier_orders').insert({
        master_id: master.id,
        supplier_id: supplierId,
        status: 'draft',
        items,
        total_cost: total,
        currency: 'UAH',
        note: note || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Заказ сохранён как черновик');
      setCreateOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

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
          onClick={openCreate}
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

      {createOpen && (
        <div
          onClick={() => !saving && setCreateOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: '24px 22px', fontFamily: FONT, color: C.text,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Новый заказ поставщику</h3>
                <p style={{ fontSize: 12, color: C.textTertiary, margin: '4px 0 0 0' }}>Сохраняется как черновик. Отправка/доставка — в карточке заказа (скоро).</p>
              </div>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {suppliers.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textTertiary, margin: '12px 0' }}>
                Сначала добавь хотя бы одного поставщика на вкладке «Склад».
              </p>
            ) : (
              <>
                {/* Supplier select */}
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Поставщик</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', marginBottom: 16,
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.text, fontSize: 14, fontFamily: FONT,
                  }}
                >
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {/* Add item dropdown */}
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Добавить позицию</label>
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) { addInventoryItem(e.target.value); e.target.value = ''; } }}
                  style={{
                    width: '100%', padding: '10px 12px', marginBottom: 14,
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.text, fontSize: 14, fontFamily: FONT,
                  }}
                >
                  <option value="">— выбери материал со склада —</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (на складе: {i.quantity})
                    </option>
                  ))}
                </select>

                {/* Items list */}
                {items.length > 0 && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14, overflow: 'hidden' }}>
                    {items.map((it, idx) => (
                      <div key={it.inventory_item_id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 10,
                        alignItems: 'center', padding: '10px 12px',
                        borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</span>
                        <input
                          type="number" min="1"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                          style={{ padding: '6px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, width: '100%' }}
                        />
                        <input
                          type="number" min="0" step="0.01"
                          value={it.price_per_unit}
                          onChange={(e) => updateItem(idx, { price_per_unit: Math.max(0, Number(e.target.value) || 0) })}
                          style={{ padding: '6px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, width: '100%' }}
                        />
                        <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div style={{ padding: '10px 12px', background: C.bg, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                      <span>Итого</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString()} {CURRENCY}</span>
                    </div>
                  </div>
                )}

                {/* Note */}
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Заметка (необязательно)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', marginBottom: 18,
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.text, fontSize: 13, fontFamily: FONT, resize: 'vertical',
                  }}
                />

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setCreateOpen(false)}
                    disabled={saving}
                    style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >Отмена</button>
                  <button
                    onClick={saveDraft}
                    disabled={saving || !supplierId || items.length === 0}
                    style={{
                      padding: '9px 16px', border: 'none', borderRadius: 8,
                      background: saving || !supplierId || items.length === 0 ? C.borderStrong : C.accent,
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: saving || !supplierId || items.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >{saving ? 'Сохраняю…' : 'Сохранить черновик'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
