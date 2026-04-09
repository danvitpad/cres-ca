/** --- YAML
 * name: RecurringToggle
 * description: After booking completion, option to make the appointment recurring
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface RecurringToggleProps {
  appointmentId: string;
  clientId: string;
  masterId: string;
  serviceId: string;
  appointmentDate: Date;
  onCreated?: () => void;
}

const INTERVALS = [
  { days: 7, key: 'everyWeek' },
  { days: 14, key: 'every2Weeks' },
  { days: 21, key: 'every3Weeks' },
  { days: 28, key: 'everyMonth' },
] as const;

export function RecurringToggle({
  clientId,
  masterId,
  serviceId,
  appointmentDate,
  onCreated,
}: RecurringToggleProps) {
  const t = useTranslations('recurring');
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCreate() {
    if (!selected) return;
    setSaving(true);

    const nextDate = new Date(appointmentDate);
    nextDate.setDate(nextDate.getDate() + selected);

    const supabase = createClient();
    const { error } = await supabase.from('recurring_bookings').insert({
      client_id: clientId,
      master_id: masterId,
      service_id: serviceId,
      interval_days: selected,
      preferred_day_of_week: appointmentDate.getDay() === 0 ? 6 : appointmentDate.getDay() - 1,
      preferred_time: `${String(appointmentDate.getHours()).padStart(2, '0')}:${String(appointmentDate.getMinutes()).padStart(2, '0')}`,
      next_booking_date: nextDate.toISOString().slice(0, 10),
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('created'));
      setDone(true);
      onCreated?.();
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        <Repeat className="h-4 w-4" />
        {t('active')}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Repeat className="h-4 w-4 text-[var(--ds-accent)]" />
        {t('makeRecurring')}
      </div>
      <div className="flex flex-wrap gap-2">
        {INTERVALS.map(({ days, key }) => (
          <button
            key={days}
            onClick={() => setSelected(selected === days ? null : days)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selected === days
                ? 'bg-[var(--ds-accent)] text-white'
                : 'border bg-background hover:bg-muted',
            )}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {selected && (
        <button
          onClick={handleCreate}
          disabled={saving}
          className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)] disabled:opacity-50"
        >
          {t('confirm')}
        </button>
      )}
    </div>
  );
}
