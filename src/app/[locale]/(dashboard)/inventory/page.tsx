/** --- YAML
 * name: InventoryPage
 * description: Inventory management — materials CRUD with low stock alerts, usage tracking
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
  Loader2,
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
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
}

export default function InventoryPage() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const { canUse } = useSubscription();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

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

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openAddDialog() {
    setEditItem(null);
    setName('');
    setQuantity('');
    setUnit('pcs');
    setCostPerUnit('');
    setLowStockThreshold('5');
    setDialogOpen(true);
  }

  function openEditDialog(item: InventoryItem) {
    setEditItem(item);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setCostPerUnit(String(item.cost_per_unit));
    setLowStockThreshold(String(item.low_stock_threshold));
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

  if (!canUse('inventory')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground mb-4">This feature requires Pro plan</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>
          Upgrade
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

  const lowStockCount = items.filter((i) => i.quantity <= i.low_stock_threshold).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-primary" />
            {t('addItem').replace('Add ', '')}
          </h2>
          {lowStockCount > 0 && (
            <p className="text-sm text-amber-500 flex items-center gap-1 mt-1">
              <AlertTriangle className="size-3.5" />
              {lowStockCount} {t('lowStock').toLowerCase()}
            </p>
          )}
        </div>
        <Button onClick={openAddDialog} className="gap-1.5">
          <Plus className="size-4" />
          {t('addItem')}
        </Button>
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="size-10 mx-auto mb-3 opacity-40" />
            <p>{t('noItems')}</p>
          </CardContent>
        </Card>
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

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? tc('edit') : t('addItem')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('itemName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gel, Gloves..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t('quantity')}</Label>
                <Input type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('unit')}</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, ml, g" />
              </div>
              <div className="space-y-2">
                <Label>{t('costPerUnit')}</Label>
                <Input type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('lowStock')} threshold</Label>
              <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
            </div>
            <Button onClick={saveItem} className="w-full">
              {tc('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
