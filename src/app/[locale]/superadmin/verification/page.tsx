/** --- YAML
 * name: Superadmin verification
 * description: Queue of pending identity / expertise verification requests with preview + approve/reject.
 * created: 2026-04-24
 * --- */

import { listVerificationRequests } from '@/lib/superadmin/verification-data';
import { VerificationClient } from '@/components/superadmin/verification-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminVerificationPage() {
  const rows = await listVerificationRequests('pending');
  return (
    <div className="p-6">
      <div className="mb-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Верификация</h1>
        <p className="mt-1 text-[13px] text-white/50">Заявки на подтверждение личности и сертификатов мастеров. Всего: {rows.length}.</p>
      </div>
      <VerificationClient rows={rows} />
    </div>
  );
}
