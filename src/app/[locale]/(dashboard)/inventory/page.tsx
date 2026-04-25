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
import { Card, CardContent } from '@/components/ui/card';
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
  { value: 'шт',  label: 'шт. — штуки' },
  { value: 'мл',  label: 'мл — миллилитры' },
  { value: 'л',   label: 'л — литры' },
  { value: 'г',   label: 'г — граммы' },
  { value: 'кг',  label: 'кг — килограммы' },
  { value: 'м',   label: 'м — метры' },
  { value: 'см',  label: 'см — сантиметры' },
  { value: 'упак', label: 'упак. — упаковки' },
];

type Tab = 'materials' | 'suppliers';

export default function InventoryPage() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const { canUse } = useSubscription();

  const [tab, setTab] = useState<Tab>('materials');
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
      {/* Low stock banner */}
      {lowStockCount > 0 && (
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

      {/* Header — sub-tabs (Материалы / Поставщики) without icons + Add button */}
      <div className="flex items-end justify-between border-b border-border">
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
        <div className="flex gap-2 pb-2">
          <Link href="/inventory/scan" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ScanBarcode className="size-4" />
          </Link>
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
            <div className="space-y-2">
              <AnimatePresence>
                {items.map((item, i) => {
                  const isLow = item.quantity <= item.low_stock_threshold;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className={cn(
                        'bg-card/80 backdrop-blur border-border/50 transition-all hover:shadow-sm',
                        isLow && 'border-amber-400/50 bg-amber-500/5',
                      )}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex size-10 items-center justify-center rounded-xl shrink-0',
                              isLow ? 'bg-amber-500/10' : 'bg-primary/10',
                            )}>
                              {isLow ? (
                                <AlertTriangle className="size-5 text-amber-500" />
                              ) : (
                                <Package className="size-5 text-primary" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium truncate">{item.name}</h3>
                                {isLow && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 shrink-0">
                                    {t('lowStock')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.cost_per_unit > 0 && `${item.cost_per_unit} UAH/${item.unit}`}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={cn(
                                'text-lg font-bold',
                                isLow ? 'text-amber-500' : 'text-foreground',
                              )}>
                                {item.quantity}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => openEditDialog(item)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
            <div className="space-y-2">
              <AnimatePresence>
                {suppliers.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="bg-card/80 backdrop-blur border-border/50 transition-all hover:shadow-sm">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-xl shrink-0 bg-primary/10">
                            <Truck className="size-5 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{s.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {s.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="size-3" />{s.phone}
                                </span>
                              )}
                              {s.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="size-3" />{s.email}
                                </span>
                              )}
                              {s.telegram_id && (
                                <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                  <Send className="size-3" />TG
                                </span>
                              )}
                            </div>
                            {s.note && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.note}</p>
                            )}
                          </div>

                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => openEditSupplier(s)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSupplier(s.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
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
                <select
                  value={preferredSupplierId ?? ''}
                  onChange={(e) => setPreferredSupplierId(e.target.value || null)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Не указан —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
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
