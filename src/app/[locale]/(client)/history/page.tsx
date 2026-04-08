/** --- YAML
 * name: Client History Page
 * description: Client's visit history with "repeat booking" button on each past appointment
 * --- */

import { useTranslations } from 'next-intl';

export default function HistoryPage() {
  const t = useTranslations('clients');

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t('visitHistory')}</h2>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t('noClients')}
      </div>
    </div>
  );
}
