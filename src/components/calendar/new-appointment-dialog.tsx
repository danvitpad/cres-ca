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
  /** Role of the actor creating this appointment. Defaults to 'master' (solo flow). */
  createdByRole?: 'master' | 'admin' | 'receptionist';
}

interface ClientOption { id: string; full_name: string }
interface ServiceOption { id: string; name: string; duration_minutes: number; price: number; currency: string }

export function NewAppointmentDialog({
  open, onOpenChange, masterId, defaultDate, defaultTime, defaultClientId, defaultServiceId, onCreated, createdByRole = 'master',
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
    e.stopPropagation();
    if (!serviceId) { toast.error('Выберите услугу'); return; }
    if (!clientId) { toast.error('Выберите клиента'); return; }

    const service = services.find((s) => s.id === serviceId);
    if (!service) { toast.error('Услуга не найдена'); return; }

    if (!date || !time) { toast.error('Укажите дату и время'); return; }
    const startsAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error(`Некорректные дата/время: ${date} ${time}`);
      return;
    }
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    setSaving(true);
    const supabase = createClient();

    let inserted: { id: string } | null = null;
    try {
      const { data: masterRow } = await supabase
        .from('masters').select('salon_id').eq('id', masterId).maybeSingle();
      const masterSalonId = (masterRow as { salon_id: string | null } | null)?.salon_id ?? null;

      const { data, error } = await supabase.from('appointments').insert({
        client_id: clientId,
        master_id: masterId,
        service_id: serviceId,
        salon_id: masterSalonId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price: service.price,
        currency: service.currency,
        notes: notes || null,
        status: 'booked',
        booked_via: 'manual',
        created_by_role: createdByRole,
      }).select('id').single();
      setSaving(false);

      if (error) {
        console.error('[new-appointment-dialog] insert error:', error);
        toast.error(error.message || 'Не удалось создать запись');
        return;
      }
      inserted = data as { id: string } | null;
    } catch (err) {
      setSaving(false);
      console.error('[new-appointment-dialog] insert threw:', err);
      toast.error((err as Error).message || 'Ошибка при создании записи');
      return;
    }

    // Fire-and-forget notification to client — via /api/notifications/dispatch
    // so it's delivered to Telegram immediately (not queued for daily cron).
    if (clientId) {
      const { data: clientRow } = await supabase
        .from('clients').select('profile_id').eq('id', clientId).single();
      if (clientRow?.profile_id) {
        const when = new Date(startsAt).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        fetch('/api/notifications/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: clientRow.profile_id,
            title: '📅 Вам записали визит',
            body: `${service.name}\n${when}`,
            data: { type: 'new_appointment', appointment_id: inserted?.id },
          }),
        }).catch(() => { /* fire-and-forget */ });
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
