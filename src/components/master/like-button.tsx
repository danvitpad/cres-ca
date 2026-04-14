/** --- YAML
 * name: MasterLikeButton
 * description: Optimistic heart/like button for a master card. Reads/writes master_likes. Shows total count.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  masterId: string;
  initialCount: number;
}

export function MasterLikeButton({ masterId, initialCount }: Props) {
  const { userId } = useAuthStore();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from('master_likes')
      .select('master_id')
      .eq('master_id', masterId)
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data }) => setLiked(Boolean(data)));
  }, [masterId, userId]);

  async function toggle() {
    if (!userId || busy) return;
    setBusy(true);
    const supabase = createClient();
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));
    if (wasLiked) {
      await supabase.from('master_likes').delete().eq('master_id', masterId).eq('profile_id', userId);
    } else {
      await supabase.from('master_likes').insert({ master_id: masterId, profile_id: userId });
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={!userId || busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
        liked ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
      } disabled:opacity-60`}
      aria-label="Лайк"
    >
      <Heart className={`size-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
      {count}
    </button>
  );
}
