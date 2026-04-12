/** --- YAML
 * name: Auth Provider
 * description: Client component that syncs Supabase auth session to Zustand store on mount and auth state changes
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        clearAuth();
        return;
      }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single();
      if (!profile) {
        clearAuth();
        return;
      }
      const { data: sub } = await supabase
        .from('subscriptions').select('tier').eq('profile_id', session.user.id).maybeSingle();
      setAuth(session.user.id, profile.role, sub?.tier ?? null);
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) clearAuth();
      else loadSession();
    });

    return () => subscription.unsubscribe();
  }, [setAuth, clearAuth]);

  return <>{children}</>;
}
