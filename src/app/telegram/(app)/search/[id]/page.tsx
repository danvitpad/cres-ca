/** --- YAML
 * name: MiniAppMasterDetail
 * description: Mini App master profile — avatar, rating, services, portfolio gallery, reviews, working hours, book CTA. Dark theme.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, MapPin, Clock, Loader2, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_minutes: number;
  description: string | null;
}

interface PortfolioItem {
  id: string;
  image_url: string;
  caption: string | null;
}

interface ReviewItem {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
}

type WorkingHoursMap = Record<string, { start: string; end: string } | null>;

interface MasterDetail {
  id: string;
  display_name: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  address: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  full_name: string | null;
  working_hours: WorkingHoursMap | null;
  services: ServiceItem[];
  portfolio: PortfolioItem[];
  reviews: ReviewItem[];
}

export default function MiniAppMasterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { haptic } = useTelegram();
  const [master, setMaster] = useState<MasterDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('masters')
        .select('id, display_name, specialization, bio, city, address, rating, total_reviews, avatar_url, working_hours, profile:profiles(full_name, avatar_url), services(id, name, price, currency, duration_minutes, description, is_active)')
        .eq('id', params.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      const m = data as unknown as {
        id: string;
        display_name: string | null;
        specialization: string | null;
        bio: string | null;
        city: string | null;
        address: string | null;
        rating: number | null;
        total_reviews: number | null;
        avatar_url: string | null;
        working_hours: WorkingHoursMap | null;
        profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
        services: Array<ServiceItem & { is_active: boolean }>;
      };
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;

      // Load portfolio
      const { data: portfolioData } = await supabase
        .from('master_portfolio')
        .select('id, image_url, caption')
        .eq('master_id', params.id)
        .eq('is_published', true)
        .order('sort_order', { ascending: false })
        .limit(12);

      // Load reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, score, comment, created_at, reviewer:profiles!reviewer_id(full_name)')
        .eq('target_id', params.id)
        .eq('target_type', 'master')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(10);

      const reviews: ReviewItem[] = (reviewsData ?? []).map((r: unknown) => {
        const rv = r as {
          id: string;
          score: number;
          comment: string | null;
          created_at: string;
          reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
        };
        const reviewer = Array.isArray(rv.reviewer) ? rv.reviewer[0] : rv.reviewer;
        return {
          id: rv.id,
          score: rv.score,
          comment: rv.comment,
          created_at: rv.created_at,
          reviewer_name: reviewer?.full_name ?? null,
        };
      });

      setMaster({
        id: m.id,
        display_name: m.display_name,
        specialization: m.specialization,
        bio: m.bio,
        city: m.city,
        address: m.address,
        rating: Number(m.rating ?? 0),
        total_reviews: Number(m.total_reviews ?? 0),
        avatar_url: m.avatar_url ?? p?.avatar_url ?? null,
        full_name: p?.full_name ?? null,
        working_hours: m.working_hours,
        services: (m.services ?? []).filter((s) => s.is_active),
        portfolio: (portfolioData ?? []) as PortfolioItem[],
        reviews,
      });
      setLoading(false);
    })();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-white/60">Мастер не найден</p>
      </div>
    );
  }

  const name = master.display_name ?? master.full_name ?? '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 px-5 pt-6 pb-10"
    >
      <button
        onClick={() => { haptic('light'); router.back(); }}
        className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 text-2xl font-bold">
          {master.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.avatar_url} alt={name} className="size-full object-cover" />
          ) : (
            name[0] ?? 'M'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{name}</h1>
          {master.specialization && (
            <p className="mt-0.5 truncate text-[13px] text-white/60">{master.specialization}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[12px] text-white/70">
            {master.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{master.rating.toFixed(1)}</span>
                <span className="text-white/40">({master.total_reviews})</span>
              </div>
            )}
            {master.city && (
              <div className="flex items-center gap-1 truncate">
                <MapPin className="size-3" />
                <span className="truncate">{master.city}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {master.bio && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] leading-relaxed text-white/75">
          {master.bio}
        </p>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Услуги</h2>
        {master.services.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-[12px] text-white/50">
            Пока нет активных услуг
          </div>
        ) : (
          <ul className="space-y-2">
            {master.services.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <button
                  onClick={() => {
                    haptic('light');
                    router.push(`/telegram/book?master_id=${master.id}&service_id=${s.id}`);
                  }}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                      <Clock className="size-3" />
                      {s.duration_minutes} мин
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{Number(s.price).toFixed(0)} ₴</p>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Portfolio gallery */}
      {master.portfolio.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Портфолио</h2>
          <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
            {master.portfolio.map((item) => (
              <div key={item.id} className="relative aspect-square overflow-hidden bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.caption ?? ''} className="size-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {master.reviews.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">
            Отзывы <span className="text-white/40">({master.total_reviews})</span>
          </h2>
          <ul className="space-y-2">
            {master.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{r.reviewer_name ?? 'Клиент'}</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-3 ${i < r.score ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="mt-2 text-[12px] leading-relaxed text-white/65">{r.comment}</p>
                )}
                <p className="mt-1.5 text-[10px] text-white/30">
                  {new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Working hours */}
      {master.working_hours && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Часы работы</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <ul className="space-y-1.5">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                const dayNames: Record<string, string> = {
                  monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт',
                  friday: 'Пт', saturday: 'Сб', sunday: 'Вс',
                };
                const h = master.working_hours?.[day];
                return (
                  <li key={day} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/60">{dayNames[day]}</span>
                    <span className={h ? 'font-semibold' : 'text-white/30'}>
                      {h ? `${h.start} — ${h.end}` : 'Выходной'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <button
        onClick={() => { haptic('selection'); router.push(`/telegram/book?master_id=${master.id}`); }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform"
      >
        <Calendar className="size-4" /> Записаться
      </button>
    </motion.div>
  );
}
