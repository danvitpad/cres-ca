/** --- YAML
 * name: Map Page
 * description: OpenStreetMap view showing nearby masters with ratings. Uses Leaflet.
 * --- */

import { useTranslations } from 'next-intl';

export default function MapPage() {
  const t = useTranslations('map');

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t('nearbyMasters')}</h2>
      <div className="rounded-lg border h-[60vh] flex items-center justify-center text-muted-foreground">
        {t('showOnMap')} — Leaflet map will render here
      </div>
    </div>
  );
}
