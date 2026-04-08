/** --- YAML
 * name: Marketing Page
 * description: Marketing tools — referrals, campaigns, auto-messages, review collection
 * --- */

import { useTranslations } from 'next-intl';

export default function MarketingPage() {
  const t = useTranslations('dashboard');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('marketing')}</h2>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}
