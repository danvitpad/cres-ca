/** --- YAML
 * name: Locale Layout
 * description: Wraps all pages with next-intl provider for the current locale. Sets html lang attribute.
 * --- */

import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/lib/i18n/config';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/shared/auth-provider';
import { SwipeNavigator } from '@/components/shared/swipe-navigator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const title = t('title');
  const description = t('description');
  const ogLocale = t('ogLocale');

  return {
    title: {
      default: title,
      template: '%s | CRES-CA',
    },
    description,
    openGraph: {
      type: 'website',
      siteName: 'CRES-CA',
      title,
      description,
      url: `https://cres-ca.com/${locale}`,
      locale: ogLocale,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'CRES-CA — Universal CRM for Service Businesses',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AuthProvider>
        <TooltipProvider>
          <SwipeNavigator />
          {children}
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
