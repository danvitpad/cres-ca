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
}

export default function MyMastersPage() {
  const t = useTranslations('clientMyMasters');
  const { userId } = useAuthStore();
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: links } = await supabase
        .from('client_master_links')
        .select('master_id, masters:masters!client_master_links_master_id_fkey(id, specialization, rating, city, display_name, avatar_url, profiles:profiles!masters_profile_id_fkey(id, full_name, avatar_url))')
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
          .map((row: { master_id: string; masters: unknown }) => {
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
        <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-10" />
          </div>
          <p className="mt-6 text-xl font-semibold">{t('emptyTitle')}</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('emptyDesc')}</p>
          <Link
            href="/masters"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Search className="size-4" />
            {t('findMaster')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {masters.map((m) => (
            <div key={m.id} className="rounded-3xl border bg-card p-5 transition-all hover:shadow-lg">
              <Link href={`/masters/${m.id}`} className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 text-2xl font-semibold text-primary-foreground">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.full_name ?? ''} className="size-full object-cover" />
                  ) : (
                    (m.full_name || 'M')[0].toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.specialization}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
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
              </Link>
              <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('nextVisit')}:</span>
                <span className="font-medium">
                  {m.nextVisit
                    ? new Date(m.nextVisit).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : t('noNextVisit')}
                </span>
              </div>
              {m.bonusPoints > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs">
                  <Gift className="size-3.5 text-amber-600" />
                  <span className="text-muted-foreground">{t('bonusLabel')}:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {m.bonusPoints} {t('bonusPoints')}
                  </span>
                </div>
              )}
              {m.lastPost && (
                <Link
                  href={`/masters/${m.id}`}
                  className="mt-3 flex items-center gap-3 rounded-xl bg-muted/40 p-2 transition-colors hover:bg-muted"
                >
                  {m.lastPost.image_url && (
                    <img
                      src={m.lastPost.image_url}
                      alt=""
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {m.lastPost.title ?? t('latestPost')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.lastPost.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
