/** --- YAML
 * name: MasterMiniAppSettings/Schedule
 * description: Mobile multi-interval schedule editor for Mini App master.
 *              Использует общий WorkingHoursEditor + сохраняет через
 *              /api/me/working-hours (с conflict-check).
 * created: 2026-04-20
 * updated: 2026-05-05
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { SettingsShell } from '@/components/miniapp/settings-shell';
import { WorkingHoursEditor } from '@/components/shared/working-hours-editor';
import { getInitData } from '@/lib/telegram/webapp';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { type WorkingHours } from '@/types/working-hours';
import { normalizeWorkingHours } from '@/lib/working-hours/normalize';
import '@/styles/od-master-schedule.css';

export default function MiniAppSchedulePage() {
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const initData = getInitData();
      const res = await fetch('/api/me/working-hours', {
        method: 'GET',
        headers: { ...(initData ? { 'X-TG-Init-Data': initData } : {}) },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.working_hours) setHours(normalizeWorkingHours(data.working_hours));
      }
      setLoading(false);
    })();
  }, []);

  const subtitle = lang === 'uk'
    ? 'Дні та робочі вікна. Можна додати кілька слотів в один день.'
    : lang === 'en'
    ? 'Days and working windows. Multiple slots per day allowed.'
    : 'Дни и рабочие окна. Можно несколько слотов в одном дне.';

  const title = lang === 'uk' ? 'Графік роботи' : lang === 'en' ? 'Schedule' : 'График работы';

  if (loading) {
    return (
      <SettingsShell title={title}>
        <div className="h-40 w-full animate-pulse rounded-2xl bg-white border-neutral-200" />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title={title} subtitle={subtitle}>
      <div className="od-master-schedule">
      <WorkingHoursEditor
        initial={hours}
        saveEndpoint="/api/me/working-hours"
        initData={getInitData()}
        lang={lang}
        onSaved={() => haptic('success')}
      />
      </div>
    </SettingsShell>
  );
}
