/** --- YAML
 * name: Terms of Service
 * description: Public terms of service page
 * --- */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'CRES-CA terms of service — rules and conditions for using the platform.',
};

export default function TermsPage() {
  const t = useTranslations('terms');

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
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('acceptanceTitle')}</h2>
          <p>{t('acceptanceText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('servicesTitle')}</h2>
          <p>{t('servicesText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('accountsTitle')}</h2>
          <p>{t('accountsText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('paymentTitle')}</h2>
          <p>{t('paymentText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('terminationTitle')}</h2>
          <p>{t('terminationText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('liabilityTitle')}</h2>
          <p>{t('liabilityText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('contactTitle')}</h2>
          <p>{t('contactText')}</p>
        </section>
      </div>
    </div>
  );
}
