/** --- YAML
 * name: SettingsLayout
 * description: Fresha-exact settings section layout — hub page with card grid for main /settings, pass-through for sub-pages
 * --- */

'use client';

import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();

  /* Sub-pages (team, equipment, locations) render directly without hub wrapper */
  const isMainSettings = pathname === `/${locale}/settings`;

  /* Always pass through — the main settings page has its own hub UI,
     sub-pages render their own content */
  return <>{children}</>;
}
