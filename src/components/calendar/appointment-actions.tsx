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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Phone, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
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
      }
    }

    // On cancel: increment cancellation count + notify waitlist
    if (newStatus === 'cancelled') {
      await supabase.from('clients').update({
        cancellation_count: (await supabase.from('clients').select('cancellation_count').eq('id', appointment.client_id).single()).data?.cancellation_count + 1 || 1,
      }).eq('id', appointment.client_id);

      // Notify first person on waitlist for this date
      const aptDate = new Date(appointment.starts_at).toISOString().split('T')[0];
      const { data: waitlistEntry } = await supabase
        .from('waitlist')
        .select('id, client_id, clients(profile_id)')
        .eq('master_id', appointment.master_id)
        .eq('desired_date', aptDate)
        .limit(1)
        .single();

      if (waitlistEntry) {
        const clientData = waitlistEntry.clients as unknown as { profile_id: string | null } | null;
        if (clientData?.profile_id) {
          await supabase.from('notifications').insert({
            profile_id: clientData.profile_id,
            channel: 'telegram',
            title: '🎉 A slot just opened up!',
            body: `Good news! A time slot became available on ${aptDate}. Book now before it's taken!`,
            scheduled_for: new Date().toISOString(),
          });
        }
        // Remove from waitlist
        await supabase.from('waitlist').delete().eq('id', waitlistEntry.id);
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

  const time = `${new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(appointment.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{appointment.service?.name ?? '—'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <button
                className="text-primary hover:underline"
                onClick={() => { onOpenChange(false); router.push(`/clients/${appointment.client_id}`); }}
              >
                {appointment.client?.full_name ?? '—'}
              </button>
              {appointment.client?.has_health_alert && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            {appointment.client?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${appointment.client.phone}`} className="hover:underline">{appointment.client.phone}</a>
              </div>
            )}
            <div className="text-muted-foreground">{time}</div>
            <div className="font-medium">{appointment.price} {appointment.currency}</div>
            <Badge variant="outline">{t(`status.${appointment.status}`)}</Badge>
          </div>

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

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
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
              className="text-red-500"
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
