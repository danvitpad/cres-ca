/** --- YAML
 * name: TopMastersRow
 * description: Horizontal scrollable row of top-rated masters with gradient avatar rings
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TopMaster {
  id: string;
  rating: number;
  total_reviews: number;
  specialization: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile: { full_name: string; avatar_url: string | null } | null;
}

export function TopMastersRow() {
  const t = useTranslations('feed');
  const router = useRouter();
  const [masters, setMasters] = useState<TopMaster[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('masters')
        .select('id, rating, total_reviews, specialization, display_name, avatar_url, profile:profiles!masters_profile_id_fkey(full_name, avatar_url)')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(20);

      if (!data) return;

      // Sort by rating * ln(review_count + 1)
      const sorted = (data as unknown as TopMaster[]).sort((a, b) => {
        const scoreA = (a.rating ?? 0) * Math.log((a.total_reviews ?? 0) + 1);
        const scoreB = (b.rating ?? 0) * Math.log((b.total_reviews ?? 0) + 1);
        return scoreB - scoreA;
      });

      setMasters(sorted);
    }
    load();
  }, []);

  if (masters.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-sm font-semibold text-muted-foreground">{t('topMasters')}</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {masters.map((master, i) => {
          const name = master.display_name ?? master.profile?.full_name ?? '?';
          const avatarUrl = master.avatar_url ?? master.profile?.avatar_url;
          const isTop3 = i < 3;
          const hasReviews = (master.total_reviews ?? 0) > 0;
          const initials = name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <button
              key={master.id}
              onClick={() => router.push(`/masters/${master.id}`)}
              className="flex flex-col items-center gap-1 min-w-[72px]"
            >
              <div className="relative">
                {hasReviews && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: isTop3
                        ? 'conic-gradient(from 0deg, #f59e0b, #eab308, #d97706, #f59e0b)'
                        : 'conic-gradient(from 0deg, var(--ds-accent), #a855f7, var(--ds-accent))',
                    }}
                  />
                )}
                <div
                  className="relative overflow-hidden rounded-full bg-muted"
                  style={{
                    width: hasReviews ? 54 : 60,
                    height: hasReviews ? 54 : 60,
                    margin: hasReviews ? 3 : 0,
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] font-semibold text-xs">
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <span className="max-w-[68px] truncate text-xs font-medium">
                {name.split(' ')[0]}
              </span>
              {master.specialization && (
                <span className="max-w-[68px] truncate text-[10px] text-muted-foreground">
                  {master.specialization}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
