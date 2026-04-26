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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useSubscription } from '@/hooks/use-subscription';
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

                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className={cn(
                          'text-3xl font-bold tabular-nums leading-none',
                          isLow ? 'text-amber-500' : 'text-foreground',
                        )}>
                          {item.quantity}
                        </span>
                        <span className="text-base font-medium text-muted-foreground">{item.unit}</span>
                        {item.cost_per_unit > 0 && (
                          <span className="ml-auto text-sm font-semibold text-muted-foreground tabular-nums">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {suppliers.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i, 12) * 0.02 }}
                    className="group relative rounded-xl border border-border/50 bg-card/80 backdrop-blur p-3 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex size-8 items-center justify-center rounded-lg shrink-0 bg-primary/10">
                        <Truck className="size-4 text-primary" />
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditSupplier(s)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteSupplier(s.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold leading-tight truncate" title={s.name}>
                      {s.name}
                    </h3>

                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      {s.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="size-3 shrink-0" />
                          <span className="truncate">{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                      {s.telegram_id && (
                        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                          <Send className="size-3 shrink-0" />
                          <span className="truncate">{s.telegram_id}</span>
                        </div>
                      )}
                    </div>

                    {s.note && (
                      <p className="mt-2 text-[10px] text-muted-foreground/70 line-clamp-2">{s.note}</p>
                    )}
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
                Сначала добавь поставщиков во вкладке «Поставщики».
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
