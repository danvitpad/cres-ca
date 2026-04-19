/** --- YAML
 * name: SalonFollowButton
 * description: Client-side follow/unfollow button for public salon page. Posts to /api/follow with targetId = salon.owner_id.
 *              Redirects to /login if user is not authenticated.
 * created: 2026-04-19
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, HeartOff, Loader2 } from 'lucide-react';

interface Props {
  ownerId: string;
  initialFollowing: boolean;
  authed: boolean;
}

export function SalonFollowButton({ ownerId, initialFollowing, authed }: Props) {
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
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: ownerId }),
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
          ? 'bg-muted text-foreground hover:bg-muted/80'
          : 'bg-primary text-primary-foreground hover:opacity-90'
      }`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <HeartOff className="size-4" />
      ) : (
        <Heart className="size-4" />
      )}
      {following ? 'Подписан' : 'Подписаться'}
    </button>
  );
}
