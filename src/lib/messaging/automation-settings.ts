/** --- YAML
 * name: automationSettingsMap
 * description: Загрузка master_automation_settings для набора мастеров в виде Map<master_id, Settings>. Используется cron-джобами для фильтрации — если настройка отсутствует, применяются дефолты.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AutomationSettings {
  reminder_24h: boolean;
  reminder_2h: boolean;
  review_request: boolean;
  cadence: boolean;
  win_back: boolean;
  nps: boolean;
  auto_release: boolean;
}

export const AUTOMATION_DEFAULTS: AutomationSettings = {
  reminder_24h: true,
  reminder_2h: true,
  review_request: true,
  cadence: false,
  win_back: false,
  nps: false,
  auto_release: false,
};

export async function loadAutomationSettings(
  supabase: SupabaseClient,
  masterIds: string[],
): Promise<Map<string, AutomationSettings>> {
  const map = new Map<string, AutomationSettings>();
  if (masterIds.length === 0) return map;
  const { data } = await supabase
    .from('master_automation_settings')
    .select('master_id, reminder_24h, reminder_2h, review_request, cadence, win_back, nps, auto_release')
    .in('master_id', masterIds);
  for (const row of (data ?? []) as (AutomationSettings & { master_id: string })[]) {
    map.set(row.master_id, {
      reminder_24h: row.reminder_24h,
      reminder_2h: row.reminder_2h,
      review_request: row.review_request,
      cadence: row.cadence,
      win_back: row.win_back,
      nps: row.nps,
      auto_release: row.auto_release ?? false,
    });
  }
  return map;
}

export function isEnabled(
  settings: Map<string, AutomationSettings>,
  masterId: string,
  key: keyof AutomationSettings,
): boolean {
  const s = settings.get(masterId);
  if (!s) return AUTOMATION_DEFAULTS[key];
  return s[key];
}
