/** --- YAML
 * name: Cookies Policy
 * description: Public cookies policy page — мигрировано на общий шаблон LegalPage.
 * created: 2026-04-19
 * --- */

import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/landing/legal-page';

export const metadata: Metadata = {
  title: 'Cookies Policy',
  description: 'CRES-CA cookies policy — what cookies we use and why.',
};

export default function CookiesPage() {
  const t = useTranslations('cookies');

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      sections={[
        { title: t('whatTitle'),       body: t('whatText')       },
        { title: t('typesTitle'),      body: t('typesText')      },
        { title: t('essentialTitle'),  body: t('essentialText')  },
        { title: t('analyticsTitle'),  body: t('analyticsText')  },
        { title: t('thirdPartyTitle'), body: t('thirdPartyText') },
        { title: t('controlTitle'),    body: t('controlText')    },
        { title: t('contactTitle'),    body: t('contactText')    },
      ]}
    />
  );
}
