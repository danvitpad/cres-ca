/** --- YAML
 * name: MiniAppMasterDetail
 * description: Master detail Mini App — визуал из mobile-client/master мокапа.
 *              Cover gradient (cobalt) + back/heart/share + аватар-overlap,
 *              имя+спец+рейтинг, 4 tab'а (Послуги/Роботи/Відгуки/Про),
 *              sticky-like bottom CTA «Записатись · від ₴X».
 * created: 2026-04-13
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Heart, Share2, Star, MapPin, Zap, CalendarPlus, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { useAuthStore } from '@/stores/auth-store';
import '@/styles/od-client-mini-app.css';

type Lang = 'uk' | 'ru' | 'en';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_minutes: number;
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

interface MasterDetail {
  id: string;
  name: string;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  address: string | null;
  rating: number;
  total_reviews: number;
  avatar_url: string | null;
  services: ServiceItem[];
}

type TabKey = 'services' | 'portfolio' | 'reviews' | 'about';

const T_LABELS: Record<Lang, {
  back: string;
  experience: (n: number) => string;
  reviewsShort: string;
  tabs: Record<TabKey, string>;
  pickCta: string;
  bookFromCta: (price: number, currency: string) => string;
  freeToday: string;
  noServices: string;
  noPortfolio: string;
  noReviews: string;
  noAbout: string;
  km: string;
  min: string;
}> = {
  uk: {
    back: 'Назад',
    experience: (n) => `${n} років досвіду`,
    reviewsShort: 'відг.',
    tabs: { services: 'Послуги', portfolio: 'Роботи', reviews: 'Відгуки', about: 'Про' },
    pickCta: 'Обрати',
    bookFromCta: (price, currency) => `Записатись · від ${currency === 'UAH' ? '₴' : currency}${Math.round(price)}`,
    freeToday: 'Вільно сьогодні',
    noServices: 'Майстер ще не додав послуг',
    noPortfolio: 'Поки немає робіт',
    noReviews: 'Поки немає відгуків',
    noAbout: 'Майстер не додав опис',
    km: 'км',
    min: 'хв',
  },
  ru: {
    back: 'Назад',
    experience: (n) => `${n} лет опыта`,
    reviewsShort: 'отз.',
    tabs: { services: 'Услуги', portfolio: 'Работы', reviews: 'Отзывы', about: 'О себе' },
    pickCta: 'Выбрать',
    bookFromCta: (price, currency) => `Записаться · от ${currency === 'UAH' ? '₴' : currency}${Math.round(price)}`,
    freeToday: 'Свободно сегодня',
    noServices: 'Мастер ещё не добавил услуг',
    noPortfolio: 'Пока нет работ',
    noReviews: 'Пока нет отзывов',
    noAbout: 'Мастер не добавил описание',
    km: 'км',
    min: 'мин',
  },
  en: {
    back: 'Back',
    experience: (n) => `${n} years experience`,
    reviewsShort: 'rev.',
    tabs: { services: 'Services', portfolio: 'Works', reviews: 'Reviews', about: 'About' },
    pickCta: 'Pick',
    bookFromCta: (price, currency) => `Book · from ${currency === 'UAH' ? '₴' : currency}${Math.round(price)}`,
    freeToday: 'Open today',
    noServices: 'No services yet',
    noPortfolio: 'No portfolio yet',
    noReviews: 'No reviews yet',
    noAbout: 'No description yet',
    km: 'km',
    min: 'min',
  },
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export default function MiniAppMasterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { haptic } = useTelegram();
  const userId = useAuthStore((s) => s.userId);
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const groupBookingId = sp.get('group_booking_id');
  const groupBookingDate = sp.get('date');
  const bookSuffix = groupBookingId
    ? `&group_booking_id=${groupBookingId}&date=${groupBookingDate ?? ''}`
    : '';

  const [master, setMaster] = useState<MasterDetail | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('services');
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [mRes, pRes, rRes] = await Promise.all([
        supabase
          .from('masters')
          .select(`
            id, display_name, specialization, bio, city, address, rating, total_reviews,
            avatar_url,
            profile:profiles!masters_profile_id_fkey(full_name, avatar_url),
            services!services_master_id_fkey(id, name, price, currency, duration_minutes, is_active)
          `)
          .eq('id', params.id)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('master_portfolio')
          .select('id, image_url, caption')
          .eq('master_id', params.id)
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .limit(18),
        supabase
          .from('reviews')
          .select('id, score, comment, created_at, reviewer:profiles!reviewer_id(full_name)')
          .eq('target_id', params.id)
          .eq('target_type', 'master')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      if (!mRes.data) {
        setLoading(false);
        return;
      }

      const m = mRes.data as unknown as {
        id: string;
        display_name: string | null;
        specialization: string | null;
        bio: string | null;
        city: string | null;
        address: string | null;
        rating: number | null;
        total_reviews: number | null;
        avatar_url: string | null;
        profile: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null;
        services: Array<ServiceItem & { is_active: boolean }>;
      };
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;

      setMaster({
        id: m.id,
        name: m.display_name ?? profile?.full_name ?? '—',
        specialization: m.specialization,
        bio: m.bio,
        city: m.city,
        address: m.address,
        rating: Number(m.rating ?? 0),
        total_reviews: Number(m.total_reviews ?? 0),
        avatar_url: m.avatar_url ?? profile?.avatar_url ?? null,
        services: (m.services ?? []).filter((s) => s.is_active),
      });

      setPortfolio((pRes.data ?? []) as PortfolioItem[]);
      setReviews(
        ((rRes.data ?? []) as unknown as Array<{
          id: string; score: number; comment: string | null; created_at: string;
          reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
        }>).map((r) => {
          const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
          return {
            id: r.id,
            score: r.score,
            comment: r.comment,
            created_at: r.created_at,
            reviewer_name: reviewer?.full_name ?? null,
          };
        }),
      );

      // Follow state
      if (userId) {
        const { data: link } = await supabase
          .from('client_master_links')
          .select('master_id')
          .eq('profile_id', userId)
          .eq('master_id', m.id)
          .maybeSingle();
        if (!cancelled) setFollowing(!!link);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params?.id, userId]);

  const toggleFollow = useCallback(async () => {
    if (!master || followBusy) return;
    setFollowBusy(true);
    haptic('selection');
    try {
      const r = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: master.id }),
      });
      if (r.ok) {
        const j = (await r.json()) as { following: boolean };
        setFollowing(j.following);
      }
    } finally {
      setFollowBusy(false);
    }
  }, [master, followBusy, haptic]);

  function pickService(serviceId: string) {
    if (!master) return;
    haptic('light');
    router.push(`/telegram/book?master_id=${master.id}&service_id=${serviceId}${bookSuffix}`);
  }

  function bookGeneric() {
    if (!master) return;
    haptic('light');
    router.push(`/telegram/book?master_id=${master.id}${bookSuffix}`);
  }

  async function share() {
    if (!master) return;
    haptic('light');
    const url = `${window.location.origin}/m/${master.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: master.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="od-client-mini-app" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', minHeight: '100dvh' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--fg-3)' }} />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="od-client-mini-app mc-empty" style={{ minHeight: '60dvh' }}>
        <p className="mc-empty-t">Майстра не знайдено</p>
        <button
          className="mc-result-cta"
          style={{ marginTop: 16 }}
          onClick={() => router.back()}
        >
          {t.back}
        </button>
      </div>
    );
  }

  const minPrice = master.services.reduce<number | null>(
    (acc, s) => (acc == null || s.price < acc ? s.price : acc),
    null,
  );
  const currency = master.services[0]?.currency ?? 'UAH';

  return (
    <div className="od-client-mini-app">
      {/* Cover */}
      <div className="mc-mcov">
        <button
          className="mc-mcov-back"
          onClick={() => { haptic('light'); router.back(); }}
          aria-label={t.back}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>
        <div className="mc-mcov-acts">
          <button
            className={`mc-mcov-act ${following ? 'on' : ''}`}
            onClick={toggleFollow}
            disabled={followBusy}
            aria-label="Like"
          >
            <Heart size={16} strokeWidth={2} fill={following ? 'currentColor' : 'none'} />
          </button>
          <button
            className="mc-mcov-act"
            onClick={share}
            aria-label="Share"
          >
            <Share2 size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="mc-mav">
          {master.avatar_url
            ? <img src={master.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : initialsOf(master.name)}
        </div>
      </div>

      {/* Identity */}
      <div className="mc-mid">
        <div className="mc-mid-n">{master.name}</div>
        {master.specialization && (
          <div className="mc-mid-s">{master.specialization}</div>
        )}
        <div className="mc-mid-m">
          {master.rating > 0 && (
            <span>
              <Star size={13} className="star" />
              <b style={{ color: 'var(--fg)' }}>{master.rating.toFixed(1)}</b>
              {master.total_reviews > 0 ? ` · ${master.total_reviews} ${t.reviewsShort}` : ''}
            </span>
          )}
          {master.city && (
            <>
              <span style={{ color: 'var(--fg-3)' }}>·</span>
              <span><MapPin size={13} style={{ color: 'var(--fg-3)', fill: 'none' }} /> {master.city}</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mc-mtabs">
        {(['services', 'portfolio', 'reviews', 'about'] as const).map((k) => (
          <button
            key={k}
            className={`mc-mtab ${tab === k ? 'active' : ''}`}
            onClick={() => { setTab(k); haptic('selection'); }}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'services' && (
        <div className="mc-msvc">
          {master.services.length === 0 ? (
            <div className="mc-msvc-empty">{t.noServices}</div>
          ) : (
            master.services.map((s) => (
              <div
                key={s.id}
                className="mc-svc"
                onClick={() => pickService(s.id)}
                role="button"
                tabIndex={0}
              >
                <div className="mc-svc-i">
                  <div className="mc-svc-n">{s.name}</div>
                  <div className="mc-svc-d">{s.duration_minutes} {t.min}</div>
                </div>
                <div className="mc-svc-p">
                  {s.currency === 'UAH' ? '₴' : s.currency}{Math.round(s.price)}
                </div>
                <button className="mc-svc-b" onClick={(e) => { e.stopPropagation(); pickService(s.id); }}>
                  {t.pickCta}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'portfolio' && (
        <div className="mc-mport">
          {portfolio.length === 0 ? (
            <div className="mc-msvc-empty">{t.noPortfolio}</div>
          ) : (
            <div className="mc-mport-grid">
              {portfolio.map((p) => (
                <div key={p.id} className="mc-mport-item">
                  <img src={p.image_url} alt={p.caption ?? ''} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="mc-mrev">
          {reviews.length === 0 ? (
            <div className="mc-msvc-empty">{t.noReviews}</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="mc-mrev-row">
                <div className="mc-mrev-head">
                  <span className="mc-mrev-name">{r.reviewer_name ?? '—'}</span>
                  <span className="mc-mrev-score">
                    <Star size={12} className="star" /> {r.score}
                  </span>
                </div>
                {r.comment && <p className="mc-mrev-c">{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'about' && (
        <div className="mc-mabout">
          {master.bio ? (
            <p>{master.bio}</p>
          ) : (
            <div className="mc-msvc-empty">{t.noAbout}</div>
          )}
          {master.address && (
            <div className="mc-mabout-row">
              <MapPin size={14} /> {master.address}
            </div>
          )}
        </div>
      )}

      {/* Bottom CTA card */}
      <div className="mc-mbook">
        <div className="mc-mbook-row">
          <Zap size={13} /> {t.freeToday}
        </div>
        {master.address && (
          <div className="mc-mbook-row">
            <MapPin size={13} /> {master.address}
          </div>
        )}
        <button className="mc-mbook-cta" onClick={bookGeneric}>
          <CalendarPlus size={16} />
          {minPrice != null ? t.bookFromCta(minPrice, currency) : (lang === 'uk' ? 'Записатись' : lang === 'ru' ? 'Записаться' : 'Book')}
        </button>
      </div>

      <div style={{ height: 16 }} />
    </div>
  );
}
