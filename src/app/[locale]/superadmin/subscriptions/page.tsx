/** --- YAML
 * name: Superadmin subscriptions
 * description: Tabs (Активные / Триал / Whitelist / Отменённые) with per-row actions — extend trial, override plan, cancel, jump to whitelist.
 * created: 2026-04-19
 * --- */

import { getSubscriptionsBuckets } from '@/lib/superadmin/subscriptions-data';
import { SubscriptionsClient } from '@/components/superadmin/subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminSubscriptionsPage() {
  const buckets = await getSubscriptionsBuckets();
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Подписки</h1>
        <p className="mt-1 text-[13px] text-white/50">Управление активными подписками, триалами и whitelist-доступами.</p>
      </div>

      <SubscriptionsClient buckets={buckets} />
    </div>
  );
}
