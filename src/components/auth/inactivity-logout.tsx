/** --- YAML
 * name: InactivityLogout
 * description: Если пользователь закрыл вкладку или ушёл со страницы и не вернулся
 *              в течение часа — при следующем заходе разлогиниваем и отправляем
 *              на /login. Реализация: сохраняем timestamp последней активности
 *              в localStorage; при mount + при visibilitychange сравниваем —
 *              если прошло >= 60 минут, supabase.auth.signOut() и редирект.
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const KEY = 'cres-ca-last-active';
const MAX_INACTIVE_MS = 60 * 60 * 1000;

function touch() {
  try { window.localStorage.setItem(KEY, String(Date.now())); } catch {}
}

export function InactivityLogout() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAndLogoutIfStale() {
      let last: number | null = null;
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) last = parseInt(raw, 10);
      } catch {}

      if (last && Number.isFinite(last) && Date.now() - last >= MAX_INACTIVE_MS) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (cancelled) return;
          if (user) {
            await supabase.auth.signOut();
            try { window.localStorage.removeItem(KEY); } catch {}
            router.replace('/login');
            return;
          }
        } catch { /* offline-tolerant */ }
      }
      touch();
    }

    checkAndLogoutIfStale();

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        // Запоминаем когда пользователь ушёл — это и есть «начало простоя».
        touch();
      } else if (document.visibilityState === 'visible') {
        // Вернулся — проверяем не истёк ли час.
        checkAndLogoutIfStale();
      }
    }

    function onActivity() { touch(); }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onActivity);
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('beforeunload', () => touch());

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [router]);

  return null;
}
