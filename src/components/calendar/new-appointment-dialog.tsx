/** --- YAML
 * name: NewAppointmentDialog
 * description: Dialog for creating appointments — select service, client, date, time. Uses themed native selects (base-UI Select was showing raw UUIDs for selected value).
 * created: 2026-04-17
 * updated: 2026-04-18
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select-animated';
import { FONT, FONT_FEATURES } from '@/lib/dashboard-theme';

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

interface ClientOption { id: string; full_name: string; no_show_count?: number }
interface ServiceOption { id: string; name: string; duration_minutes: number; price: number; currency: string }

export function NewAppointmentDialog({
  open, onOpenChange, masterId, defaultDate, defaultTime, defaultClientId, defaultServiceId, onCreated, createdByRole = 'master',
}: Props) {
  const t = useTranslations('calendar');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [clientIds, setClientIds] = useState<string[]>(defaultClientId ? [defaultClientId] : []);
  const [pendingClient, setPendingClient] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId ?? '');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(defaultTime ?? '09:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadOptions();
    setClientIds(defaultClientId ? [defaultClientId] : []);
    setPendingClient('');
    setServiceId(defaultServiceId ?? '');
    if (defaultDate) setDate(defaultDate);
    if (defaultTime) setTime(defaultTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultClientId, defaultServiceId, defaultDate, defaultTime]);

  async function loadOptions() {
    const supabase = createClient();
    const [clientsRes, servicesRes] = await Promise.all([
      supabase.from('clients').select('id, full_name, no_show_count').eq('master_id', masterId).order('full_name').limit(200),
      supabase.from('services').select('id, name, duration_minutes, price, currency').eq('master_id', masterId).eq('is_active', true).order('name'),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
  }

  function addClient(id: string) {
    if (!id) return;
    if (clientIds.includes(id)) return;
    setClientIds((prev) => [...prev, id]);
    setPendingClient('');
  }

  function removeClient(id: string) {
    setClientIds((prev) => prev.filter((cid) => cid !== id));
  }

  const availableClients = clients.filter((c) => !clientIds.includes(c.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!serviceId) { toast.error('Выберите услугу'); return; }
    if (clientIds.length === 0) { toast.error('Добавьте хотя бы одного клиента'); return; }

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

    const inserted: Array<{ id: string; client_id: string }> = [];
    try {
      const { data: masterRow } = await supabase
        .from('masters').select('salon_id').eq('id', masterId).maybeSingle();
      const masterSalonId = (masterRow as { salon_id: string | null } | null)?.salon_id ?? null;

      // Insert one appointment per selected client (group booking = parallel slots)
      const rows = clientIds.map((cid) => ({
        client_id: cid,
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
      }));

      const { data, error } = await supabase.from('appointments').insert(rows).select('id, client_id');
      setSaving(false);

      if (error) {
        console.error('[new-appointment-dialog] insert error:', error);
        toast.error(error.message || 'Не удалось создать запись');
        return;
      }
      if (data) inserted.push(...(data as Array<{ id: string; client_id: string }>));
    } catch (err) {
      setSaving(false);
      console.error('[new-appointment-dialog] insert threw:', err);
      toast.error((err as Error).message || 'Ошибка при создании записи');
      return;
    }

    // Fire-and-forget notifications to each client (per-appointment)
    for (const appt of inserted) {
      const { data: clientRow } = await supabase
        .from('clients').select('profile_id').eq('id', appt.client_id).single();
      if (clientRow?.profile_id) {
        // Full master name: prefer profile.full_name, fall back to masters.display_name
        const { data: masterRow2 } = await supabase
          .from('masters')
          .select('display_name, profile:profiles!masters_profile_id_fkey(full_name)')
          .eq('id', masterId)
          .maybeSingle();
        const mProfile = (masterRow2 as { profile?: { full_name?: string } | null } | null)?.profile;
        const mDisplay = (masterRow2 as { display_name?: string | null } | null)?.display_name;
        const masterName = mProfile?.full_name || mDisplay || 'мастер';

        const dateStr = startsAt.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = startsAt.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
        const priceNum = Number(service.price || 0);
        const priceStr = priceNum > 0
          ? `${priceNum.toLocaleString('ru')} ${service.currency || 'UAH'}`
          : 'не указана';
        const durMin = service.duration_minutes;
        const durHours = Math.floor(durMin / 60);
        const durRest = durMin % 60;
        const durStr = durHours > 0
          ? `${durHours} ч${durRest ? ` ${durRest} мин` : ''}`
          : `${durRest} мин`;

        const bodyText = [
          `Мастер: ${masterName}`,
          `Услуга: ${service.name}`,
          `Дата: ${dateStr}`,
          `Время: ${timeStr}`,
          `Стоимость: ${priceStr}`,
          `Длительность: ${durStr}`,
        ].join('\n');

        fetch('/api/notifications/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: clientRow.profile_id,
            title: '📅 Вас записали на визит',
            body: bodyText,
            data: { type: 'new_appointment', appointment_id: appt.id },
          }),
        }).catch(() => { /* fire-and-forget */ });

        // Schedule reminder notifications per client's preferences.
        // Falls back to [1 day, 2 hours] if prefs column is empty/missing.
        type ReminderPref = { value: number; unit: 'hours' | 'days' };
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('appointment_reminders_prefs')
          .eq('id', clientRow.profile_id)
          .maybeSingle();
        const prefs: ReminderPref[] = (clientProfile?.appointment_reminders_prefs as ReminderPref[] | null)
          ?? [{ value: 1, unit: 'days' }, { value: 2, unit: 'hours' }];

        const reminderRows = prefs
          .map((p) => {
            const offsetMs = p.unit === 'days' ? p.value * 24 * 60 * 60 * 1000 : p.value * 60 * 60 * 1000;
            const when = new Date(startsAt.getTime() - offsetMs);
            // Skip reminders already in the past
            if (when.getTime() <= Date.now()) return null;
            const leadLabel = p.unit === 'days'
              ? (p.value === 1 ? 'завтра' : `через ${p.value} дн.`)
              : (p.value === 1 ? 'через 1 час' : `через ${p.value} ч`);
            return {
              profile_id: clientRow.profile_id,
              channel: 'telegram' as const,
              title: `⏰ Напоминание — ${leadLabel}`,
              body: bodyText,
              status: 'pending' as const,
              scheduled_for: when.toISOString(),
              data: {
                type: 'appointment_reminder',
                appointment_id: appt.id,
                lead_value: p.value,
                lead_unit: p.unit,
              },
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (reminderRows.length) {
          await supabase.from('notifications').insert(reminderRows);
        }
      }
    }

    toast.success('Запись успешно создана');
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
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger placeholder={tb('selectService')} />
              <SelectContent>
                {services.map((s, i) => (
                  <SelectItem key={s.id} index={i} value={s.id}>
                    {s.name} · {s.duration_minutes} мин · {s.price} {s.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Multi-client — chips + add dropdown */}
          <div className="space-y-2">
            <Label>
              {clientIds.length > 1 ? `Клиенты (${clientIds.length})` : tb('selectClient')}
            </Label>
            {clientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clientIds.map((cid) => {
                  const c = clients.find((x) => x.id === cid);
                  if (!c) return null;
                  const risky = (c.no_show_count ?? 0) >= 2;
                  return (
                    <span
                      key={cid}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                        risky
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-100'
                          : 'border-violet-500/30 bg-violet-500/15 text-violet-100'
                      }`}
                      title={risky ? `У клиента ${c.no_show_count} пропусков — рекомендуется предоплата` : undefined}
                    >
                      {c.full_name}
                      {risky && <span className="text-[10px] opacity-70">⚠ {c.no_show_count}×</span>}
                      <button
                        type="button"
                        onClick={() => removeClient(cid)}
                        className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-white/10"
                        aria-label="Удалить клиента"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {availableClients.length > 0 && (
              <Select
                value={pendingClient}
                onValueChange={(v) => addClient(v)}
              >
                <SelectTrigger
                  placeholder={clientIds.length === 0 ? tb('selectClient') : 'Добавить ещё клиента'}
                />
                <SelectContent>
                  {availableClients.map((c, i) => (
                    <SelectItem key={c.id} index={i} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
