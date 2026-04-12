/** --- YAML
 * name: LandingLayout
 * description: Public landing pages layout with persistent footer — clean minimal design
 * --- */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <>
      {children}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/#features" className="transition-colors hover:text-foreground">{t('about')}</Link>
            <Link href="/#pricing" className="transition-colors hover:text-foreground">{t('pricing')}</Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">{t('contact')}</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">{t('terms')}</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">{t('privacy')}</Link>
          </nav>
          <p className="text-xs text-muted-foreground/60">
            &copy; {year} CRES-CA. {t('rights')}.
          </p>
        </div>
      </footer>
    </>
  );
}
