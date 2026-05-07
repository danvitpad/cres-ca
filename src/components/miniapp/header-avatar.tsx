/** --- YAML
 * name: MiniAppHeaderAvatar
 * description: Кружок аватара справа сверху на каждом табе мастера. Тап → переход
 *              в полноэкранный профиль. Скрыт на самом /profile и fullscreen routes.
 *              Аватар грузится один раз из profiles.avatar_url и кешируется в
 *              sessionStorage чтобы не моргал при переходах между табами.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { createClient } from '@/lib/supabase/client';
import { T } from './design';

const CACHE_KEY = 'cres:m:avatar';

export function MiniAppHeaderAvatar() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.userId);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string>('');

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { avatar?: string; name?: string };
        if (parsed.avatar) setAvatar(parsed.avatar);
        if (parsed.name) setName(parsed.name);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, first_name, full_name')
        .eq('id', userId)
        .maybeSingle<{ avatar_url: string | null; first_name: string | null; full_name: string | null }>();
      if (cancelled || !data) return;
      const av = data.avatar_url ?? null;
      const nm = data.first_name ?? data.full_name?.split(' ')[0] ?? '';
      setAvatar(av);
      setName(nm);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ avatar: av, name: nm }));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const hidden =
    pathname === '/telegram/m/profile' ||
    pathname.startsWith('/telegram/m/voice-book') ||
    pathname.startsWith('/telegram/m/voice-intro') ||
    pathname.startsWith('/telegram/m/slot/') ||
    pathname.startsWith('/telegram/m/onboarding') ||
    pathname.startsWith('/telegram/m/salon/');

  if (hidden) return null;

  const initial = (name?.trim().charAt(0) || '·').toUpperCase();

  return (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        router.push('/telegram/m/profile');
      }}
      aria-label="Профиль"
      style={{
        position: 'fixed',
        top: 'calc(16px + var(--tg-content-top, 0px))',
        right: 16,
        zIndex: 30,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1px solid ${T.border}`,
        background: T.surface,
        padding: 0,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{initial}</span>
      )}
    </button>
  );
}
