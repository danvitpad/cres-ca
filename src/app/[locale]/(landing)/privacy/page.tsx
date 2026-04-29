/** --- YAML
 * name: Privacy Policy
 * description: Public privacy policy page — мигрировано на общий шаблон LegalPage.
 * --- */

import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/landing/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'CRES-CA privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      sections={[
        { title: t('collectionTitle'), body: t('collectionText') },
        { title: t('useTitle'),        body: t('useText')        },
        { title: t('sharingTitle'),    body: t('sharingText')    },
        { title: t('cookiesTitle'),    body: t('cookiesText')    },
        { title: t('securityTitle'),   body: t('securityText')   },
        { title: t('rightsTitle'),     body: t('rightsText')     },
        { title: t('contactTitle'),    body: t('contactText')    },
      ]}
    />
  );
}
