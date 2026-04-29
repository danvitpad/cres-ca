/** --- YAML
 * name: Auth Provider
 * description: Client component that syncs Supabase auth session to Zustand store. На мобильном дополнительно подталкивает refresh при возвращении вкладки в фокус — чтобы Telegram WebView / iOS Safari не теряли сессию после паузы.
 * --- */

'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          clearAuth();
          return;
        }
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', session.user.id).single();
        if (!profile) {
          // Профиль не нашли — это может быть транзиентная ошибка сети.
          // Не выкидываем юзера, просто оставляем текущее состояние.
          return;
        }
        // `.maybeSingle()` errors on multi-row results; `.limit(1)` guards against duplicates.
        const { data: sub } = await supabase
          .from('subscriptions').select('tier')
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setAuth(session.user.id, profile.role, sub?.tier ?? null);
      } catch {
        // Сетевая/транзиентная ошибка — НЕ разлогиниваем, иначе на нестабильном
        // мобильном инете юзер мгновенно вылетает. Реальный SIGNED_OUT придёт
        // отдельно через onAuthStateChange.
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Только явный SIGNED_OUT (юзер сам вышел или Supabase окончательно отказал
      // в refresh) очищает локальное состояние. Все остальные события (TOKEN_REFRESHED,
      // USER_UPDATED, INITIAL_SESSION) — просто перезагружают данные.
      if (event === 'SIGNED_OUT') {
        clearAuth();
        return;
      }
      if (session) loadSession();
    });

    // Telegram WebView / iOS Safari ставят таймеры в фоне на паузу, поэтому когда
    // пользователь возвращается в приложение — принудительно зовём refresh, чтобы
    // токен не «протух молча».
    function onVisible() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [setAuth, clearAuth]);

  return <>{children}</>;
}
