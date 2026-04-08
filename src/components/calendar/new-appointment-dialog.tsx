/** --- YAML
 * name: NewAppointmentDialog
 * description: Dialog for creating appointments — select client, service, date, time
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterId: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultClientId?: string;
  defaultServiceId?: string;
  onCreated: () => void;
}

interface ClientOption { id: string; full_name: string }
interface ServiceOption { id: string; name: string; duration_minutes: number; price: number; currency: string }

export function NewAppointmentDialog({ open, onOpenChange, masterId, defaultDate, defaultTime, defaultClientId, defaultServiceId, onCreated }: Props) {
  const t = useTranslations('calendar');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [serviceId, setServiceId] = useState(defaultServiceId ?? '');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(defaultTime ?? '09:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadOptions();
    if (defaultClientId) setClientId(defaultClientId);
    if (defaultServiceId) setServiceId(defaultServiceId);
    if (defaultDate) setDate(defaultDate);
    if (defaultTime) setTime(defaultTime);
  }, [open, defaultClientId, defaultServiceId, defaultDate, defaultTime]);

  async function loadOptions() {
    const supabase = createClient();
    const [clientsRes, servicesRes] = await Promise.all([
      supabase.from('clients').select('id, full_name').eq('master_id', masterId).order('full_name').limit(200),
      supabase.from('services').select('id, name, duration_minutes, price, currency').eq('master_id', masterId).eq('is_active', true).order('name'),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !serviceId) { toast.error(tc('required')); return; }

    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const startsAt = new Date(`${date}T${time}:00`);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('appointments').insert({
      client_id: clientId,
      master_id: masterId,
      service_id: serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
      currency: service.currency,
      notes: notes || null,
      status: 'booked',
      booked_via: 'manual',
    });
    setSaving(false);

    if (error) { toast.error(error.message); return; }
    toast.success(tb('bookingSuccess'));
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newAppointment')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{tb('selectService')}</Label>
            <Select value={serviceId} onValueChange={(v) => v && setServiceId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={tb('selectService')} /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min — {s.price} {s.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{tb('selectDate')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{tb('selectTime')}</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} />
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{tb('selectService')} notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? tc('loading') : tc('confirm')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
