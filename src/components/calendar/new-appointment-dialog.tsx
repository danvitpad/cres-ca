/** --- YAML
 * name: NewAppointmentDialog
 * description: Dialog for creating appointments — select service, client, date, time. Uses themed native selects (base-UI Select was showing raw UUIDs for selected value).
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';

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

export function NewAppointmentDialog({
  open, onOpenChange, masterId, defaultDate, defaultTime, defaultClientId, defaultServiceId, onCreated,
}: Props) {
  const t = useTranslations('calendar');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const { C } = usePageTheme();

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
    setClientId(defaultClientId ?? '');
    setServiceId(defaultServiceId ?? '');
    if (defaultDate) setDate(defaultDate);
    if (defaultTime) setTime(defaultTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectStyle = useMemo<React.CSSProperties>(() => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    fontSize: 14,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    outline: 'none',
    appearance: 'auto',
  }), [C]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) { toast.error('Выберите услугу'); return; }
    if (!clientId) { toast.error('Выберите клиента'); return; }

    const service = services.find((s) => s.id === serviceId);
    if (!service) { toast.error('Услуга не найдена'); return; }

    const startsAt = new Date(`${date}T${time}:00`);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    setSaving(true);
    const supabase = createClient();
    const { data: inserted, error } = await supabase.from('appointments').insert({
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
    }).select('id').single();
    setSaving(false);

    if (error) { toast.error(error.message); return; }

    // Fire-and-forget notification to client
    if (clientId) {
      const { data: clientRow } = await supabase
        .from('clients').select('profile_id').eq('id', clientId).single();
      if (clientRow?.profile_id) {
        await supabase.from('notifications').insert({
          profile_id: clientRow.profile_id,
          channel: 'push',
          title: 'Новая запись',
          body: `${service.name} — ${new Date(startsAt).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
          data: { type: 'new_appointment', appointment_id: inserted?.id },
        });
      }
    }

    toast.success(tb('bookingSuccess'));
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
        <DialogHeader>
          <DialogTitle>{t('newAppointment')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{tb('selectService')}</Label>
            <select
              required
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              style={selectStyle}
            >
              <option value="" disabled>{tb('selectService')}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_minutes} мин · {s.price} {s.currency}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{tb('selectDate')}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tb('selectTime')}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tb('selectClient')}</Label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={selectStyle}
            >
              <option value="" disabled>{tb('selectClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{tb('notes')}</Label>
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
