/** --- YAML
 * name: ClientFavoritesPage
 * description: Client favorites — tabs for saved masters, venues and services
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Heart, Search, Star, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FavMaster {
  master_id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  rating: number | null;
  city: string | null;
}

export default function FavoritesPage() {
  const t = useTranslations('clientFavorites');
  const { userId } = useAuthStore();
  const [masters, setMasters] = useState<FavMaster[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data: favs } = await supabase
        .from('client_favorites')
        .select('target_id')
        .eq('profile_id', userId)
        .eq('target_type', 'master');

      if (!favs || favs.length === 0) return;
      const masterIds = favs.map((f: { target_id: string }) => f.target_id);
      const { data: rows } = await supabase
        .from('masters')
        .select('id, specialization, rating, city, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url)')
        .in('id', masterIds);

      if (rows) {
        const list: FavMaster[] = rows.map((m: unknown) => {
          const row = m as {
            id: string;
            specialization: string | null;
            rating: number | null;
            city: string | null;
            profiles: { full_name?: string | null; avatar_url?: string | null } | { full_name?: string | null; avatar_url?: string | null }[] | null;
          };
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            master_id: row.id,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            specialization: row.specialization,
            rating: row.rating,
            city: row.city,
          };
        });
        setMasters(list);
      }
    }
    load();
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <Tabs defaultValue="masters" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[420px]">
          <TabsTrigger value="masters">{t('tab_masters')}</TabsTrigger>
          <TabsTrigger value="venues">{t('tab_venues')}</TabsTrigger>
          <TabsTrigger value="services">{t('tab_services')}</TabsTrigger>
        </TabsList>

        <TabsContent value="masters" className="mt-6">
          {masters.length === 0 ? (
            <EmptyState
              title={t('emptyTitle')}
              desc={t('emptyDesc')}
              ctaHref="/masters"
              ctaLabel={t('emptyCta')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {masters.map((m) => (
                <Link
                  key={m.master_id}
                  href={`/masters/${m.master_id}`}
                  className="group rounded-3xl border bg-card p-5 transition-all hover:shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-2xl font-semibold text-primary-foreground">
                      {(m.full_name || 'M')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.specialization}</p>
                      {m.rating != null && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <Star className="size-3 fill-amber-400 stroke-amber-400" />
                          <span className="font-medium">{m.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {m.city && (
                    <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {m.city}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="venues" className="mt-6">
          <EmptyState title={t('emptyTitle')} desc={t('emptyDesc')} ctaHref="/masters" ctaLabel={t('emptyCta')} />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <EmptyState title={t('emptyTitle')} desc={t('emptyDesc')} ctaHref="/book" ctaLabel={t('emptyCta')} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function EmptyState({
  title,
  desc,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  desc: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Heart className="size-10" />
      </div>
      <p className="mt-6 text-xl font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{desc}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Search className="size-4" />
        {ctaLabel}
      </Link>
    </div>
  );
}
