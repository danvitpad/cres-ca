/** --- YAML
 * name: Terms of Service
 * description: Public terms of service page — мигрировано на общий шаблон LegalPage.
 * --- */

import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/landing/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'CRES-CA terms of service — rules and conditions for using the platform.',
};

export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      sections={[
        { title: t('acceptanceTitle'),  body: t('acceptanceText')  },
        { title: t('servicesTitle'),    body: t('servicesText')    },
        { title: t('accountsTitle'),    body: t('accountsText')    },
        { title: t('paymentTitle'),     body: t('paymentText')     },
        { title: t('terminationTitle'), body: t('terminationText') },
        { title: t('liabilityTitle'),   body: t('liabilityText')   },
        { title: t('contactTitle'),     body: t('contactText')     },
      ]}
    />
  );
}
