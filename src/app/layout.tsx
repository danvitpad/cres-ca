/** --- YAML
 * name: Root Layout
 * description: Top-level HTML layout — sets fonts, metadata. Children are [locale] layouts.
 * --- */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
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
    default: 'CRES-CA — CRM для сфери послуг',
    template: '%s | CRES-CA',
  },
  description:
    'Універсальна CRM для сфери послуг — записи, клієнти, фінанси та маркетинг в одному місці.',
  metadataBase: new URL('https://cres-ca.com'),
  openGraph: {
    type: 'website',
    siteName: 'CRES-CA',
    title: 'CRES-CA — CRM для сфери послуг',
    description: 'Універсальна CRM для сфери послуг — записи, клієнти, фінанси та маркетинг в одному місці.',
    url: 'https://cres-ca.com',
    locale: 'uk_UA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CRES-CA — CRM для сфери послуг',
    description: 'Універсальна CRM для сфери послуг — записи, клієнти, фінанси та маркетинг в одному місці.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://cres-ca.com',
    languages: {
      uk: 'https://cres-ca.com/uk',
      ru: 'https://cres-ca.com/ru',
      en: 'https://cres-ca.com/en',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
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
