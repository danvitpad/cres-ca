/** --- YAML
 * name: Browse Masters Page
 * description: Search/browse masters by name, phone, ID. Links to master profiles.
 * --- */

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

export default function MastersPage() {
  const t = useTranslations('map');
  const tc = useTranslations('common');

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t('nearbyMasters')}</h2>
      <Input placeholder={tc('search')} />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t('searchArea')}
      </div>
    </div>
  );
}
