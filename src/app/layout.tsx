/** --- YAML
 * name: Root Layout
 * description: Top-level HTML layout — sets fonts, metadata. Children are [locale] layouts.
 * --- */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { getLocale } from 'next-intl/server';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'CRES-CA — CRM for the Service Industry',
    template: '%s | CRES-CA',
  },
  description:
    'Universal CRM platform for service businesses — bookings, clients, finance & marketing in one place.',
  metadataBase: new URL('https://cres-ca.com'),
  openGraph: {
    type: 'website',
    siteName: 'CRES-CA',
    title: 'CRES-CA — CRM for the Service Industry',
    description: 'Universal CRM platform for service businesses — bookings, clients, finance & marketing in one place.',
    url: 'https://cres-ca.com',
    locale: 'en_CA',
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
    title: 'CRES-CA — CRM for the Service Industry',
    description: 'Universal CRM platform for service businesses — bookings, clients, finance & marketing in one place.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    languages: {
      uk: 'https://cres-ca.com/uk',
      ru: 'https://cres-ca.com/ru',
      en: 'https://cres-ca.com/en',
      'x-default': 'https://cres-ca.com/en',
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLocale();

  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
