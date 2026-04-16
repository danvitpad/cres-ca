/** --- YAML
 * name: ClientMyMastersPage
 * description: List of masters the client follows (subscribed) — shows rating, next visit, quick rebook
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { UserPlus, Star, Calendar, Search, MapPin, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface MasterRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  rating: number | null;
  city: string | null;
  nextVisit: string | null;
  lastPost: { title: string | null; image_url: string | null; created_at: string } | null;
  bonusPoints: number;
  visitCount: number;
  mutual: boolean;
}

export default function MyMastersPage() {
  const t = useTranslations('clientMyMasters');
  const tf = useTranslations('followSystem');
  const { userId } = useAuthStore();
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: links } = await supabase
        .from('client_master_links')
        .select('master_id, master_follows_back, masters:masters!client_master_links_master_id_fkey(id, specialization, rating, city, display_name, avatar_url, profiles:profiles!masters_profile_id_fkey(id, full_name, avatar_url))')
        .eq('profile_id', userId);

      if (links && links.length > 0) {
        const masterIds = links.map((l: { master_id: string }) => l.master_id);

        const { data: posts } = await supabase
          .from('feed_posts')
          .select('master_id, title, image_url, created_at')
          .in('master_id', masterIds)
          .order('created_at', { ascending: false });

        const lastPostByMaster = new Map<string, { title: string | null; image_url: string | null; created_at: string }>();
        posts?.forEach((p: { master_id: string; title: string | null; image_url: string | null; created_at: string }) => {
          if (!lastPostByMaster.has(p.master_id)) {
            lastPostByMaster.set(p.master_id, { title: p.title, image_url: p.image_url, created_at: p.created_at });
          }
        });
        const { data: clientRows } = await supabase
          .from('clients')
          .select('id, master_id')
          .eq('profile_id', userId)
          .in('master_id', masterIds);

        const clientIds = clientRows?.map((c: { id: string }) => c.id) ?? [];
        const clientMasterMap = new Map<string, string>(
          clientRows?.map((c: { id: string; master_id: string }) => [c.id, c.master_id]) ?? [],
        );

        const nextByMaster = new Map<string, string>();
        const bonusByMaster = new Map<string, number>();
        const visitCountByMaster = new Map<string, number>();
        if (clientIds.length > 0) {
          const { data: upcoming } = await supabase
            .from('appointments')
            .select('client_id, master_id, starts_at')
            .in('client_id', clientIds)
            .gte('starts_at', new Date().toISOString())
            .order('starts_at', { ascending: true });

          upcoming?.forEach((a: { client_id: string; master_id: string; starts_at: string }) => {
            const mId = a.master_id ?? clientMasterMap.get(a.client_id);
            if (mId && !nextByMaster.has(mId)) nextByMaster.set(mId, a.starts_at);
          });

          const { data: past } = await supabase
            .from('appointments')
            .select('client_id, master_id, status')
            .in('client_id', clientIds)
            .lt('starts_at', new Date().toISOString());
          past?.forEach((a: { client_id: string; master_id: string; status: string }) => {
            if (a.status === 'cancelled') return;
            const mId = a.master_id ?? clientMasterMap.get(a.client_id);
            if (mId) visitCountByMaster.set(mId, (visitCountByMaster.get(mId) ?? 0) + 1);
          });

          const { data: refs } = await supabase
            .from('referrals')
            .select('referrer_client_id, bonus_points')
            .in('referrer_client_id', clientIds);

          refs?.forEach((r: { referrer_client_id: string; bonus_points: number | null }) => {
            const mId = clientMasterMap.get(r.referrer_client_id);
            if (!mId) return;
            bonusByMaster.set(mId, (bonusByMaster.get(mId) ?? 0) + (r.bonus_points ?? 0));
          });
        }

        const list: MasterRow[] = links
          .map((row: { master_id: string; master_follows_back: boolean; masters: unknown }) => {
            const m = row.masters as
              | {
                  id?: string;
                  specialization?: string | null;
                  rating?: number | null;
                  city?: string | null;
                  display_name?: string | null;
                  avatar_url?: string | null;
                  profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
                }
              | null;
            if (!m?.id) return null;
            return {
              id: m.id,
              full_name: m.display_name ?? m.profiles?.full_name ?? null,
              avatar_url: m.avatar_url ?? m.profiles?.avatar_url ?? null,
              specialization: m.specialization ?? null,
              rating: m.rating ?? null,
              city: m.city ?? null,
              nextVisit: nextByMaster.get(row.master_id) ?? null,
              lastPost: lastPostByMaster.get(row.master_id) ?? null,
              bonusPoints: bonusByMaster.get(row.master_id) ?? 0,
              visitCount: visitCountByMaster.get(row.master_id) ?? 0,
              mutual: row.master_follows_back ?? false,
            };
          })
          .filter((x): x is MasterRow => x !== null);
        setMasters(list);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('desc')}</p>
      </div>

      {masters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card p-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]">
            <UserPlus className="size-10" />
          </div>
          <p className="mt-6 text-xl font-semibold">{t('emptyTitle')}</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('emptyDesc')}</p>
          <Link
            href="/masters"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
          >
            <Search className="size-4" />
            {t('findMaster')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {masters.map((m, idx) => {
            const cover = m.lastPost?.image_url ?? null;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="group/master overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] hover:border-[var(--ds-accent)]/40"
              >
                {/* Cover */}
                <Link href={`/masters/${m.id}`} className="relative block h-32 w-full overflow-hidden">
                  {cover ? (
                    <img src={cover} alt="" className="size-full object-cover transition-transform duration-500 group-hover/master:scale-105" />
                  ) : (
                    <div className="size-full bg-gradient-to-br from-[var(--ds-accent)] via-purple-500 to-pink-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  {m.bonusPoints > 0 && (
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      <Gift className="size-3 text-amber-300" />
                      {m.bonusPoints}
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div className="relative px-5 pb-5">
                  {/* Avatar overlap */}
                  <div className="-mt-10 flex justify-start">
                    <Link href={`/masters/${m.id}`}>
                      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-card text-2xl font-bold text-[var(--ds-accent)] ring-4 ring-card shadow-md">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.full_name ?? ''} className="size-full object-cover" />
                        ) : (
                          (m.full_name || 'M')[0].toUpperCase()
                        )}
                      </div>
                    </Link>
                  </div>

                  {/* Name + meta */}
                  <div className="mt-2">
                    <Link href={`/masters/${m.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold leading-snug">{m.full_name}</p>
                        {m.mutual && (
                          <span className="shrink-0 rounded-full bg-[var(--ds-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--ds-accent)]">
                            {tf('mutual')}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{m.specialization}</p>
                    </Link>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                      {m.rating != null && (
                        <span className="flex items-center gap-1">
                          <Star className="size-3 fill-amber-400 stroke-amber-400" />
                          <span className="font-medium">{m.rating.toFixed(1)}</span>
                        </span>
                      )}
                      {m.city && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="size-3" />
                          {m.city}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visit count + next visit */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
                    <div className="text-center">
                      <p className="text-lg font-bold tabular-nums">{m.visitCount}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('visitsWithYou')}</p>
                    </div>
                    <div className="text-center">
                      <p className="truncate text-xs font-semibold tabular-nums">
                        {m.nextVisit
                          ? new Date(m.nextVisit).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                          : '—'}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('nextVisit')}</p>
                    </div>
                  </div>

                  {/* Quick book */}
                  <Link
                    href={`/book?master_id=${m.id}`}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
                  >
                    <Calendar className="size-4" />
                    {t('quickBook')}
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
