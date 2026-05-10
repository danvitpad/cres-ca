/** --- YAML
 * name: WaitlistButton
 * description: Триггер кнопки «Встать в очередь» — открывает WaitlistDialog
 *              где клиент выбирает удобные дни недели + время суток. Сохранение
 *              через /api/waitlist (см. /src/components/client/waitlist-dialog.tsx).
 *              Используется на client booking page когда нет свободных слотов.
 * created: 2026-04-30
 * updated: 2026-05-10
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WaitlistDialog } from '@/components/client/waitlist-dialog';

interface WaitlistButtonProps {
  masterId: string;
  masterName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
}

export function WaitlistButton({ masterId, masterName, serviceId, serviceName }: WaitlistButtonProps) {
  const t = useTranslations('booking');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Bell className="size-4" />
        {t('joinWaitlist')}
      </Button>
      <WaitlistDialog
        open={open}
        onClose={() => setOpen(false)}
        masterId={masterId}
        masterName={masterName ?? undefined}
        serviceId={serviceId ?? undefined}
        serviceName={serviceName ?? undefined}
      />
    </>
  );
}
