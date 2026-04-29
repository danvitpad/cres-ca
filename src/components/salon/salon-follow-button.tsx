/** --- YAML
 * name: SalonFollowButton
 * description: Кнопка «В контакты» / «В контактах» на публичной странице салона.
 *              POST /api/salon/[id]/follow добавляет, DELETE — убирает.
 *              Гость → редирект на /login. Это не запись на услугу, это «контакт» —
 *              салон видит клиента в общем списке, клиент получает рассылки команды.
 * created: 2026-04-19
 * updated: 2026-04-29
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, HeartOff, Loader2 } from 'lucide-react';

interface Props {
  salonId: string;
  initialFollowing: boolean;
  authed: boolean;
}

export function SalonFollowButton({ salonId, initialFollowing, authed }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!authed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/salon/${salonId}/follow`, {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const j = (await res.json()) as { following: boolean };
        startTransition(() => setFollowing(j.following));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
        following
          ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
          : 'bg-neutral-900 text-white hover:bg-neutral-800'
      }`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <HeartOff className="size-4" />
      ) : (
        <Heart className="size-4" />
      )}
      {following ? 'В контактах' : 'В контакты'}
    </button>
  );
}
