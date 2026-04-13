/** --- YAML
 * name: FeedPage
 * description: Instagram-style feed with stories row and posts from followed masters
 * --- */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, Sparkles, ArrowLeftRight, MessageSquare, Heart, Share2, Search, Stethoscope, Wrench, Car, Dumbbell, GraduationCap, PartyPopper, Leaf, Clock, Users, ArrowRight, MapPin, Star, CalendarCheck, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';

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
    display_name: string | null;
    avatar_url: string | null;
    profile: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  };
}

interface FollowedMaster {
  master_id: string;
  master: {
    id: string;
    specialization: string | null;
    display_name: string | null;
    avatar_url: string | null;
    profile: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  };
  hasNewPosts: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  new_service: <Scissors className="h-3.5 w-3.5" />,
  promotion: <Sparkles className="h-3.5 w-3.5" />,
  before_after: <ArrowLeftRight className="h-3.5 w-3.5" />,
  burning_slot: <Clock className="h-3.5 w-3.5" />,
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

// Broad industry chips — beauty is just one of many categories
const INDUSTRIES = [
  { key: 'beauty', icon: Sparkles },
  { key: 'health', icon: Stethoscope },
  { key: 'wellness', icon: Leaf },
  { key: 'home', icon: Wrench },
  { key: 'auto', icon: Car },
  { key: 'fitness', icon: Dumbbell },
  { key: 'education', icon: GraduationCap },
  { key: 'events', icon: PartyPopper },
] as const;

const INDUSTRY_PROFESSIONS: Record<string, readonly string[]> = {
  beauty: ['hairdresser', 'colorist', 'barber', 'nailMaster', 'brows', 'makeup', 'cosmetologist', 'depilation', 'massage', 'tattoo'],
  health: ['dentist', 'therapist', 'pediatrician', 'psychologist', 'nutritionist', 'physio'],
  wellness: ['yoga', 'meditation', 'spa', 'sauna', 'massage'],
  home: ['plumber', 'electrician', 'cleaner', 'handyman', 'mover', 'painter'],
  auto: ['carWash', 'carRepair', 'tireChange', 'detailing'],
  fitness: ['personalTrainer', 'crossfit', 'boxing', 'swim', 'pilates', 'yoga'],
  education: ['tutor', 'languages', 'music', 'art', 'driving'],
  events: ['photographer', 'dj', 'decorator', 'catering', 'animator', 'makeup'],
};

export default function FeedPage() {
  const t = useTranslations('feed');
  const tInd = useTranslations('industries');
  const tProf = useTranslations('professions');
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [masters, setMasters] = useState<FollowedMaster[]>([]);
  const [burningSlots, setBurningSlots] = useState<FeedPost[]>([]);
  const [discover, setDiscover] = useState<FollowedMaster[]>([]);
  const [nextAppt, setNextAppt] = useState<{ id: string; starts_at: string; service: string | null; masterName: string; masterAvatar: string | null; masterId: string } | null>(null);
  const [usual, setUsual] = useState<{ masterId: string; masterName: string; masterAvatar: string | null; serviceId: string; serviceName: string; visits: number } | null>(null);
  const [recommendations, setRecommendations] = useState<Array<{ id: string; fromName: string; toMasterId: string; toName: string; toAvatar: string | null; toSpec: string | null; note: string | null }>>([]);
  const { userId } = useAuthStore();
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
        master:masters!inner(id, specialization, display_name, avatar_url, profile:profiles(full_name, avatar_url))
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
        master:masters!inner(id, specialization, display_name, avatar_url, profile:profiles(full_name, avatar_url))
      `)
      .limit(20);
    return (data ?? []).map((d) => ({ ...d, hasNewPosts: false })) as unknown as FollowedMaster[];
  }, []);

  const fetchBurning = useCallback(async (followedIds: string[]) => {
    const supabase = createClient();
    let q = supabase
      .from('feed_posts')
      .select(`
        id, type, title, body, image_url, linked_service_id, expires_at, created_at,
        master:masters!inner(id, specialization, display_name, avatar_url, profile:profiles(full_name, avatar_url))
      `)
      .in('type', ['burning_slot', 'promotion', 'before_after', 'new_service', 'update'])
      .order('created_at', { ascending: false })
      .limit(12);
    if (followedIds.length > 0) {
      q = q.in('master_id', followedIds);
    }
    const { data } = await q;
    return (data ?? []) as unknown as FeedPost[];
  }, []);

  const fetchDiscover = useCallback(async () => {
    // TODO Phase 8: combine geo + paid placement ranking via RPC
    const supabase = createClient();
    const { data } = await supabase
      .from('masters')
      .select('id, specialization, display_name, avatar_url, profile:profiles(full_name, avatar_url)')
      .limit(8);
    return (data ?? []).map((master) => ({
      master_id: master.id,
      master,
      hasNewPosts: false,
    })) as unknown as FollowedMaster[];
  }, []);

  useEffect(() => {
    async function init() {
      const m = await fetchMasters();
      const followedIds = m.map((x) => x.master_id);
      const [p, b, d] = await Promise.all([
        fetchPosts(0),
        fetchBurning(followedIds),
        fetchDiscover(),
      ]);
      setPosts(p);
      setMasters(m);
      setBurningSlots(b);
      setDiscover(d);

      if (userId) {
        const supabase = createClient();
        const { data: clientRows } = await supabase.from('clients').select('id').eq('profile_id', userId);
        const clientIds = clientRows?.map((c: { id: string }) => c.id) ?? [];
        if (clientIds.length) {
          // Cross-master recommendations: "Your nail master suggests this massage therapist"
          const { data: recs } = await supabase
            .from('master_recommendations')
            .select('id, note, from_master:masters!master_recommendations_from_master_id_fkey(display_name, profile:profiles(full_name)), to_master:masters!master_recommendations_to_master_id_fkey(id, specialization, display_name, avatar_url, profile:profiles(full_name, avatar_url))')
            .in('client_id', clientIds)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);
          if (recs) {
            type RecRow = {
              id: string;
              note: string | null;
              from_master: { display_name: string | null; profile: { full_name: string | null } | null } | null;
              to_master: { id: string; specialization: string | null; display_name: string | null; avatar_url: string | null; profile: { full_name: string | null; avatar_url: string | null } | null } | null;
            };
            setRecommendations(
              (recs as unknown as RecRow[])
                .filter((r) => r.to_master)
                .map((r) => ({
                  id: r.id,
                  fromName: r.from_master?.display_name ?? r.from_master?.profile?.full_name ?? '?',
                  toMasterId: r.to_master!.id,
                  toName: r.to_master!.display_name ?? r.to_master!.profile?.full_name ?? '?',
                  toAvatar: r.to_master!.avatar_url ?? r.to_master!.profile?.avatar_url ?? null,
                  toSpec: r.to_master!.specialization,
                  note: r.note,
                })),
            );
          }

          const { data: appt } = await supabase
            .from('appointments')
            .select('id, starts_at, master_id, service:services(name), master:masters!inner(id, display_name, avatar_url, profile:profiles(full_name, avatar_url))')
            .in('client_id', clientIds)
            .gte('starts_at', new Date().toISOString())
            .order('starts_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (appt) {
            const a = appt as unknown as { id: string; starts_at: string; service: { name: string } | { name: string }[] | null; master: { id: string; display_name: string | null; avatar_url: string | null; profile: { full_name: string | null; avatar_url: string | null } | null } };
            const svc = Array.isArray(a.service) ? a.service[0] : a.service;
            setNextAppt({
              id: a.id,
              starts_at: a.starts_at,
              service: svc?.name ?? null,
              masterName: a.master.display_name ?? a.master.profile?.full_name ?? '?',
              masterAvatar: a.master.avatar_url ?? a.master.profile?.avatar_url ?? null,
              masterId: a.master.id,
            });
          } else {
            // "Your usual": aggregate last 30 completed visits → pick most-frequent (master, service).
            // Only surface if ≥3 visits with the same pair AND no upcoming appointment.
            const { data: completed } = await supabase
              .from('appointments')
              .select('master_id, service_id, service:services(name), master:masters!inner(id, display_name, avatar_url, profile:profiles(full_name, avatar_url))')
              .in('client_id', clientIds)
              .eq('status', 'completed')
              .order('starts_at', { ascending: false })
              .limit(30);

            if (completed && completed.length >= 3) {
              type Row = { master_id: string; service_id: string; service: { name: string } | { name: string }[] | null; master: { id: string; display_name: string | null; avatar_url: string | null; profile: { full_name: string | null; avatar_url: string | null } | null } };
              const counts = new Map<string, { n: number; row: Row }>();
              for (const r of completed as unknown as Row[]) {
                const key = `${r.master_id}::${r.service_id}`;
                const prev = counts.get(key);
                counts.set(key, { n: (prev?.n ?? 0) + 1, row: prev?.row ?? r });
              }
              let best: { n: number; row: Row } | null = null;
              for (const v of counts.values()) if (!best || v.n > best.n) best = v;
              if (best && best.n >= 3) {
                const svc = Array.isArray(best.row.service) ? best.row.service[0] : best.row.service;
                setUsual({
                  masterId: best.row.master.id,
                  masterName: best.row.master.display_name ?? best.row.master.profile?.full_name ?? '?',
                  masterAvatar: best.row.master.avatar_url ?? best.row.master.profile?.avatar_url ?? null,
                  serviceId: best.row.service_id,
                  serviceName: svc?.name ?? '—',
                  visits: best.n,
                });
              }
            }
          }
        }
      }

      setLoading(false);
    }
    init();
  }, [fetchPosts, fetchMasters, fetchBurning, fetchDiscover, userId]);

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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div className="min-w-0">
      {/* Stories row */}
      <div className="flex gap-3 overflow-x-auto px-[var(--space-page)] py-3 scrollbar-thin">
        {masters.map((m) => {
          const name = m.master.display_name ?? m.master.profile?.full_name ?? '?';
          const avatar = m.master.avatar_url ?? m.master.profile?.avatar_url ?? null;
          return (
            <Link
              key={m.master_id}
              href={`/masters/${m.master_id}`}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <AvatarRing src={avatar} name={name} size={64} hasNewContent={m.hasNewPosts} />
              <span className="max-w-[64px] truncate text-xs text-muted-foreground">{name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>

      {/* Industry chips — click expands a profession sublist underneath */}
      <div className="px-[var(--space-page)] pb-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {INDUSTRIES.map(({ key, icon: Icon }) => {
            const active = activeIndustry === key;
            return (
              <button
                key={key}
                onClick={() => setActiveIndustry(active ? null : key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'border-[var(--ds-accent)] bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]'
                    : 'bg-card hover:bg-muted hover:-translate-y-0.5 hover:shadow-sm',
                )}
              >
                <Icon className="size-4" />
                <span>{tInd(key)}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {activeIndustry && INDUSTRY_PROFESSIONS[activeIndustry] && (
            <motion.div
              key={activeIndustry}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pt-3">
                {INDUSTRY_PROFESSIONS[activeIndustry].map((prof) => (
                  <Link
                    key={prof}
                    href={`/masters?industry=${activeIndustry}&profession=${prof}`}
                    className="rounded-full border bg-background px-3.5 py-1.5 text-xs text-muted-foreground hover:border-[var(--ds-accent)] hover:text-foreground transition-colors"
                  >
                    {tProf(prof)}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* От твоих мастеров — immersive hero cards, equal height, gradient fallback when no image */}
      {burningSlots.length > 0 && (
        <div className="pb-6">
          <div className="flex items-center justify-between px-[var(--space-page)] pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight">{t('subscriptionsTitle')}</h3>
              <span className="text-xs text-muted-foreground">· {t('subscriptionsSubtitle')}</span>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto px-[var(--space-page)] pb-2 scrollbar-thin">
            {burningSlots.map((slot) => {
              const name = slot.master.display_name ?? slot.master.profile?.full_name ?? '?';
              const avatar = slot.master.avatar_url ?? slot.master.profile?.avatar_url ?? null;
              const typeGradients: Record<string, string> = {
                burning_slot: 'from-emerald-500 via-teal-500 to-cyan-600',
                promotion: 'from-amber-400 via-rose-500 to-fuchsia-600',
                before_after: 'from-violet-500 via-purple-500 to-indigo-600',
                new_service: 'from-sky-500 via-blue-500 to-indigo-600',
                update: 'from-zinc-500 via-slate-600 to-zinc-700',
              };
              const gradient = typeGradients[slot.type] ?? typeGradients.update;
              return (
                <Link
                  key={slot.id}
                  href={`/book?master_id=${slot.master.id}${slot.linked_service_id ? `&service_id=${slot.linked_service_id}` : ''}`}
                  className="group/slot relative flex h-[340px] w-[260px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                >
                  {/* Hero — image or gradient fallback */}
                  <div className={cn('relative h-[180px] w-full overflow-hidden bg-gradient-to-br', gradient)}>
                    {slot.image_url ? (
                      <img
                        src={slot.image_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/slot:scale-105"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white/90">
                          {typeIcons[slot.type]
                            ? <span className="[&>svg]:size-16 [&>svg]:stroke-[1.2]">{typeIcons[slot.type]}</span>
                            : <Sparkles className="size-16 stroke-[1.2]" />}
                        </span>
                      </div>
                    )}
                    {/* Bottom scrim for legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                    {/* Type pill */}
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-md">
                      {typeIcons[slot.type]}
                      {t(slot.type as 'burning_slot' | 'promotion' | 'before_after' | 'new_service' | 'update')}
                    </span>
                    {/* Master chip over the hero */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      {avatar ? (
                        <img src={avatar} alt={name} className="size-8 rounded-full object-cover ring-2 ring-white/90" />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-white/95 text-xs font-bold text-foreground ring-2 ring-white/90">
                          {name[0]}
                        </div>
                      )}
                      <span className="max-w-[160px] truncate text-xs font-semibold text-white drop-shadow-md">{name}</span>
                    </div>
                  </div>
                  {/* Body — fixed height so all cards align */}
                  <div className="flex flex-1 flex-col justify-between gap-2 p-4">
                    <div className="space-y-1">
                      {slot.title && <p className="line-clamp-2 text-sm font-semibold leading-snug">{slot.title}</p>}
                      {slot.master.specialization && (
                        <p className="truncate text-[11px] text-muted-foreground">{slot.master.specialization}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      {slot.expires_at ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Clock className="size-3" />
                          {t('expiresIn', { hours: hoursUntil(slot.expires_at) })}
                        </div>
                      ) : <span />}
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover/slot:translate-x-1 group-hover/slot:text-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Right rail — densified context. pr-3 mirrors left sidebar inner padding so distances are symmetric */}
      <aside className="hidden lg:block pr-3">
        <div className="sticky top-4 space-y-4">
          {/* Next appointment */}
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
              <CalendarCheck className="size-4 text-[var(--ds-accent)]" />
              <h3 className="text-sm font-semibold">{t('nextApptTitle')}</h3>
            </div>
            {nextAppt ? (
              <Link href={`/my-calendar`} className="block p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  {nextAppt.masterAvatar ? (
                    <img src={nextAppt.masterAvatar} alt="" className="size-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-[var(--ds-accent)]/15 text-sm font-semibold text-[var(--ds-accent)]">
                      {nextAppt.masterName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nextAppt.service ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{nextAppt.masterName}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {new Date(nextAppt.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-[var(--ds-accent)]">
                    {new Date(nextAppt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="p-5 text-center">
                <p className="text-xs text-muted-foreground">{t('nextApptEmpty')}</p>
                <Link href="/masters" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ds-accent)] hover:underline">
                  {t('discover')}
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Your usual — shown when no next appt but client has a repeat pattern */}
          {!nextAppt && usual && (
            <Link
              href={`/book?master_id=${usual.masterId}&service_id=${usual.serviceId}`}
              className="group/usual block overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[var(--ds-accent)]/10 via-card to-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <Sparkles className="size-4 text-[var(--ds-accent)]" />
                <h3 className="text-sm font-semibold">{t('usualTitle')}</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  {usual.masterAvatar ? (
                    <img src={usual.masterAvatar} alt="" className="size-11 rounded-full object-cover ring-1 ring-border/60" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-[var(--ds-accent)]/15 text-sm font-semibold text-[var(--ds-accent)]">
                      {usual.masterName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{usual.serviceName}</p>
                    <p className="truncate text-xs text-muted-foreground">{usual.masterName}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('usualSubtitle', { visits: usual.visits })}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)] group-hover/usual:underline">
                    {t('bookYourUsual')}
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            </Link>
          )}

          {/* Cross-master recommendations — "your nail master suggests this massage therapist" */}
          {recommendations.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <Sparkles className="size-4 text-[var(--ds-accent)]" />
                <h3 className="text-sm font-semibold">{t('recsTitle')}</h3>
              </div>
              <ul className="divide-y divide-border/60">
                {recommendations.map((r) => (
                  <li key={r.id}>
                    <Link href={`/masters/${r.toMasterId}`} className="group/rec flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                      {r.toAvatar ? (
                        <img src={r.toAvatar} alt="" className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border/60" />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent)]/10 text-xs font-semibold text-[var(--ds-accent)]">
                          {r.toName[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold group-hover/rec:text-[var(--ds-accent)]">{r.toName}</p>
                        {r.toSpec && <p className="truncate text-xs text-muted-foreground">{r.toSpec}</p>}
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {t('recsFrom', { name: r.fromName })}
                          {r.note ? ` — ${r.note}` : ''}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 self-center text-muted-foreground transition-colors group-hover/rec:text-[var(--ds-accent)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended masters */}
          {discover.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-[var(--ds-accent)]" />
                  <h3 className="text-sm font-semibold">{t('recommendedTitle')}</h3>
                </div>
                <Link href="/masters" className="text-[11px] font-medium text-[var(--ds-accent)] hover:underline">
                  {t('viewAll')}
                </Link>
              </div>
              <ul className="divide-y divide-border/60">
                {discover.slice(0, 6).map((m) => {
                  const name = m.master.display_name ?? m.master.profile?.full_name ?? '?';
                  const avatar = m.master.avatar_url ?? m.master.profile?.avatar_url ?? null;
                  return (
                    <li key={m.master.id}>
                      <Link href={`/masters/${m.master.id}`} className="group/rec flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                        {avatar ? (
                          <img src={avatar} alt="" className="size-10 rounded-full object-cover ring-1 ring-border/60" />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--ds-accent)]/10 text-xs font-semibold text-[var(--ds-accent)]">
                            {name[0]}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{m.master.specialization ?? ''}</p>
                        </div>
                        <span className="rounded-full bg-[var(--ds-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--ds-accent)] opacity-0 transition-opacity group-hover/rec:opacity-100">
                          {t('viewMaster')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>
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
  const isPromo = post.type === 'promotion';
  // TODO Phase 8: real social-proof from bookings
  const bookedCount = (post.id.charCodeAt(0) % 9) + 2;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Link href={`/masters/${post.master.id}`}>
          <AvatarRing
            src={post.master.avatar_url ?? post.master.profile?.avatar_url ?? null}
            name={post.master.display_name ?? post.master.profile?.full_name ?? '?'}
            size={44}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/masters/${post.master.id}`} className="flex items-center gap-1 text-sm font-semibold hover:underline">
            {post.master.display_name ?? post.master.profile?.full_name ?? '?'}
            <Star className="size-3 fill-amber-400 text-amber-400" />
          </Link>
          {post.master.specialization && (
            <p className="truncate text-xs text-muted-foreground">{post.master.specialization}</p>
          )}
        </div>
        {isPromo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <Sparkles className="h-3 w-3" />
            {t('promoBadge')}
          </span>
        ) : (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', typeColors[typeKey])}>
            {typeIcons[typeKey]}
            {t(typeKey)}
          </span>
        )}
      </div>

      {/* Image — only renders when we have a valid src and onError hides the whole block */}
      {post.image_url && post.image_url.trim().length > 0 && (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-muted to-muted/60">
          <img
            src={post.image_url}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              const parent = (e.currentTarget as HTMLImageElement).parentElement;
              if (parent) parent.style.display = 'none';
            }}
          />
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <Users className="size-3" />
            {t('peopleBooked', { count: bookedCount })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-2 p-4">
        {post.title && <p className="text-base font-semibold leading-snug">{post.title}</p>}
        {post.body && <p className="text-sm text-muted-foreground line-clamp-3">{post.body}</p>}

        {post.type === 'burning_slot' && post.expires_at && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Clock className="size-3" />
            {t('expiresIn', { hours: hoursUntil(post.expires_at) })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border/60 px-3 py-2">
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Heart className="h-4 w-4" />
          {t('save')}
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Share2 className="h-4 w-4" />
          {t('share')}
        </button>
        <div className="flex-1" />
        <Link
          href={post.linked_service_id ? `/book?master=${post.master.id}&service=${post.linked_service_id}` : `/masters/${post.master.id}`}
          className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
        >
          {t('bookNow')}
        </Link>
      </div>
    </div>
  );
}
