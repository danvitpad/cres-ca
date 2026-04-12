/** --- YAML
 * name: ClientReviewsPage
 * description: List of anonymous reviews the client has left for masters
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Star, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

interface ReviewRow {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  master_name: string | null;
}

export default function ReviewsPage() {
  const t = useTranslations('clientReviews');
  const { userId } = useAuthStore();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('reviews')
        .select('id, score, comment, created_at, target_id, target_type')
        .eq('reviewer_id', userId)
        .eq('target_type', 'master')
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) return;
      const masterIds = data.map((r: { target_id: string }) => r.target_id);
      const { data: masters } = await supabase
        .from('masters')
        .select('id, display_name, profiles:profiles!masters_profile_id_fkey(full_name)')
        .in('id', masterIds);

      const nameById = new Map<string, string>();
      masters?.forEach((m: unknown) => {
        const row = m as {
          id: string;
          display_name: string | null;
          profiles: { full_name?: string | null } | { full_name?: string | null }[] | null;
        };
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const name = row.display_name ?? profile?.full_name ?? null;
        if (name) nameById.set(row.id, name);
      });

      const list: ReviewRow[] = data.map(
        (r: { id: string; score: number; comment: string | null; created_at: string; target_id: string }) => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          created_at: r.created_at,
          master_name: nameById.get(r.target_id) ?? null,
        }),
      );
      setReviews(list);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('desc')}</p>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="size-10" />
          </div>
          <p className="mt-6 text-xl font-semibold">{t('emptyTitle')}</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{r.master_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()} · {t('anonymous')}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${i < r.score ? 'fill-amber-400 stroke-amber-400' : 'stroke-muted-foreground/40'}`}
                    />
                  ))}
                </div>
              </div>
              {r.comment && <p className="mt-3 text-sm leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
