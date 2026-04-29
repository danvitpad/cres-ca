/** --- YAML
 * name: MiniAppBackBar
 * description: Renders a "Back to profile" bar at the top of the public master
 *   page when the URL contains `?from=profile`. Wires Telegram WebApp BackButton
 *   to the same destination so the native TG back arrow returns to the master
 *   profile in Mini App instead of /telegram/m/home.
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const TARGET = '/telegram/m/profile';

interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface TelegramWebApp {
  BackButton?: TelegramBackButton;
}

export function MiniAppBackBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const fromProfile = sp.get('from') === 'profile';

  useEffect(() => {
    if (!fromProfile) return;
    const tg = (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    const back = tg?.BackButton;
    if (!back) return;

    const handler = () => router.replace(TARGET);
    back.onClick(handler);
    back.show();

    return () => {
      try {
        back.offClick(handler);
        back.hide();
      } catch { /* ignore */ }
    };
  }, [fromProfile, router]);

  if (!fromProfile) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '10px 16px',
      }}
    >
      <button
        type="button"
        onClick={() => router.replace(TARGET)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.08)',
          background: '#fff',
          color: '#0d9488',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={16} strokeWidth={2.4} />
        В профиль
      </button>
    </div>
  );
}
