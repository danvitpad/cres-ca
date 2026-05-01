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
      <footer className="landing-layout-footer">
        <div className="landing-layout-footer__inner">
          <nav>
            <Link href="/#features">{t('about')}</Link>
            <Link href="/#pricing">{t('pricing')}</Link>
            <Link href="/contact">{t('contact')}</Link>
            <Link href="/terms">{t('terms')}</Link>
            <Link href="/privacy">{t('privacy')}</Link>
            <Link href="/cookies">{t('cookies')}</Link>
          </nav>
          <p>&copy; {year} CRES-CA. {t('rights')}.</p>
        </div>
      </footer>
    </>
  );
}
