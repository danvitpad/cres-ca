/** --- YAML
 * name: FollowMasterButton
 * description: Heart toggle on /m/{handle} — клиент жмёт ❤ → попадает в /my-masters,
 *              получает уведомления о свободных окнах. Если не залогинен — ведёт на /login?next=...
 *              Использует существующий /api/follow/crm/toggle (client_master_links).
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  masterId: string;
  accent?: string;
}

export function FollowMasterButton({ masterId, accent = 'var(--ds-accent, var(--color-accent))' }: Props) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthed(false);
        setIsFollowing(false);
        return;
      }
      setAuthed(true);
      const { data } = await supabase
        .from('client_master_links')
        .select('master_id')
        .eq('profile_id', user.id)
        .eq('master_id', masterId)
        .maybeSingle();
      if (!cancelled) setIsFollowing(!!data);
    })();
    return () => { cancelled = true; };
  }, [masterId]);

  function onClick() {
    if (authed === false) {
      router.push(`/ru/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (isFollowing === null || pending) return;
    const optimistic = !isFollowing;
    setIsFollowing(optimistic);
    startTransition(async () => {
      try {
        const res = await fetch('/api/follow/crm/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setIsFollowing(!optimistic);
          return;
        }
        setIsFollowing(!!json.following);
      } catch {
        setIsFollowing(!optimistic);
      }
    });
  }

  // Instagram-стиль: «Подписаться» (нейтральный) → «Вы подписаны» (акцентный
  // фон, более жирный, чтобы было сразу видно что состояние изменилось).
  const label = isFollowing
    ? 'Вы подписаны'
    : authed === false
      ? 'Подписаться'
      : 'Подписаться';

  return (
    <button
      onClick={onClick}
      disabled={isFollowing === null || pending}
      aria-pressed={!!isFollowing}
      className="flex w-full items-center justify-center gap-2 rounded-[var(--brand-radius-lg)] border px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
      style={
        isFollowing
          ? { background: accent, borderColor: accent, color: 'white' }
          : { background: 'white', borderColor: '#e5e7eb', color: '#374151' }
      }
    >
      <Heart
        className="size-4 transition-all"
        fill={isFollowing ? 'white' : 'none'}
        style={isFollowing ? { color: 'white' } : undefined}
      />
      {label}
    </button>
  );
}
