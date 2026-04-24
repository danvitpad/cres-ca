/** --- YAML
 * name: Superadmin blacklist
 * description: List of banned users with add / unban actions.
 * created: 2026-04-21
 * --- */

import { listBlacklist } from '@/lib/superadmin/blacklist-data';
import { BlacklistClient } from '@/components/superadmin/blacklist-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminBlacklistPage() {
  const rows = await listBlacklist();

  return (
    <div className="p-6">
      <div className="mb-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Blacklist · Заблокированные</h1>
      </div>
      <BlacklistClient rows={rows} />
    </div>
  );
}
