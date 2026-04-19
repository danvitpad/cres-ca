/** --- YAML
 * name: Superadmin offers
 * description: Campaign list + create wizard. Server-side listOffers() feeds the client with buckets (all / draft / scheduled / sent / cancelled).
 * created: 2026-04-19
 * --- */

import { listOffers } from '@/lib/superadmin/offers-data';
import { OffersClient } from '@/components/superadmin/offers-client';

export const dynamic = 'force-dynamic';

export default async function SuperadminOffersPage() {
  const rows = await listOffers();
  return (
    <div className="p-6">
      <div className="mb-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">Спецпредложения</h1>
        <p className="mt-1 text-[13px] text-white/50">Рассылки, акции, промокоды. Получатели — мастера, салоны или сегменты.</p>
      </div>
      <OffersClient rows={rows} />
    </div>
  );
}
