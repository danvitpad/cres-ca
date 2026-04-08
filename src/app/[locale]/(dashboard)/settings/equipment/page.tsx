/** --- YAML
 * name: EquipmentManagementPage
 * description: Salon equipment CRUD — track shared resources like lasers, lamps with usage tracking
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

interface Equipment {
  id: string;
  name: string;
  total_resource: number;
  used_resource: number;
  maintenance_threshold: number;
  unit: string;
}

export default function EquipmentPage() {
  const tc = useTranslations('common');
  const tp = useTranslations('pricing');
  const { userId } = useAuthStore();
  const { canUse } = useSubscription();

  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Equipment | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [totalResource, setTotalResource] = useState('');
  const [unit, setUnit] = useState('pulses');
  const [threshold, setThreshold] = useState('');

  const loadEquipment = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: salon } = await supabase.from('salons').select('id').eq('owner_id', userId).single();
    if (!salon) { setLoading(false); return; }
    setSalonId(salon.id);

    const { data } = await supabase.from('equipment').select('*').eq('salon_id', salon.id).order('name');
    setItems((data as Equipment[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  function openAdd() {
    setEditItem(null);
    setName(''); setTotalResource(''); setUnit('pulses'); setThreshold('');
    setDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setEditItem(item);
    setName(item.name);
    setTotalResource(String(item.total_resource));
    setUnit(item.unit);
    setThreshold(String(item.maintenance_threshold));
    setDialogOpen(true);
  }

  async function saveEquipment() {
    if (!salonId || !name.trim()) return;
    const supabase = createClient();
    const payload = {
      salon_id: salonId,
      name: name.trim(),
      total_resource: parseFloat(totalResource) || 0,
      used_resource: editItem?.used_resource || 0,
      maintenance_threshold: parseFloat(threshold) || 0,
      unit,
    };

    if (editItem) {
      await supabase.from('equipment').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('equipment').insert(payload);
    }

    toast.success(tc('success'));
    setDialogOpen(false);
    loadEquipment();
  }

  async function deleteEquipment(id: string) {
    const supabase = createClient();
    await supabase.from('equipment').delete().eq('id', id);
    loadEquipment();
  }

  if (!canUse('equipment_booking')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wrench className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground mb-4">This feature requires Business plan</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>Upgrade</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wrench className="size-6 text-primary" />
          {tp('equipmentBooking')}
        </h2>
        <Button onClick={openAdd} className="gap-1.5"><Plus className="size-4" />{tc('create')}</Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="size-10 mx-auto mb-3 opacity-40" />
            <p>No equipment registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {items.map((item, i) => {
              const usage = item.total_resource > 0 ? (item.used_resource / item.total_resource) * 100 : 0;
              const needsMaintenance = item.maintenance_threshold > 0 && item.used_resource >= item.maintenance_threshold;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={cn('bg-card/80 backdrop-blur border-border/50', needsMaintenance && 'border-amber-400/50')}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex size-10 items-center justify-center rounded-xl shrink-0', needsMaintenance ? 'bg-amber-500/10' : 'bg-primary/10')}>
                          {needsMaintenance ? <AlertTriangle className="size-5 text-amber-500" /> : <Wrench className="size-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{item.name}</h3>
                            {needsMaintenance && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Maintenance</Badge>}
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', needsMaintenance ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(usage, 100)}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.used_resource} / {item.total_resource} {item.unit}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted/50"><Pencil className="size-3.5 text-muted-foreground" /></button>
                          <button onClick={() => deleteEquipment(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="size-3.5 text-muted-foreground" /></button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? tc('edit') : tc('create')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Laser device..." /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Total resource</Label><Input type="number" value={totalResource} onChange={(e) => setTotalResource(e.target.value)} /></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pulses, hours" /></div>
              <div className="space-y-2"><Label>Maintenance at</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
            </div>
            <Button onClick={saveEquipment} className="w-full">{tc('save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
