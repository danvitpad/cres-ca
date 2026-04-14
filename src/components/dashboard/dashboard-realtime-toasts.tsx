/** --- YAML
 * name: DashboardRealtimeToasts
 * description: Подписка на supabase realtime для таблицы `notifications` текущего мастера. При INSERT нового уведомления показывает toast через sonner + линк на /telegram/m/notifications.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

interface NotifRow {
  id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  created_at: string;
}

export function DashboardRealtimeToasts() {
  const { userId } = useAuthStore();
  const router = useRouter();
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dash-notif-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotifRow;
          if (!row?.title) return;
          // Skip rows that existed before mount (debounce on re-subscribe)
          if (new Date(row.created_at).getTime() < mountedAtRef.current - 5000) return;
          toast(row.title, {
            description: row.body ?? undefined,
            action: row.link
              ? {
                  label: 'Open',
                  onClick: () => router.push(row.link!),
                }
              : undefined,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
