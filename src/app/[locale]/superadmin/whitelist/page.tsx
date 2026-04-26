/** --- YAML
 * name: Superadmin whitelist
 * description: List of free-access grants with add / remove actions.
 * created: 2026-04-19
 * --- */

import { listWhitelist } from '@/lib/superadmin/whitelist-data';
import { WhitelistClient } from '@/components/superadmin/whitelist-client';


export default async function SuperadminWhitelistPage({
  searchParams,
}: {
  searchParams: Promise<{ profile_id?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listWhitelist();

  return (
    <div className="p-6">
      <div className="mb-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Whitelist · Бесплатный доступ</h1>
      </div>
      <WhitelistClient rows={rows} preselectProfileId={sp.profile_id} />
    </div>
  );
}
