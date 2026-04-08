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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
