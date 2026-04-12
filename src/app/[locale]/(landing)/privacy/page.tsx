/** --- YAML
 * name: Privacy Policy
 * description: Public privacy policy page
 * --- */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'CRES-CA privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <div className="mx-auto max-w-3xl px-[var(--space-page)] py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        CRES-CA
      </Link>

      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('lastUpdated')}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('collectionTitle')}</h2>
          <p>{t('collectionText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('useTitle')}</h2>
          <p>{t('useText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('sharingTitle')}</h2>
          <p>{t('sharingText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('cookiesTitle')}</h2>
          <p>{t('cookiesText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('securityTitle')}</h2>
          <p>{t('securityText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('rightsTitle')}</h2>
          <p>{t('rightsText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('contactTitle')}</h2>
          <p>{t('contactText')}</p>
        </section>
      </div>
    </div>
  );
}
