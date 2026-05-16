/** --- YAML
 * name: InventoryPage
 * description: Inventory management — materials CRUD with low stock alerts, supplier management, barcode scan link
 * updated: 2026-04-16
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  ScanBarcode,
  Truck,
  Phone,
  Mail,
  Send,
  ChevronRight,
  Search,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useSubscription } from '@/hooks/use-subscription';
import { useEnterSubmit } from '@/hooks/use-keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { buttonVariants } from '@/components/ui/button';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  low_stock_threshold: number;
  barcode: string | null;
  expiry_date: string | null;
  preferred_supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  telegram_id: string | null;
  note: string | null;
}

const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'шт',   label: 'шт.' },
  { value: 'мл',   label: 'мл' },
  { value: 'л',    label: 'л' },
  { value: 'г',    label: 'г' },
  { value: 'кг',   label: 'кг' },
  { value: 'м',    label: 'м' },
  { value: 'см',   label: 'см' },
  { value: 'упак', label: 'упак.' },
];

type Tab = 'materials' | 'suppliers';

export default function InventoryPage({
  initialTab,
  hideTabs = false,
}: { initialTab?: Tab; hideTabs?: boolean } = {}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const { canUse } = useSubscription();

  const [tab, setTab] = useState<Tab>(initialTab ?? 'materials');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Item form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('шт');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [preferredSupplierId, setPreferredSupplierId] = useState<string | null>(null);

  // Supplier state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierTelegramId, setSupplierTelegramId] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  // Mobile state
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileTab, setMobileTab] = useState<'all' | 'low'>('all');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState('');

  const loadItems = useCallback(async () => {
    if (!master) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('master_id', master.id)
      .order('name');

    setItems((data as InventoryItem[]) || []);
    setIsLoading(false);
  }, [master]);

  const loadSuppliers = useCallback(async () => {
    if (!master) return;
    setSuppliersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('master_id', master.id)
      .order('name');
    setSuppliers((data as Supplier[]) || []);
    setSuppliersLoading(false);
  }, [master]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Realtime — auto-refresh inventory on changes
  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`inventory_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `master_id=eq.${master.id}` }, () => { loadItems(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [master?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Suppliers are needed both for the suppliers tab AND for the material form's
    // "preferred supplier" selector — preload as soon as master is known.
    if (suppliers.length === 0) loadSuppliers();
  }, [suppliers.length, loadSuppliers]);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function openAddDialog() {
    setEditItem(null);
    setName('');
    setQuantity('');
    setUnit('шт');
    setCostPerUnit('');
    setLowStockThreshold('5');
    setPreferredSupplierId(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: InventoryItem) {
    setEditItem(item);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setCostPerUnit(String(item.cost_per_unit));
    setLowStockThreshold(String(item.low_stock_threshold));
    setPreferredSupplierId(item.preferred_supplier_id ?? null);
    setDialogOpen(true);
  }

  function openMobileAdd() {
    setEditItem(null);
    setName(''); setQuantity(''); setUnit('шт');
    setCostPerUnit(''); setLowStockThreshold('5'); setPreferredSupplierId(null);
    setMobileSheetOpen(true);
  }

  function openMobileEdit(item: InventoryItem) {
    setEditItem(item);
    setName(item.name); setQuantity(String(item.quantity)); setUnit(item.unit);
    setCostPerUnit(String(item.cost_per_unit)); setLowStockThreshold(String(item.low_stock_threshold));
    setPreferredSupplierId(item.preferred_supplier_id ?? null);
    setMobileSheetOpen(true);
  }

  async function saveItem() {
    if (!master || !name.trim() || !quantity) return;
    const supabase = createClient();
    const payload = {
      master_id: master.id,
      name: name.trim(),
      quantity: parseFloat(quantity),
      unit,
      cost_per_unit: parseFloat(costPerUnit) || 0,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
      preferred_supplier_id: preferredSupplierId,
    };

    if (editItem) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', editItem.id);
      if (error) { toast.error(tc('error')); return; }
    } else {
      const { error } = await supabase.from('inventory_items').insert(payload);
      if (error) { toast.error(tc('error')); return; }
    }

    toast.success(tc('success'));
    setDialogOpen(false);
    setMobileSheetOpen(false);
    loadItems();
  }

  async function deleteItem(id: string) {
    const supabase = createClient();
    await supabase.from('inventory_items').delete().eq('id', id);
    loadItems();
  }

  // Supplier CRUD
  function openAddSupplier() {
    setEditSupplier(null);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setSupplierTelegramId('');
    setSupplierNotes('');
    setSupplierDialogOpen(true);
  }

  function openEditSupplier(s: Supplier) {
    setEditSupplier(s);
    setSupplierName(s.name);
    setSupplierPhone(s.phone || '');
    setSupplierEmail(s.email || '');
    setSupplierTelegramId(s.telegram_id || '');
    setSupplierNotes(s.note || '');
    setSupplierDialogOpen(true);
  }

  async function saveSupplier() {
    if (!master || !supplierName.trim()) return;
    const supabase = createClient();
    const payload = {
      master_id: master.id,
      name: supplierName.trim(),
      phone: supplierPhone || null,
      email: supplierEmail || null,
      telegram_id: supplierTelegramId.trim() || null,
      note: supplierNotes || null,
    };

    if (editSupplier) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editSupplier.id);
      if (error) { toast.error(tc('error')); return; }
    } else {
      const { error } = await supabase.from('suppliers').insert(payload);
      if (error) { toast.error(tc('error')); return; }
    }

    toast.success(tc('success'));
    setSupplierDialogOpen(false);
    loadSuppliers();
  }

  // Enter (без модификатора) submits активный диалог
  useEnterSubmit(dialogOpen, saveItem, { withModifier: false });
  useEnterSubmit(supplierDialogOpen, saveSupplier, { withModifier: false });

  async function deleteSupplier(id: string) {
    const supabase = createClient();
    await supabase.from('suppliers').delete().eq('id', id);
    loadSuppliers();
  }

  if (!canUse('inventory')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground mb-4">{t('requiresPro')}</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('upgrade')}
        </Link>
      </div>
    );
  }

  if (masterLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">
          <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const lowStockItems = items.filter((i) => i.quantity <= i.low_stock_threshold);
  const lowStockCount = lowStockItems.length;

  // ── MOBILE VIEW ──────────────────────────────────────────────────────────
  if (isMobileView) {
    const totalValue = items.reduce((sum, i) => sum + i.quantity * (i.cost_per_unit || 0), 0);
    const filteredItems = items
      .filter(i => mobileTab === 'low' ? i.quantity <= i.low_stock_threshold : true)
      .filter(i => !mobileSearch.trim() || i.name.toLowerCase().includes(mobileSearch.toLowerCase()));

    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Склад</span>
          <button
            onClick={openMobileAdd}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + Додати
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', width: 16, height: 16 }} />
            <input
              value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              placeholder="Пошук матеріалів..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px' }}>
          {[
            { label: 'Всього', value: String(items.length), warn: false },
            { label: 'Мало', value: String(lowStockCount), warn: lowStockCount > 0 },
            { label: 'Вартість', value: `${totalValue.toFixed(0)} ₴`, warn: false },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.warn ? '#f59e0b' : '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter pill tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
          {([
            { key: 'all' as const, label: `Всі (${items.length})` },
            { key: 'low' as const, label: `⚠ Мало (${lowStockCount})` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setMobileTab(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: mobileTab === t.key ? '#2563eb' : '#fff',
                color: mobileTab === t.key ? '#fff' : '#64748b',
                boxShadow: mobileTab === t.key ? '0 2px 8px rgba(37,99,235,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Material list */}
        <div style={{ padding: '0 16px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
              {mobileSearch ? 'Нічого не знайдено' : 'Матеріалів немає'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredItems.map(item => {
                const qty = item.quantity;
                const threshold = item.low_stock_threshold;
                const level = qty === 0 ? 'critical' : qty <= threshold ? 'low' : 'ok';
                const iconBg   = level === 'ok' ? '#eff6ff' : level === 'low' ? '#fffbeb' : '#fef2f2';
                const iconColor = level === 'ok' ? '#2563eb' : level === 'low' ? '#f59e0b' : '#ef4444';
                const badgeBg   = level === 'ok' ? '#f0fdf4' : level === 'low' ? '#fffbeb' : '#fef2f2';
                const badgeClr  = level === 'ok' ? '#16a34a' : level === 'low' ? '#d97706' : '#dc2626';
                const badgeTxt  = level === 'ok' ? 'OK' : level === 'low' ? 'LOW' : 'CRITICAL';
                return (
                  <div
                    key={item.id}
                    onClick={() => openMobileEdit(item)}
                    style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package style={{ width: 18, height: 18, color: iconColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {item.quantity} {item.unit}{item.cost_per_unit > 0 ? ` · ₴${item.cost_per_unit}/${item.unit}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: badgeClr, background: badgeBg, padding: '2px 7px', borderRadius: 10 }}>{badgeTxt}</span>
                      <ChevronRight style={{ width: 16, height: 16, color: '#cbd5e1' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={openMobileAdd}
          style={{ position: 'fixed', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,99,235,0.35)', zIndex: 40 }}
        >
          <Plus style={{ width: 24, height: 24, color: '#fff' }} />
        </button>

        {/* Bottom sheet */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: mobileSheetOpen ? 'auto' : 'none' }}>
          <div
            onClick={() => setMobileSheetOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: mobileSheetOpen ? 1 : 0, transition: 'opacity 300ms' }}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '88%', overflowY: 'auto', transform: mobileSheetOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)', padding: '16px 20px 40px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
              {editItem ? 'Редагувати матеріал' : 'Новий матеріал'}
            </div>

            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Назва</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Назва матеріалу" style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Qty + Unit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Кількість</label>
                <input type="number" min="0" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Одиниця</label>
                <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>

            {/* Threshold + Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Поріг «мало»</label>
                <input type="number" min="0" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Ціна / од.</label>
                <input type="number" min="0" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Supplier */}
            {suppliers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Постачальник</label>
                <select value={preferredSupplierId ?? '__none__'} onChange={e => setPreferredSupplierId(e.target.value === '__none__' ? null : e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="__none__">Без постачальника</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setMobileSheetOpen(false)} style={{ padding: 13, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 15, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Скасувати</button>
              <button onClick={saveItem} style={{ padding: 13, borderRadius: 12, border: 'none', background: '#2563eb', fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Зберегти</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ padding: '32px 40px' }}>
      {/* Low stock banner — показываем только на вкладке «Материалы» (склад).
          На «Поставщики»/«Заказы поставщикам» это лишний шум. */}
      {tab === 'materials' && lowStockCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-400/50 bg-amber-500/5 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {lowStockCount} {t('lowStock').toLowerCase()}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <Badge
                key={item.id}
                variant="outline"
                className="text-xs border-amber-400 text-amber-600 dark:text-amber-400"
              >
                {item.name}: {item.quantity} {item.unit}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Header — sub-tabs (Материалы / Поставщики) without icons + Add button.
          Hidden when this component is embedded inside another tab wrapper that
          already provides its own sub-tab bar (see /services?tab=suppliers). */}
      <div className="flex items-end justify-between border-b border-border">
        {!hideTabs ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab('materials')}
              className={cn(
                'px-4 py-2.5 text-sm transition-colors -mb-px border-b-2',
                tab === 'materials'
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground font-medium',
              )}
            >
              Материалы
            </button>
            <button
              type="button"
              onClick={() => setTab('suppliers')}
              className={cn(
                'px-4 py-2.5 text-sm transition-colors -mb-px border-b-2',
                tab === 'suppliers'
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground font-medium',
              )}
            >
              Поставщики
            </button>
          </div>
        ) : <div />}
        <div className="flex gap-2 pb-2">
          {/* QR-scan removed: feature is unused and adds noise to the toolbar. */}
          {tab === 'materials' ? (
            <Button size="sm" onClick={openAddDialog}>{t('addItem')}</Button>
          ) : (
            <Button size="sm" onClick={openAddSupplier}>{t('addSupplier')}</Button>
          )}
        </div>
      </div>

      {/* Materials tab */}
      {tab === 'materials' && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Package className="w-6 h-6" />}
              title={t('noItems')}
              action={
                <Button onClick={openAddDialog} className="gap-1.5">
                  <Plus className="size-4" />
                  {t('addItem')}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {items.map((item, i) => {
                  const isLow = item.quantity <= item.low_stock_threshold;
                  const supplierName = suppliers.find((s) => s.id === item.preferred_supplier_id)?.name;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(i, 12) * 0.02 }}
                      className={cn(
                        'group relative rounded-xl border bg-card/80 backdrop-blur p-3 transition-all hover:shadow-md',
                        isLow ? 'border-amber-400/50 bg-amber-500/[0.04]' : 'border-border/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className={cn(
                          'flex size-8 items-center justify-center rounded-lg shrink-0',
                          isLow ? 'bg-amber-500/15' : 'bg-primary/10',
                        )}>
                          {isLow
                            ? <AlertTriangle className="size-4 text-amber-500" />
                            : <Package className="size-4 text-primary" />}
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditDialog(item)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold leading-tight truncate" title={item.name}>
                        {item.name}
                      </h3>

                      <div className="mt-2 flex items-baseline gap-2">
                        <span className={cn(
                          'text-4xl font-bold tabular-nums leading-none',
                          isLow ? 'text-amber-500' : 'text-foreground',
                        )}>
                          {item.quantity}
                        </span>
                        <span className="text-lg font-semibold text-muted-foreground">{item.unit}</span>
                        {item.cost_per_unit > 0 && (
                          <span className="ml-auto text-base font-bold text-foreground tabular-nums">
                            {item.cost_per_unit} ₴/{item.unit}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {isLow && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                            мало
                          </Badge>
                        )}
                        {supplierName && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border text-muted-foreground gap-1">
                            <Truck className="size-2.5" />
                            {supplierName}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Suppliers tab */}
      {tab === 'suppliers' && (
        <>
          {suppliersLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" /><Skeleton className="h-20" />
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-6 h-6" />}
              title={t('noSuppliers')}
              action={
                <Button onClick={openAddSupplier} className="gap-1.5">
                  <Plus className="size-4" />
                  {t('addSupplier')}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              <AnimatePresence>
                {suppliers.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: Math.min(i, 12) * 0.02 }}
                    className="group relative rounded-lg border border-border/60 bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    {/* Top row: name + actions */}
                    <div className="flex items-start gap-2">
                      <div className="flex size-7 items-center justify-center rounded-md shrink-0 bg-primary/10">
                        <Truck className="size-3.5 text-primary" />
                      </div>
                      <h3 className="flex-1 min-w-0 text-[13px] font-semibold leading-tight truncate" title={s.name}>
                        {s.name}
                      </h3>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditSupplier(s)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          title="Редактировать"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => deleteSupplier(s.id)}
                          className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          title="Удалить"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Quick contact row — show first available, rest as icons */}
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          className="flex items-center gap-1 min-w-0 hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="size-3 shrink-0" />
                          <span className="truncate">{s.phone}</span>
                        </a>
                      ) : s.email ? (
                        <a
                          href={`mailto:${s.email}`}
                          className="flex items-center gap-1 min-w-0 hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </a>
                      ) : s.telegram_id ? (
                        <span className="flex items-center gap-1 min-w-0 text-sky-600 dark:text-sky-400">
                          <Send className="size-3 shrink-0" />
                          <span className="truncate">@{s.telegram_id.replace(/^@/, '')}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] italic text-muted-foreground/60">Без контактов</span>
                      )}
                      {/* Secondary contact methods — dot icons */}
                      <div className="ml-auto flex gap-1 shrink-0 text-muted-foreground/50">
                        {s.phone && s.email && <Mail className="size-2.5" />}
                        {(s.phone || s.email) && s.telegram_id && <Send className="size-2.5" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Add/Edit item dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? tc('edit') : t('addItem')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('itemName')}
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('itemNamePlaceholder')} />
            </div>

            {/* Quantity / Unit / Price — uniform label height */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-4">
                  Количество
                </Label>
                <Input type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-4">
                  Ед. измерения
                </Label>
                <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue>
                      {(v) => UNIT_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-4">
                  Цена / ед.
                </Label>
                <Input type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Низкий остаток
                </Label>
                <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Поставщик
                </Label>
                <Select
                  value={preferredSupplierId ?? '__none__'}
                  onValueChange={(v) => setPreferredSupplierId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Без поставщика">
                      {(v) => v === '__none__' ? 'Без поставщика' : (suppliers.find((s) => s.id === v)?.name ?? 'Без поставщика')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без поставщика</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {suppliers.length === 0 && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                Привяжи поставщика, чтобы при формировании заказа сюда попадали только его товары.
                Сначала добавьте поставщиков во вкладке «Поставщики».
              </p>
            )}

            <Button onClick={saveItem} className="w-full">
              {tc('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit supplier dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSupplier ? tc('edit') : t('addSupplier')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('supplierName')}</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder={t('supplierNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('contactPhone')}</Label>
                <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="+380..." />
              </div>
              <div className="space-y-2">
                <Label>{t('contactEmail')}</Label>
                <Input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="email@company.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telegram ID</Label>
              <Input
                value={supplierTelegramId}
                onChange={(e) => setSupplierTelegramId(e.target.value)}
                placeholder="123456789"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">Чтобы отправлять заказы в Telegram: попроси поставщика написать боту @userinfobot — он пришлёт свой числовой ID.</p>
            </div>
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} />
            </div>
            <Button onClick={saveSupplier} className="w-full">
              {tc('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
