/** --- YAML
 * name: Superadmin settings
 * description: Platform settings — subscription_plans editing, env integrations status, referral bonuses, SUPERADMIN_EMAILS list, email templates link.
 * created: 2026-04-19
 * --- */

import { getPlatformSettings } from '@/lib/superadmin/settings-data';
import { SettingsClient } from '@/components/superadmin/settings-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminSettingsPage() {
  const data = await getPlatformSettings();
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Настройки платформы</h1>
        <p className="mt-1 text-[13px] text-white/50">Тарифы, интеграции, реферальные бонусы, email-шаблоны.</p>
      </div>
      <SettingsClient data={data} />
    </div>
  );
}
