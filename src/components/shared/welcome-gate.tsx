/** --- YAML
 * name: WelcomeGate
 * description: Невидимый компонент. При первом mount проверяет profiles.welcome_seen
 *              и при `false` перенаправляет на /[locale]/welcome. Используется
 *              в dashboard и client layouts.
 * created: 2026-04-30
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export function WelcomeGate() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    // Не редиректим с самого welcome (избегаем цикла) и с onboarding-страниц.
    if (!pathname) return;
    if (pathname.includes('/welcome')) return;
    if (pathname.includes('/onboarding')) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || ctrl.signal.aborted) return;
        const { data } = await supabase
          .from('profiles')
          .select('welcome_seen')
          .eq('id', user.id)
          .maybeSingle();
        if (ctrl.signal.aborted) return;
        const seen = (data as { welcome_seen?: boolean } | null)?.welcome_seen ?? true;
        if (!seen) {
          router.replace(`/${locale}/welcome`);
        }
      } catch {
        // best-effort: при ошибке не блокируем UX
      }
    })();

    return () => ctrl.abort();
  }, [pathname, router, locale]);

  return null;
}
