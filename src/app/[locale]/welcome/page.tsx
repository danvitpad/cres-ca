/** --- YAML
 * name: WelcomePage (deprecated)
 * description: Старый full-screen welcome-слайдер на белом фоне был неудобен —
 *              пользователь хотел поп-ап после регистрации. С 2026-05-01
 *              приветствие живёт в WelcomeGate (модалка поверх /today),
 *              а опциональный тур по разделам — в TourOverlay (?tour=today).
 *              Эта страница оставлена как редирект для совместимости со
 *              старыми ссылками: сразу уходим на /today по роли.
 * updated: 2026-05-01
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function WelcomePage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          router.replace(`/${locale}/login`);
          return;
        }
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const role = (data as { role?: string } | null)?.role;
        const target =
          role === 'client' ? `/${locale}/feed` :
          role === 'salon_admin' ? `/${locale}/dashboard` :
          `/${locale}/today`;
        router.replace(target);
      } catch {
        router.replace(`/${locale}/today`);
      }
    })();
    return () => { cancelled = true; };
  }, [router, locale]);

  return null;
}
