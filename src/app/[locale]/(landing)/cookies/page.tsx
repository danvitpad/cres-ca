/** --- YAML
 * name: Cookies Policy
 * description: Public cookies policy page — how CRES-CA uses cookies and similar tech.
 * created: 2026-04-19
 * --- */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookies Policy',
  description: 'CRES-CA cookies policy — what cookies we use and why.',
};

export default function CookiesPage() {
  const t = useTranslations('cookies');

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
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('whatTitle')}</h2>
          <p>{t('whatText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('typesTitle')}</h2>
          <p>{t('typesText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('essentialTitle')}</h2>
          <p>{t('essentialText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('analyticsTitle')}</h2>
          <p>{t('analyticsText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('thirdPartyTitle')}</h2>
          <p>{t('thirdPartyText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('controlTitle')}</h2>
          <p>{t('controlText')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('contactTitle')}</h2>
          <p>{t('contactText')}</p>
        </section>
      </div>
    </div>
  );
}
