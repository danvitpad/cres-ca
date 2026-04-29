/** --- YAML
 * name: Superadmin — Бета-тестировщики
 * description: Server page для /superadmin/beta. Загружает заявки через
 *   getBetaPageData() и передаёт их в клиентский компонент.
 * created: 2026-04-29
 * --- */

import { getBetaPageData } from '@/lib/superadmin/beta-data';
import { BetaClient } from '@/components/superadmin/beta-client';

export default async function SuperadminBetaPage() {
  const data = await getBetaPageData();
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-white">
            Бета-тестировщики
          </h1>
          <p className="mt-1 text-[12px] text-white/50">
            Управление доступом к сервису во время закрытого тестирования
          </p>
        </div>
      </div>
      <BetaClient initial={data} />
    </div>
  );
}
