/** --- YAML
 * name: MiniAppPublicProfilePage
 * description: Instagram-style публичный профиль пользователя CRES-CA — аватар, имя, CRES-ID, bio, счётчики, кнопка подписки, сетка постов (плейсхолдер).
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, IdCard, UserPlus, UserCheck, Grid3x3, Loader2, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface PublicProfile {
  id: string;
  full_name: string | null;
  public_id: string | null;
  slug: string | null;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  role: string | null;
}

export default function MiniAppPublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ publicId: string }>();
  const publicId = params?.publicId;
  const viewerId = useAuthStore((s) => s.userId);
  const { haptic } = useTelegram();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!publicId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, public_id, slug, bio, avatar_url, followers_count, following_count, posts_count, role')
      .eq('public_id', publicId)
      .maybeSingle();

    if (data) {
      setProfile(data as PublicProfile);
      if (viewerId && viewerId !== data.id) {
        const { data: f } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('following_id', data.id)
          .maybeSingle();
        setFollowing(Boolean(f));
      }
    }
    setLoading(false);
  }, [publicId, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFollow() {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    haptic('light');
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: profile.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollowing(data.following);
        setProfile((p) => (p ? { ...p, followers_count: data.followersCount } : p));
        haptic(data.following ? 'success' : 'selection');
      }
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-neutral-600">Профиль не найден</p>
        <button
          onClick={() => router.back()}
          className="rounded-full border border-neutral-200 bg-white/5 px-4 py-2 text-xs font-semibold"
        >
          Назад
        </button>
      </div>
    );
  }

  const isSelf = viewerId === profile.id;
  const displayName = profile.full_name ?? 'Пользователь';
  const avatarChar = displayName[0] ?? 'U';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-xl bg-white/5 border border-neutral-200 active:scale-95 transition-transform"
        >
          <ArrowLeft className="size-4" />
        </button>
        {profile.slug && <p className="text-sm font-semibold text-neutral-700">@{profile.slug}</p>}
      </div>

      {/* Avatar + counters */}
      <div className="flex items-start gap-6 px-5">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-3xl font-bold">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            avatarChar
          )}
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2 pt-3 text-center">
          <Stat value={profile.posts_count} label="постов" />
          <Stat value={profile.followers_count} label="подписчиков" />
          <Stat value={profile.following_count} label="подписок" />
        </div>
      </div>

      {/* Name + CRES-ID + bio */}
      <div className="space-y-2 px-5">
        <h1 className="text-lg font-bold">{displayName}</h1>
        {profile.public_id && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-[0.12em] text-neutral-500">
            <IdCard className="size-3" /> {profile.public_id}
          </div>
        )}
        {profile.bio && <p className="text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap">{profile.bio}</p>}
        {profile.role === 'master' && (
          <div className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
            <MapPin className="size-2.5" /> Мастер CRES-CA
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="flex gap-2 px-5">
        {isSelf ? (
          <button
            onClick={() => router.push('/telegram/profile')}
            className="flex-1 rounded-xl border border-neutral-200 bg-white/5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            Редактировать профиль
          </button>
        ) : (
          <>
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60 ${
                following
                  ? 'border border-neutral-200 bg-white/5 text-neutral-900'
                  : 'bg-white text-black'
              }`}
            >
              {followBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : following ? (
                <>
                  <UserCheck className="size-4" /> Вы подписаны
                </>
              ) : (
                <>
                  <UserPlus className="size-4" /> Подписаться
                </>
              )}
            </button>
            {profile.role === 'master' && (
              <button
                onClick={() => router.push(`/telegram/search/${profile.id}`)}
                className="rounded-xl border border-neutral-200 bg-white/5 px-4 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                Записаться
              </button>
            )}
          </>
        )}
      </div>

      {/* Posts grid (placeholder) */}
      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
          <Grid3x3 className="size-3" /> Посты
        </div>
        {profile.posts_count === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-neutral-400">
            Пока нет публикаций
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 px-0.5">
            {Array.from({ length: profile.posts_count }).map((_, i) => (
              <div key={i} className="aspect-square bg-white/5" />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold">{formatCount(value)}</span>
      <span className="text-[10px] text-neutral-500">{label}</span>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}
