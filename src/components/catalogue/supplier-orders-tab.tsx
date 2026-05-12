/** --- YAML
 * name: SupplierOrdersTab
 * description: Supplier orders list + minimal create wizard. Reads `supplier_orders` + `suppliers` + `inventory_items`. Lets master create a draft order (pick supplier, add items from stock, save). Full send/deliver lifecycle stays server-side.
 * created: 2026-04-18
 * updated: 2026-04-20
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, CURRENCY } from '@/lib/dashboard-theme';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { OrderDispatchDialog } from '@/components/catalogue/order-dispatch-dialog';

type OrderStatus = 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

interface OrderRow {
  id: string;
  status: OrderStatus;
  total_cost: number;
  currency: string;
  items: unknown[];
  created_at: string;
  supplier: { name: string; email: string | null; telegram_id: string | null } | null;
}

interface SupplierOpt { id: string; name: string; }
interface InventoryOpt {
  id: string;
  name: string;
  cost_per_unit: number | null;
  quantity: number;
  low_stock_threshold?: number;
  unit?: string;
  preferred_supplier_id: string | null;
}

interface OrderItem {
  inventory_item_id: string;
  name: string;
  qty: number;
  price_per_unit: number;
  unit?: string;
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
  const [showAllInventory, setShowAllInventory] = useState(false);
  // Поп-ап «Отправить заказ» — открывается после сохранения draft'а
  // или при клике «Отправить» на существующем заказе.
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(null);
  const [dispatchSnapshot, setDispatchSnapshot] = useState<{
    supplier: { name: string; email: string | null; telegram_id: string | null } | null;
    items: OrderItem[];
    total: number;
    currency: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('supplier_orders')
      .select('id, status, total_cost, currency, items, created_at, supplier:suppliers(name, email, telegram_id)')
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
      supabase.from('inventory_items').select('id, name, cost_per_unit, quantity, low_stock_threshold, unit, preferred_supplier_id').eq('master_id', master.id).order('name'),
    ]);
    setSuppliers((sup || []) as SupplierOpt[]);
    setInventory((inv || []) as InventoryOpt[]);
    setSupplierId(sup?.[0]?.id || '');
    setItems([]);
    setNote('');
    setShowAllInventory(false);
    setCreateOpen(true);
  }

  async function loadLastOrder() {
    if (!master?.id || !supplierId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('supplier_orders')
      .select('items')
      .eq('master_id', master.id)
      .eq('supplier_id', supplierId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.items) {
      toast.info('Прошлых заказов этому поставщику нет');
      return;
    }
    setItems((data.items as OrderItem[]).map((it) => ({ ...it })));
    toast.success('Подтянул позиции из последнего заказа');
  }

  function toggleInventoryItem(itemId: string, checked: boolean) {
    const inv = inventory.find((i) => i.id === itemId);
    if (!inv) return;
    if (checked) {
      if (items.some((it) => it.inventory_item_id === itemId)) return;
      // Suggested qty: if low stock — bring to 2x threshold; else default 1
      const threshold = inv.low_stock_threshold ?? 0;
      const suggested = inv.quantity <= threshold && threshold > 0
        ? Math.max(1, threshold * 2 - inv.quantity)
        : 1;
      setItems((prev) => [...prev, {
        inventory_item_id: inv.id,
        name: inv.name,
        qty: suggested,
        price_per_unit: Number(inv.cost_per_unit || 0),
        unit: inv.unit,
      }]);
    } else {
      setItems((prev) => prev.filter((it) => it.inventory_item_id !== itemId));
    }
  }

  function updateItem(idx: number, patch: Partial<OrderItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((sum, it) => sum + it.qty * it.price_per_unit, 0);

  async function saveDraft(): Promise<string | null> {
    if (!master?.id) return null;
    if (!supplierId) { toast.error('Выберите поставщика'); return null; }
    if (!items.length) { toast.error('Добавьте хотя бы одну позицию'); return null; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('supplier_orders').insert({
        master_id: master.id,
        supplier_id: supplierId,
        status: 'draft',
        items,
        total_cost: total,
        currency: 'UAH',
        note: note || null,
      }).select('id').single();
      if (error || !data) { toast.error(error?.message || 'Ошибка'); return null; }
      toast.success('Заказ сохранён');
      setCreateOpen(false);
      load();
      return (data as { id: string }).id;
    } finally {
      setSaving(false);
    }
  }

  // Прямая sendOrder больше не нужна — отправка идёт через
  // OrderDispatchDialog (попап с превью + двумя кнопками TG/Email).

  function downloadPdf(orderId: string) {
    window.open(`/api/supplier-orders/${orderId}/pdf`, '_blank');
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
                  gridTemplateColumns: '80px 1fr 130px 120px 140px',
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
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => downloadPdf(o.id)}
                    title="Открыть PDF"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 9px', borderRadius: 6, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.text,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    PDF
                  </button>
                  {o.status === 'draft' && (
                    <button
                      onClick={() => {
                        // Открываем единый попап «Отправить» — там и TG, и Email
                        // в одном месте с превью.
                        const itemsForSnapshot: OrderItem[] = (Array.isArray(o.items) ? o.items : [])
                          .map((raw) => {
                            const r = raw as Record<string, unknown>;
                            return {
                              inventory_item_id: (r.inventory_item_id as string) ?? '',
                              name: (r.name as string) ?? '—',
                              qty: Number(r.qty ?? r.quantity ?? 0),
                              price_per_unit: Number(r.price_per_unit ?? r.unit_price ?? 0),
                              unit: (r.unit as string) ?? undefined,
                            };
                          });
                        setDispatchOrderId(o.id);
                        setDispatchSnapshot({
                          supplier: o.supplier,
                          items: itemsForSnapshot,
                          total: Number(o.total_cost),
                          currency: o.currency || 'UAH',
                        });
                        setDispatchOpen(true);
                      }}
                      title="Открыть окно отправки заказа"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 11px', borderRadius: 6, border: 'none',
                        background: C.accent,
                        color: '#fff', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Send size={11} /> Отправить
                    </button>
                  )}
                </div>
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
                Сначала добавьте хотя бы одного поставщика на вкладке «Склад → Поставщики».
              </p>
            ) : (
              <>
                {/* Supplier select + last-order pill */}
                <label style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Поставщик</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <select
                    value={supplierId}
                    onChange={(e) => { setSupplierId(e.target.value); setItems([]); }}
                    style={{
                      flex: 1, padding: '10px 12px',
                      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.text, fontSize: 14, fontFamily: FONT,
                    }}
                  >
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={loadLastOrder}
                    disabled={!supplierId}
                    style={{
                      padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.text, fontSize: 12, fontWeight: 500,
                      cursor: supplierId ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                    }}
                    title="Подтянуть позиции из прошлого заказа этому поставщику"
                  >
                    ↻ Прошлый заказ
                  </button>
                </div>

                {/* Material checklist — sorted by stock level (low first) */}
                {(() => {
                  const filtered = showAllInventory
                    ? inventory
                    : inventory.filter((i) => !i.preferred_supplier_id || i.preferred_supplier_id === supplierId);
                  const hiddenCount = inventory.length - filtered.length;
                  // Sort: low stock first (qty <= threshold), then alphabetic
                  const sorted = [...filtered].sort((a, b) => {
                    const aLow = (a.low_stock_threshold ?? 0) > 0 && a.quantity <= (a.low_stock_threshold ?? 0) ? 0 : 1;
                    const bLow = (b.low_stock_threshold ?? 0) > 0 && b.quantity <= (b.low_stock_threshold ?? 0) ? 0 : 1;
                    if (aLow !== bLow) return aLow - bLow;
                    return a.name.localeCompare(b.name, 'ru');
                  });
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Что заказываем
                        </label>
                        {hiddenCount > 0 && !showAllInventory && (
                          <button type="button" onClick={() => setShowAllInventory(true)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                            + ещё {hiddenCount} без поставщика
                          </button>
                        )}
                        {showAllInventory && (
                          <button type="button" onClick={() => setShowAllInventory(false)} style={{ background: 'none', border: 'none', color: C.textTertiary, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                            только этого поставщика
                          </button>
                        )}
                      </div>
                      {sorted.length === 0 ? (
                        <p style={{ fontSize: 12, color: C.textTertiary, margin: '8px 0 14px' }}>
                          Нет материалов привязанных к этому поставщику. Привяжи их в карточке материала.
                        </p>
                      ) : (
                        <div style={{
                          border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14,
                          overflow: 'hidden', maxHeight: 320, overflowY: 'auto',
                        }}>
                          {sorted.map((inv, idx) => {
                            const checked = items.some((it) => it.inventory_item_id === inv.id);
                            const item = items.find((it) => it.inventory_item_id === inv.id);
                            const isLow = (inv.low_stock_threshold ?? 0) > 0 && inv.quantity <= (inv.low_stock_threshold ?? 0);
                            return (
                              <div
                                key={inv.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '24px 1fr 80px 80px',
                                  gap: 10,
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  borderBottom: idx < sorted.length - 1 ? `1px solid ${C.border}` : 'none',
                                  background: isLow ? 'rgba(245,158,11,0.06)' : 'transparent',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleInventoryItem(inv.id, e.target.checked)}
                                  style={{ width: 16, height: 16, accentColor: C.accent, cursor: 'pointer' }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {inv.name}
                                    </span>
                                    {isLow && (
                                      <span style={{
                                        fontSize: 9, fontWeight: 600, padding: '1px 6px',
                                        borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                      }}>
                                        мало
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>
                                    на складе: {inv.quantity} {inv.unit || ''}
                                  </div>
                                </div>
                                {checked && item ? (
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={item.qty}
                                    onChange={(e) => updateItem(items.indexOf(item), { qty: Math.max(0, Number(e.target.value) || 0) })}
                                    placeholder="кол-во"
                                    style={{ padding: '5px 7px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, width: '100%', fontVariantNumeric: 'tabular-nums' }}
                                  />
                                ) : <span />}
                                {checked && item ? (
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={item.price_per_unit}
                                    onChange={(e) => updateItem(items.indexOf(item), { price_per_unit: Math.max(0, Number(e.target.value) || 0) })}
                                    placeholder="цена"
                                    style={{ padding: '5px 7px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, width: '100%', fontVariantNumeric: 'tabular-nums' }}
                                  />
                                ) : <span />}
                              </div>
                            );
                          })}
                          <div style={{
                            padding: '10px 12px', background: C.surfaceElevated,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: 13, fontWeight: 600, borderTop: `1px solid ${C.border}`,
                          }}>
                            <span style={{ color: C.textSecondary }}>
                              Выбрано: {items.length}
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {total.toLocaleString()} {CURRENCY}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

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
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCreateOpen(false)}
                    disabled={saving}
                    style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >Отмена</button>
                  <button
                    onClick={async () => { await saveDraft(); }}
                    disabled={saving || !supplierId || items.length === 0}
                    style={{
                      padding: '9px 14px', border: `1px solid ${C.border}`, borderRadius: 8,
                      background: 'transparent', color: C.text, fontSize: 13, fontWeight: 500,
                      cursor: saving || !supplierId || items.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: saving || !supplierId || items.length === 0 ? 0.5 : 1,
                    }}
                  >Сохранить как черновик</button>
                  <button
                    onClick={async () => {
                      // Сохраняем заказ и сразу открываем диспетчер (попап с
                      // двумя кнопками TG/Email), без открытия PDF в отдельной вкладке.
                      const newId = await saveDraft();
                      if (!newId) return;
                      const supplier = suppliers.find((s) => s.id === supplierId);
                      // Подтянем email/telegram_id, которых нет в SupplierOpt:
                      const supabase = createClient();
                      const { data: full } = await supabase
                        .from('suppliers')
                        .select('name, email, telegram_id')
                        .eq('id', supplierId)
                        .maybeSingle();
                      setDispatchOrderId(newId);
                      setDispatchSnapshot({
                        supplier: full
                          ? { name: full.name as string, email: (full.email as string) ?? null, telegram_id: (full.telegram_id as string) ?? null }
                          : supplier
                            ? { name: supplier.name, email: null, telegram_id: null }
                            : null,
                        items: [...items],
                        total,
                        currency: 'UAH',
                      });
                      setDispatchOpen(true);
                    }}
                    disabled={saving || !supplierId || items.length === 0}
                    style={{
                      padding: '9px 14px', border: 'none', borderRadius: 8,
                      background: saving || !supplierId || items.length === 0 ? C.borderStrong : C.accent,
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: saving || !supplierId || items.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >{saving ? 'Сохраняю…' : 'Готово, отправить'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Поп-ап отправки заказа: появляется после "Готово, отправить" в форме
          создания, или после клика "Отправить" на draft из списка. */}
      <OrderDispatchDialog
        open={dispatchOpen}
        onOpenChange={(v) => setDispatchOpen(v)}
        orderId={dispatchOrderId}
        supplier={dispatchSnapshot?.supplier ?? null}
        items={dispatchSnapshot?.items ?? []}
        currency={dispatchSnapshot?.currency ?? 'UAH'}
        total={dispatchSnapshot?.total ?? 0}
        onDone={() => {
          // Перезагружаем список после успешной отправки —
          // статус заказа меняется на 'sent'.
          load();
        }}
      />
    </>
  );
}
