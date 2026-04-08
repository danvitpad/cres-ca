/** --- YAML
 * name: Services Page
 * description: Service catalog management — full CRUD with dialog form, categories, Zod validation
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryManager, type Category } from '@/components/shared/category-manager';
import { Plus, Pencil, Trash2, Clock, DollarSign } from 'lucide-react';

const serviceSchema = z.object({
  name: z.string().min(1),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0),
  currency: z.string().default('UAH'),
  category_id: z.string().uuid().nullable().optional(),
  requires_prepayment: z.boolean().default(false),
  prepayment_amount: z.number().min(0).default(0),
  color: z.string().default('#6366f1'),
});

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string;
  category_id: string | null;
  requires_prepayment: boolean;
  prepayment_amount: number;
  is_active: boolean;
  category: { name: string; color: string } | null;
}

export default function ServicesPage() {
  const t = useTranslations('services');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const loadServices = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('services')
      .select('*, category:service_categories(name, color)')
      .eq('master_id', master.id)
      .order('created_at');
    if (data) setServices(data as unknown as ServiceRow[]);
    setLoading(false);
  }, [master]);

  useEffect(() => { loadServices(); }, [loadServices]);

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm(tp('deleteConfirm'))) return;
    const supabase = createClient();
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) toast.error(error.message);
    else loadServices();
  }

  if (masterLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!master) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('addService')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openNew} />}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addService')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? tp('editService') : t('addService')}</DialogTitle>
            </DialogHeader>
            <ServiceForm
              masterId={master.id}
              categories={categories}
              editing={editing}
              onSaved={() => { setDialogOpen(false); loadServices(); }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{tp('addCategory')}</h3>
        <CategoryManager masterId={master.id} onCategoriesChange={setCategories} />
      </div>

      {services.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {t('noServices')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <h3 className="font-medium">{s.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {s.category && (
                  <span className="text-xs text-muted-foreground">{s.category.name}</span>
                )}
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_minutes} {t('duration')}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{s.price} {s.currency}</span>
                </div>
                {s.requires_prepayment && (
                  <span className="mt-1 inline-block text-xs text-amber-600">{tp('prepayment')}: {s.prepayment_amount} {s.currency}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceForm({
  masterId,
  categories,
  editing,
  onSaved,
  onCancel,
}: {
  masterId: string;
  categories: Category[];
  editing: ServiceRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('services');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [duration, setDuration] = useState(String(editing?.duration_minutes ?? 60));
  const [price, setPrice] = useState(String(editing?.price ?? 0));
  const [currency, setCurrency] = useState(editing?.currency ?? 'UAH');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [color, setColor] = useState(editing?.color ?? '#6366f1');
  const [requiresPrepayment, setRequiresPrepayment] = useState(editing?.requires_prepayment ?? false);
  const [prepaymentAmount, setPrepaymentAmount] = useState(String(editing?.prepayment_amount ?? 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = serviceSchema.safeParse({
      name,
      duration_minutes: parseInt(duration),
      price: parseFloat(price),
      currency,
      category_id: categoryId || null,
      color,
      requires_prepayment: requiresPrepayment,
      prepayment_amount: parseFloat(prepaymentAmount) || 0,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? tc('error'));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = { ...parsed.data, master_id: masterId };

    const { error } = editing
      ? await supabase.from('services').update(payload).eq('id', editing.id)
      : await supabase.from('services').insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tc('success'));
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('serviceName')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{t('duration')}</Label>
          <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('price')}</Label>
          <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{tp('currency')}</Label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UAH">UAH</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('category')}</Label>
          <Select value={categoryId ?? '__none'} onValueChange={(v) => v && setCategoryId(v === '__none' ? null : v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label>{tp('color')}</Label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border" />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={requiresPrepayment} onCheckedChange={setRequiresPrepayment} />
        <Label>{tp('prepayment')}</Label>
      </div>

      {requiresPrepayment && (
        <div className="space-y-2">
          <Label>{tp('prepaymentAmount')}</Label>
          <Input type="number" min={0} step="0.01" value={prepaymentAmount} onChange={(e) => setPrepaymentAmount(e.target.value)} />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{tc('cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
      </div>
    </form>
  );
}
