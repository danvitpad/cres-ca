/** --- YAML
 * name: MiniAppHomePage
 * description: Instagram-style main feed — Stories row (top masters by score) + next appointment strip + vertical feed of posts from followed profiles. Flat cards (Phase 7.11).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Search, Heart, Send, Loader2, Compass } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface NextAppointment {
  id: string;
  starts_at: string;
  master_name: string;
  service_name: string;
  price: number;
}

interface StoryMaster {
  id: string;
  publicId: string | null;
  name: string;
  avatar: string | null;
}

interface FeedAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  public_id: string | null;
  slug: string | null;
  role: string | null;
}

interface FeedPost {
  id: string;
  author_id: string;
  image_url: string;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: FeedAuthor | null;
  liked_by_viewer: boolean;
}

export default function MiniAppHomePage() {
  const { user, ready, haptic } = useTelegram();
  const { userId, fullName } = useAuthStore();

  const [next, setNext] = useState<NextAppointment | null>(null);
  const [stories, setStories] = useState<StoryMaster[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(
    async (cursor?: string) => {
      const url = cursor ? `/api/feed?cursor=${encodeURIComponent(cursor)}` : '/api/feed';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor ?? null);
    },
    [],
  );

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const initData = (() => {
        if (typeof window === 'undefined') return null;
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        const live = w.Telegram?.WebApp?.initData;
        if (live) return live;
        try {
          const stash = sessionStorage.getItem('cres:tg');
          if (stash) {
            const parsed = JSON.parse(stash) as { initData?: string };
            if (parsed.initData) return parsed.initData;
          }
        } catch { /* ignore */ }
        return null;
      })();

      // Next appointment via server endpoint (Supabase JWT not persisted in TG WebView)
      if (initData) {
        const naRes = await fetch('/api/telegram/c/next-appointment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (naRes.ok) {
          const { next: apt } = await naRes.json();
          if (apt) {
            const a = apt as {
              id: string;
              starts_at: string;
              price: number | null;
              master: { profile: { full_name: string } | { full_name: string }[] } | null;
              service: { name: string } | { name: string }[] | null;
            };
            const masterProfile = Array.isArray(a.master?.profile) ? a.master?.profile[0] : a.master?.profile;
            const svc = Array.isArray(a.service) ? a.service[0] : a.service;
            setNext({
              id: a.id,
              starts_at: a.starts_at,
              master_name: masterProfile?.full_name ?? '—',
              service_name: svc?.name ?? '—',
              price: Number(a.price ?? 0),
            });
          }
        }
      }

      // Stories row
      const res = await fetch('/api/feed/stories');
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories ?? []);
      }

      await loadFeed();
      setLoading(false);
    })();
  }, [userId, loadFeed]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadFeed(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleLike(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    haptic('light');
    // Optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_viewer: !p.liked_by_viewer,
              likes_count: p.liked_by_viewer ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p,
      ),
    );
    const res = await fetch('/api/posts/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    if (!res.ok) {
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_viewer: post.liked_by_viewer,
                likes_count: post.likes_count,
              }
            : p,
        ),
      );
    }
  }

  const firstName = (fullName ? fullName.split(' ')[0] : null) ?? user?.first_name ?? 'друг';

  if (!ready || loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/[0.03]" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
        <div className="h-80 w-full animate-pulse rounded-3xl bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="px-5 pt-5">
        <h1 className="text-2xl font-bold text-white">Привет, {firstName}</h1>
      </div>

      {/* Stories row */}
      {stories.length > 0 && (
        <div className="-mx-0 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((s) => (
            <Link
              key={s.id}
              href={s.publicId ? `/telegram/u/${s.publicId}` : `/telegram/search?master=${s.id}`}
              onClick={() => haptic('light')}
              className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
            >
              <div className="rounded-full border border-violet-500 p-[2px]">
                <div className="rounded-full bg-[#1f2023] p-[2px]">
                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-white/90">
                    {s.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatar} alt="" className="size-full object-cover" />
                    ) : (
                      (s.name[0] ?? 'M').toUpperCase()
                    )}
                  </div>
                </div>
              </div>
              <p className="line-clamp-1 text-center text-[10px] text-white/70">{s.name}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Next appointment strip */}
      {next && (
        <div className="px-5">
          <Link
            href={`/telegram/activity?id=${next.id}`}
            onClick={() => haptic('light')}
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 pl-5 active:bg-white/[0.06] transition-colors"
          >
            <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-violet-500" />
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-violet-300">
              <Calendar className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{next.service_name}</p>
              <p className="truncate text-[11px] text-white/60">
                с {next.master_name} ·{' '}
                {new Date(next.starts_at).toLocaleString('ru', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span className="text-[12px] font-bold tabular-nums">{next.price.toFixed(0)} ₴</span>
          </Link>
        </div>
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="mx-5 mt-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Compass className="size-6 text-white/60" />
          </div>
          <p className="mt-4 text-base font-semibold">Лента пуста</p>
          <p className="mt-1 text-[12px] text-white/50">
            Подпишитесь на мастеров, чтобы видеть их работы
          </p>
          <Link
            href="/telegram/search"
            onClick={() => haptic('selection')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black active:bg-white/80 transition-colors"
          >
            <Search className="size-3.5" /> Найти мастера
          </Link>
        </div>
      ) : (
        <div className="space-y-1 pb-8">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onLike={() => toggleLike(p.id)} onHaptic={haptic} />
          ))}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] font-semibold active:bg-white/[0.06] transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="size-3 animate-spin" />}
                Показать ещё
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function PostCard({
  post,
  onLike,
  onHaptic,
}: {
  post: FeedPost;
  onLike: () => void;
  onHaptic: (t?: 'light' | 'selection') => void;
}) {
  const authorName = post.author?.full_name ?? 'Мастер';
  const avatar = post.author?.avatar_url;
  const time = useMemo(() => relativeTime(post.created_at), [post.created_at]);

  return (
    <article className="border-b border-white/5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-3 pb-2">
        <Link
          href={post.author?.public_id ? `/telegram/u/${post.author.public_id}` : '#'}
          onClick={() => onHaptic('light')}
          className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-white/90"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            authorName[0] ?? 'M'
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{authorName}</p>
          <p className="truncate text-[10px] text-white/45">{time}</p>
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.image_url} alt={post.caption ?? ''} className="size-full object-cover" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-5 pt-2.5">
        <button onClick={onLike} className="transition-opacity active:opacity-60">
          <Heart
            className={`size-6 ${post.liked_by_viewer ? 'fill-rose-500 text-rose-500' : 'text-white'}`}
            strokeWidth={post.liked_by_viewer ? 0 : 2}
          />
        </button>
        <button
          onClick={() => {
            onHaptic('selection');
            const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cres_ca_bot';
            const link = post.author?.public_id
              ? `https://t.me/${botUsername}?startapp=u_${post.author.public_id}`
              : `https://t.me/${botUsername}`;
            const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
            if (tg?.openTelegramLink) {
              tg.openTelegramLink(
                `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(authorName)}`,
              );
            }
          }}
          className="ml-auto transition-opacity active:opacity-60"
          aria-label="Поделиться"
        >
          <Send className="size-6" />
        </button>
      </div>

      {/* Stats + caption */}
      <div className="space-y-1 px-5 pt-2">
        {post.likes_count > 0 && (
          <p className="text-[12px] font-semibold">
            {post.likes_count} {declension(post.likes_count, ['отметка нравится', 'отметки нравится', 'отметок нравится'])}
          </p>
        )}
        {post.caption && (
          <p className="whitespace-pre-wrap text-[13px]">
            <span className="font-semibold">{authorName}</span> {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function declension(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
