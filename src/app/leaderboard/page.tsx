/** --- YAML
 * name: Public Masters Leaderboard
 * description: Публичный топ-10 мастеров недели/месяца в городе per-vertical. SEO-friendly SSR с фильтрами через searchParams.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Star } from 'lucide-react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { computeMasterScore, loadWeightsByVertical, pickWeights } from '@/lib/scoring/master-score';

interface PageProps {
  searchParams: Promise<{ period?: string; city?: string; vertical?: string }>;
}

export const metadata: Metadata = {
  title: 'Топ мастеров — CRES-CA',
  description: 'Лучшие мастера недели и месяца по городам и направлениям. Рейтинг, лайки, отзывы.',
};

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const period = sp.period === 'month' ? 'month' : 'week';
  const city = sp.city ?? '';
  const vertical = sp.vertical ?? '';

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const from = new Date(now.getTime() - (period === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000);

  // Base master query
  let query = supabase
    .from('masters')
    .select('id, display_name, city, vertical, rating, total_reviews, likes_count, badges, level, invite_code, profile:profiles(full_name, avatar_url)')
    .eq('is_active', true)
    .limit(500);
  if (city) query = query.eq('city', city);
  if (vertical) query = query.eq('vertical', vertical);
  const { data: mastersData } = await query;

  // Period-scoped completed appointments for ranking
  const aptQuery = supabase
    .from('appointments')
    .select('master_id, price, status')
    .eq('status', 'completed')
    .gte('starts_at', from.toISOString());
  const { data: aptsData } = await aptQuery;
  type Apt = { master_id: string; price: number | null };
  const periodRev = new Map<string, number>();
  const periodCount = new Map<string, number>();
  for (const a of ((aptsData ?? []) as unknown) as Apt[]) {
    periodRev.set(a.master_id, (periodRev.get(a.master_id) ?? 0) + Number(a.price ?? 0));
    periodCount.set(a.master_id, (periodCount.get(a.master_id) ?? 0) + 1);
  }

  const weightsByVertical = await loadWeightsByVertical(supabase as unknown as Parameters<typeof loadWeightsByVertical>[0]);

  type M = {
    id: string;
    display_name: string | null;
    city: string | null;
    vertical: string | null;
    rating: number | null;
    total_reviews: number | null;
    likes_count: number | null;
    badges: string[] | null;
    level: number | null;
    invite_code: string | null;
    profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
  };

  const ranked = (((mastersData ?? []) as unknown) as M[])
    .map((m) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      const visits = periodCount.get(m.id) ?? 0;
      const rev = periodRev.get(m.id) ?? 0;
      const rating = Number(m.rating ?? 0);
      const likes = Number(m.likes_count ?? 0);
      const badges = (m.badges ?? []);
      const w = pickWeights(weightsByVertical, m.vertical);
      const score = computeMasterScore(
        {
          rating,
          likes,
          badges,
          level: Number(m.level ?? 0),
          visits,
          freshDays: 0,
          responseFast: badges.includes('fast-responder'),
        },
        w,
      );
      return {
        id: m.id,
        name: m.display_name ?? p?.full_name ?? '—',
        avatar: p?.avatar_url ?? null,
        city: m.city,
        vertical: m.vertical,
        rating,
        reviews: Number(m.total_reviews ?? 0),
        likes,
        badges,
        level: m.level ?? 0,
        handle: m.invite_code,
        visits,
        revenue: rev,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const periodLabel = period === 'week' ? 'недели' : 'месяца';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Trophy className="size-7 text-amber-500" />
          Топ мастеров {periodLabel}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Лучшие мастера {city ? `в городе ${city}` : 'по всем городам'}
          {vertical && ` · ${vertical}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <PeriodLink current={period} to="week" city={city} vertical={vertical} />
        <PeriodLink current={period} to="month" city={city} vertical={vertical} />
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-neutral-500">Пока нет данных для рейтинга.</p>
      ) : (
        <div className="space-y-2">
          {ranked.map((r, i) => (
            <Link
              key={r.id}
              href={r.handle ? `/m/${r.handle}` : '#'}
              className="flex items-center gap-3 rounded-xl border bg-white p-4 transition-colors hover:bg-neutral-50"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  i === 0
                    ? 'bg-amber-400 text-white'
                    : i === 1
                      ? 'bg-neutral-300 text-white'
                      : i === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {i + 1}
              </div>
              {r.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar} alt={r.name} className="size-12 rounded-full object-cover" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold">
                  {r.name[0] ?? 'M'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{r.name}</span>
                  {r.level > 0 && (
                    <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                      Lv {r.level}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">
                  {r.rating > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {r.rating.toFixed(1)}
                    </span>
                  )}
                  <span>❤ {r.likes}</span>
                  <span>{r.visits} визитов</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                  {[r.city, r.vertical].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold">{r.score.toFixed(0)}</div>
                <div className="text-[10px] text-neutral-500">score</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodLink({ current, to, city, vertical }: { current: string; to: 'week' | 'month'; city: string; vertical: string }) {
  const qs = new URLSearchParams();
  qs.set('period', to);
  if (city) qs.set('city', city);
  if (vertical) qs.set('vertical', vertical);
  return (
    <Link
      href={`/leaderboard?${qs.toString()}`}
      className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
        current === to ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700'
      }`}
    >
      {to === 'week' ? 'Неделя' : 'Месяц'}
    </Link>
  );
}
