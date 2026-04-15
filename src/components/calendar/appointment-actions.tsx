/** --- YAML
 * name: AppointmentActions
 * description: Popover/sheet for managing appointment status, cancel, no-show, repeat, completion
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Phone, RefreshCw, XCircle, AlertTriangle, CheckCircle2, Clock, DollarSign, Briefcase } from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';
import type { AppointmentStatus } from '@/types';

interface Props {
  appointment: AppointmentData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onRepeat: (appointment: AppointmentData) => void;
}

const STATUS_ORDER: AppointmentStatus[] = ['booked', 'confirmed', 'in_progress', 'completed'];

export function AppointmentActions({ appointment, open, onOpenChange, onUpdated, onRepeat }: Props) {
  const t = useTranslations('calendar');
  const tc = useTranslations('common');
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  if (!appointment) return null;

  async function updateStatus(newStatus: AppointmentStatus) {
    if (!appointment) return;
    setUpdating(true);
    const supabase = createClient();

    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointment.id);

    if (error) { toast.error(error.message); setUpdating(false); return; }

    // On completion: update client stats + auto-deduct inventory
    if (newStatus === 'completed') {
      await supabase.rpc('increment_client_stats', {
        p_client_id: appointment.client_id,
        p_amount: appointment.price,
      }).then(() => {}, () => {}); // Ignore if RPC doesn't exist yet

      // Auto-deduct inventory based on service recipe
      if (appointment.service_id) {
        const { data: svc } = await supabase
          .from('services')
          .select('inventory_recipe')
          .eq('id', appointment.service_id)
          .single();

        if (svc?.inventory_recipe && Array.isArray(svc.inventory_recipe)) {
          for (const item of svc.inventory_recipe as { item_id: string; quantity: number }[]) {
            // Deduct from inventory
            const { data: inv } = await supabase
              .from('inventory_items')
              .select('quantity')
              .eq('id', item.item_id)
              .single();
            if (inv) {
              await supabase.from('inventory_items').update({
                quantity: Math.max(0, inv.quantity - item.quantity),
              }).eq('id', item.item_id);
              // Log usage
              await supabase.from('inventory_usage').insert({
                item_id: item.item_id,
                appointment_id: appointment.id,
                quantity_used: item.quantity,
              });
            }
          }
        }

        // Auto-sale: recommend complementary products for this service
        const { data: client } = await supabase
          .from('clients')
          .select('profile_id, full_name')
          .eq('id', appointment.client_id)
          .single();
        if (client?.profile_id) {
          const { data: recs } = await supabase
            .from('product_recommendations')
            .select('id, message_template, product:products(id, name, price, currency, is_active)')
            .eq('service_id', appointment.service_id);
          const rows = ((recs ?? []) as unknown as {
            id: string;
            message_template: string | null;
            product: { id: string; name: string; price: number; currency: string; is_active: boolean } | { id: string; name: string; price: number; currency: string; is_active: boolean }[] | null;
          }[])
            .map((r) => {
              const p = Array.isArray(r.product) ? r.product[0] : r.product;
              if (!p || !p.is_active) return null;
              const msg = r.message_template ?? `Рекомендуем для ухода: ${p.name}`;
              return {
                profile_id: client.profile_id,
                channel: 'telegram',
                title: '✨ Рекомендация после визита',
                body: `${msg} — ${p.name}, ${p.price} ${p.currency}. [product:${p.id}:${appointment.id}]`,
                scheduled_for: new Date().toISOString(),
              };
            })
            .filter((x): x is NonNullable<typeof x> => !!x);
          if (rows.length) await supabase.from('notifications').insert(rows);
        }
      }
    }

    // On cancel: increment cancellation count + notify waitlist
    if (newStatus === 'cancelled') {
      await supabase.from('clients').update({
        cancellation_count: (await supabase.from('clients').select('cancellation_count').eq('id', appointment.client_id).single()).data?.cancellation_count + 1 || 1,
      }).eq('id', appointment.client_id);

      // Notify everyone on waitlist for this date (first-come wins, but all get pinged)
      const aptDate = new Date(appointment.starts_at).toISOString().split('T')[0];
      const slotTime = new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const { data: waitlistEntries } = await supabase
        .from('waitlist')
        .select('id, client_id, clients(profile_id)')
        .eq('master_id', appointment.master_id)
        .eq('desired_date', aptDate)
        .order('created_at', { ascending: true });

      if (waitlistEntries?.length) {
        const notifyRows = waitlistEntries
          .map((w) => {
            const c = w.clients as unknown as { profile_id: string | null } | null;
            if (!c?.profile_id) return null;
            return {
              profile_id: c.profile_id,
              channel: 'telegram',
              title: '🎉 A slot just opened up!',
              body: `A time slot became available on ${aptDate} at ${slotTime}. Open /book to grab it. [waitlist:${appointment.id}]`,
              scheduled_for: new Date().toISOString(),
            };
          })
          .filter((x): x is NonNullable<typeof x> => !!x);
        if (notifyRows.length) await supabase.from('notifications').insert(notifyRows);
        await supabase
          .from('waitlist')
          .delete()
          .in('id', waitlistEntries.map((w) => w.id));
      }
    }

    // On no-show
    if (newStatus === 'no_show') {
      await supabase.from('clients').update({
        no_show_count: (await supabase.from('clients').select('no_show_count').eq('id', appointment.client_id).single()).data?.no_show_count + 1 || 1,
      }).eq('id', appointment.client_id);
    }

    setUpdating(false);
    toast.success(tc('success'));
    onOpenChange(false);
    onUpdated();
  }

  const timeStart = new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeEnd = new Date(appointment.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(appointment.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const durationMin = Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000);
  const isCompleted = appointment.status === 'completed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted && <CheckCircle2 className="size-5 text-emerald-500" />}
            {appointment.service?.name ?? '—'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client info */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <User className="size-5 text-primary" />
            </div>
            <div>
              <button
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                onClick={() => { onOpenChange(false); router.push(`/clients/${appointment.client_id}`); }}
              >
                {appointment.client?.full_name ?? '—'}
                {appointment.client?.has_health_alert && <AlertTriangle className="size-3.5 text-red-500" />}
              </button>
              {appointment.client?.phone && (
                <a href={`tel:${appointment.client.phone}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                  <Phone className="size-3" />
                  {appointment.client.phone}
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Visit details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('time') || 'Time'}</p>
                <p className="font-medium">{timeStart} — {timeEnd}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
                <p className="font-medium">{durationMin} min</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('price') || 'Price'}</p>
                <p className="font-medium">{appointment.price} {appointment.currency}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="size-4 flex items-center justify-center">
                <div className={`size-2.5 rounded-full ${
                  appointment.status === 'completed' ? 'bg-emerald-500' :
                  appointment.status === 'cancelled' ? 'bg-red-500' :
                  appointment.status === 'in_progress' ? 'bg-blue-500' :
                  'bg-amber-500'
                }`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                <p className="font-medium">{t(`status.${appointment.status}`)}</p>
              </div>
            </div>
          </div>

          {/* Date line */}
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
            {dateStr}
          </div>

          <Separator />

          {/* Status selector */}
          <div className="space-y-2">
            <Select value={appointment.status} onValueChange={(v) => v && updateStatus(v as AppointmentStatus)} disabled={updating}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => { onOpenChange(false); onRepeat(appointment); }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Repeat
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => updateStatus('cancelled')}
              disabled={updating || appointment.status === 'cancelled'}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              onClick={() => updateStatus('no_show')}
              disabled={updating || appointment.status === 'no_show'}
            >
              No-show
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
