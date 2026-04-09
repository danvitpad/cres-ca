/** --- YAML
 * name: FeedPage
 * description: Instagram-style feed with stories row and posts from followed masters
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Scissors, Sparkles, ArrowLeftRight, Flame, MessageSquare, Heart, Share2, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';
import { TopMastersRow } from '@/components/shared/top-masters-row';

interface FeedPost {
  id: string;
  type: 'new_service' | 'promotion' | 'before_after' | 'burning_slot' | 'update';
  title: string | null;
  body: string | null;
  image_url: string | null;
  linked_service_id: string | null;
  expires_at: string | null;
  created_at: string;
  master: {
    id: string;
    specialization: string | null;
    profile: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

interface FollowedMaster {
  master_id: string;
  master: {
    id: string;
    specialization: string | null;
    profile: {
      full_name: string;
      avatar_url: string | null;
    };
  };
  hasNewPosts: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  new_service: <Scissors className="h-3.5 w-3.5" />,
  promotion: <Sparkles className="h-3.5 w-3.5" />,
  before_after: <ArrowLeftRight className="h-3.5 w-3.5" />,
  burning_slot: <Flame className="h-3.5 w-3.5" />,
  update: <MessageSquare className="h-3.5 w-3.5" />,
};

const typeColors: Record<string, string> = {
  new_service: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  promotion: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  before_after: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  burning_slot: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  update: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
};

const PAGE_SIZE = 10;

export default function FeedPage() {
  const t = useTranslations('feed');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [masters, setMasters] = useState<FollowedMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (offset = 0) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('feed_posts')
      .select(`
        id, type, title, body, image_url, linked_service_id, expires_at, created_at,
        master:masters!inner(id, specialization, profile:profiles!inner(full_name, avatar_url))
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const items = (data ?? []) as unknown as FeedPost[];
    if (items.length < PAGE_SIZE) setHasMore(false);
    return items;
  }, []);

  const fetchMasters = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('client_master_links')
      .select(`
        master_id,
        master:masters!inner(id, specialization, profile:profiles!inner(full_name, avatar_url))
      `)
      .limit(20);
    return (data ?? []).map((d) => ({ ...d, hasNewPosts: false })) as unknown as FollowedMaster[];
  }, []);

  useEffect(() => {
    async function init() {
      const [p, m] = await Promise.all([fetchPosts(0), fetchMasters()]);
      setPosts(p);
      setMasters(m);
      setLoading(false);
    }
    init();
  }, [fetchPosts, fetchMasters]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          const more = await fetchPosts(posts.length);
          setPosts((prev) => [...prev, ...more]);
          setLoadingMore(false);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, posts.length, fetchPosts]);

  function hoursUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.round(diff / 3600000));
  }

  if (loading) {
    return (
      <div className="space-y-4 p-[var(--space-page)]">
        {/* Stories skeleton */}
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <ShimmerSkeleton key={i} className="h-16 w-16 shrink-0" rounded="full" />
          ))}
        </div>
        {/* Posts skeleton */}
        {Array.from({ length: 3 }, (_, i) => (
          <ShimmerSkeleton key={i} className="h-48 w-full" rounded="lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stories row */}
      <div className="flex gap-3 overflow-x-auto px-[var(--space-page)] py-3 scrollbar-thin">
        {/* Discover button */}
        <Link href="/masters" className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <span className="text-[10px] text-muted-foreground">{t('discover')}</span>
        </Link>
        {masters.map((m) => (
          <Link
            key={m.master_id}
            href={`/masters/${m.master_id}`}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <AvatarRing
              src={m.master.profile.avatar_url}
              name={m.master.profile.full_name}
              size={64}
              hasNewContent={m.hasNewPosts}
            />
            <span className="max-w-[64px] truncate text-[10px]">
              {m.master.profile.full_name.split(' ')[0]}
            </span>
          </Link>
        ))}
      </div>

      {/* Top masters */}
      <div className="px-[var(--space-page)] py-2">
        <TopMastersRow />
      </div>

      {/* Feed */}
      {posts.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link
              href="/masters"
              className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
            >
              <Search className="h-4 w-4" />
              {t('discover')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4 px-[var(--space-page)] pb-4">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <FeedCard post={post} t={t} hoursUntil={hoursUntil} />
            </motion.div>
          ))}
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ds-accent)] border-t-transparent" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedCard({
  post,
  t,
  hoursUntil,
}: {
  post: FeedPost;
  t: ReturnType<typeof useTranslations<'feed'>>;
  hoursUntil: (d: string) => number;
}) {
  const typeKey = post.type as keyof typeof typeColors;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Link href={`/masters/${post.master.id}`}>
          <AvatarRing
            src={post.master.profile.avatar_url}
            name={post.master.profile.full_name}
            size={40}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/masters/${post.master.id}`} className="text-sm font-semibold hover:underline">
            {post.master.profile.full_name}
          </Link>
          {post.master.specialization && (
            <p className="truncate text-xs text-muted-foreground">{post.master.specialization}</p>
          )}
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', typeColors[typeKey])}>
          {typeIcons[typeKey]}
          {t(typeKey)}
        </span>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative aspect-[4/3] w-full bg-muted">
          <img src={post.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2">
        {post.title && <p className="text-sm font-semibold">{post.title}</p>}
        {post.body && <p className="text-sm text-muted-foreground line-clamp-3">{post.body}</p>}

        {/* Burning slot urgency */}
        {post.type === 'burning_slot' && post.expires_at && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {t('expiresIn', { hours: hoursUntil(post.expires_at) })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center border-t px-3 py-2">
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Heart className="h-4 w-4" />
          {t('save')}
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Share2 className="h-4 w-4" />
          {t('share')}
        </button>
        <div className="flex-1" />
        {post.linked_service_id && (
          <Link
            href={`/book?master=${post.master.id}&service=${post.linked_service_id}`}
            className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
          >
            {t('bookNow')}
          </Link>
        )}
      </div>
    </div>
  );
}
