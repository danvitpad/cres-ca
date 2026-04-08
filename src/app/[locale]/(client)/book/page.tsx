/** --- YAML
 * name: Booking Page
 * description: Client booking flow — select service, date, time, confirm. Shows only free slots.
 * --- */

import { useTranslations } from 'next-intl';

export default function BookPage() {
  const t = useTranslations('booking');

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t('selectService')}</h2>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t('noSlots')}
      </div>
    </div>
  );
}
