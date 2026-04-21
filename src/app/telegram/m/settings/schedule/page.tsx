/** --- YAML
 * name: MasterMiniAppSettings/Schedule
 * description: Mobile weekly schedule editor for Mini App master. 7 day rows, toggle off/on + start/end inputs.
 * created: 2026-04-20
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';

interface WorkingDay { start: string; end: string }
type WorkingHours = Record<string, WorkingDay | null>;

const DAYS: Array<{ key: string; label: string; short: string }> = [
  { key: 'monday', label: 'Понедельник', short: 'Пн' },
  { key: 'tuesday', label: 'Вторник', short: 'Вт' },
  { key: 'wednesday', label: 'Среда', short: 'Ср' },
  { key: 'thursday', label: 'Четверг', short: 'Чт' },
  { key: 'friday', label: 'Пятница', short: 'Пт' },
  { key: 'saturday', label: 'Суббота', short: 'Сб' },
  { key: 'sunday', label: 'Воскресенье', short: 'Вс' },
];

const DEFAULT: WorkingDay = { start: '10:00', end: '19:00' };

export default function MiniAppSchedulePage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [hours, setHours] = useState<WorkingHours>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('masters')
      .select('id, working_hours')
      .eq('profile_id', userId)
      .maybeSingle();
    if (data) {
      setMasterId(data.id);
      const wh = (data.working_hours as WorkingHours | null) ?? {};
      // Initialise missing days to null (off)
      const filled: WorkingHours = {};
      for (const d of DAYS) filled[d.key] = wh[d.key] ?? null;
      setHours(filled);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function toggleDay(key: string) {
    haptic('selection');
    setHours((h) => ({ ...h, [key]: h[key] ? null : { ...DEFAULT } }));
  }

  function setTime(key: string, field: 'start' | 'end', value: string) {
    setHours((h) => {
      const current = h[key] ?? { ...DEFAULT };
      return { ...h, [key]: { ...current, [field]: value } };
    });
  }

  async function save() {
    if (!masterId || saving) return;
    setSaving(true);
    haptic('medium');
    const supabase = createClient();
    const { error } = await supabase
      .from('masters')
      .update({ working_hours: hours })
      .eq('id', masterId);
    setSaving(false);
    if (error) {
      haptic('error');
      return;
    }
    haptic('success');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <SettingsShell title="График работы">
        <div className="h-40 w-full animate-pulse rounded-2xl bg-white/[0.04]" />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="График работы" subtitle="Дни и часы приёма клиентов">
      <ul className="space-y-2">
        {DAYS.map((d) => {
          const active = !!hours[d.key];
          const day = hours[d.key];
          return (
            <li
              key={d.key}
              className={`rounded-2xl border p-3 transition-colors ${
                active
                  ? 'border-violet-500/25 bg-violet-500/[0.08]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleDay(d.key)}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    active
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : 'border-white/15 bg-white/[0.03] text-white/30'
                  }`}
                >
                  {active && <Check size={14} weight="bold" />}
                </button>
                <span className="flex-1 text-[14px] font-medium">{d.label}</span>
                {!active && <span className="text-[11px] text-white/30">выходной</span>}
              </div>
              {active && day && (
                <div className="mt-3 flex items-center gap-2 pl-11">
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => setTime(d.key, 'start', e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] tabular-nums text-white focus:border-violet-500/40 focus:outline-none"
                  />
                  <span className="text-[12px] text-white/40">—</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => setTime(d.key, 'end', e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] tabular-nums text-white focus:border-violet-500/40 focus:outline-none"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 text-[14px] font-semibold text-white active:bg-violet-600 transition-colors disabled:opacity-40"
      >
        {saving ? 'Сохраняю…' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </SettingsShell>
  );
}
