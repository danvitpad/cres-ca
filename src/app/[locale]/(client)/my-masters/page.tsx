/** --- YAML
 * name: ClientMyMastersPage
 * description: Клиентские подписки на мастеров. Salon-aware карточки (solo / salon_with_master) с User/Building2 иконкой, реальные метрики (rating, visit count, next visit, referral bonus), inline unsubscribe через /api/follow/crm/toggle.
 * created: 2026-04-12
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  UserPlus,
  Star,
  Calendar,
  Search,
  MapPin,
  Gift,
  User,
  Building2,
  UserMinus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfirm } from '@/hooks/use-confirm';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveCardDisplay, type SalonRef } from '@/lib/client/display-mode';

type SalonEmbed =
  | { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null }
  | null;

function unwrapSalon(s: SalonEmbed | SalonEmbed[] | null | undefined): SalonRef | null {
  if (!s) return null;
  const obj = Array.isArray(s) ? s[0] ?? null : s;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, logo_url: obj.logo_url, city: obj.city, rating: obj.rating };
}

interface MasterRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  rating: number | null;
  city: string | null;
  salon_id: string | null;
  salon: SalonRef | null;
  nextVisit: string | null;
  lastPost: { title: string | null; image_url: string | null; created_at: string } | null;
  bonusPoints: number;
  visitCount: number;
  mutual: boolean;
}

export default function MyMastersPage() {
  const t = useTranslations('clientMyMasters');
  const tf = useTranslations('followSystem');
  const tCard = useTranslations('cardLabels');
  const { userId } = useAuthStore();
  const confirm = useConfirm();
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unsubscribing, setUnsubscribing] = useState<string | null>(null);

  const cardLabels = useMemo(
    () => ({
      masterPlaceholder: tCard('masterPlaceholder'),
      salonPlaceholder: tCard('salonPlaceholder'),
      managerAssigned: tCard('managerAssigned'),
    }),
    [tCard],
  );

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: links } = await supabase
        .from('client_master_links')
        .select(
          'master_id, master_follows_back, masters:masters!client_master_links_master_id_fkey(id, specialization, rating, city, display_name, avatar_url, salon_id, profiles:profiles!masters_profile_id_fkey(id, full_name, avatar_url), salon:salons(id, name, logo_url, city))',
        )
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
                  salon_id?: string | null;
                  profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
                  salon?: SalonEmbed | SalonEmbed[];
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
              salon_id: m.salon_id ?? null,
              salon: unwrapSalon(m.salon ?? null),
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

  const handleUnsubscribe = useCallback(
    async (master: MasterRow) => {
      const displayName = master.full_name || tCard('masterPlaceholder');
      const ok = await confirm({
        title: t('confirmUnsubscribeTitle'),
        description: t('confirmUnsubscribeDesc', { name: displayName }),
        confirmLabel: t('unsubscribe'),
        destructive: true,
      });
      if (!ok) return;

      setUnsubscribing(master.id);
      try {
        const res = await fetch('/api/follow/crm/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterId: master.id }),
        });
        const json = (await res.json().catch(() => ({}))) as { following?: boolean; error?: string };
        if (!res.ok || json.following !== false) {
          toast.error(t('unsubscribeError'));
          return;
        }
        setMasters((prev) => prev.filter((m) => m.id !== master.id));
        toast.success(t('unsubscribeSuccess'));
      } catch {
        toast.error(t('unsubscribeError'));
      } finally {
        setUnsubscribing(null);
      }
    },
    [confirm, t, tCard],
  );

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
            href="/search"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
          >
            <Search className="size-4" />
            {t('findMaster')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {masters.map((m, idx) => {
            const masterRef = {
              id: m.id,
              display_name: m.full_name,
              avatar_url: m.avatar_url,
              specialization: m.specialization,
              rating: m.rating,
              salon_id: m.salon_id,
            };
            const d = resolveCardDisplay(masterRef, m.salon, cardLabels);
            const cover = m.lastPost?.image_url ?? null;
            const Icon = d.mode === 'solo' ? User : Building2;
            const isBusy = unsubscribing === m.id;
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
                    // eslint-disable-next-line @next/next/no-img-element
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
                        {d.avatarSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.avatarSrc} alt={d.avatarName} className="size-full object-cover" />
                        ) : (
                          (d.avatarName || 'M')[0].toUpperCase()
                        )}
                      </div>
                    </Link>
                  </div>

                  {/* Name + meta */}
                  <div className="mt-2">
                    <Link href={`/masters/${m.id}`} className="block">
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <p className="truncate text-base font-semibold leading-snug">{d.primary}</p>
                        {m.mutual && (
                          <span className="shrink-0 rounded-full bg-[var(--ds-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--ds-accent)]">
                            {tf('mutual')}
                          </span>
                        )}
                      </div>
                      {d.secondary && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.secondary}</p>
                      )}
                    </Link>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                      {d.rating != null && (
                        <span className="flex items-center gap-1">
                          <Star className="size-3 fill-amber-400 stroke-amber-400" />
                          <span className="font-medium">{d.rating.toFixed(1)}</span>
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

                  {/* Actions: Book + Unsubscribe */}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/book?master_id=${m.id}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--ds-accent)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
                    >
                      <Calendar className="size-4" />
                      {t('quickBook')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleUnsubscribe(m)}
                      disabled={isBusy}
                      aria-label={t('unsubscribe')}
                      className="flex size-10 items-center justify-center rounded-[var(--radius-button)] border border-border/60 bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <UserMinus className="size-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
