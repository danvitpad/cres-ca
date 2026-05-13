/** --- YAML
 * name: MasterMiniAppMarketing/Reviews
 * description: Отзывы о мастере. Native Mini App.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Review {
  id: string;
  score: number | null;
  comment: string | null;
  created_at: string;
  is_anonymous: boolean | null;
  reviewer_id: string | null;
}

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string; empty: string; anon: string;
  avgRating: string; reviewsCount: (n: number) => string;
}> = {
  uk: {
    title: 'Відгуки', subtitle: 'Що клієнти кажуть про вас',
    empty: 'Відгуків ще немає. Вони з\'являться після першого виконаного візиту.',
    anon: 'Анонімно',
    avgRating: 'Середній рейтинг',
    reviewsCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'відгук'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'відгуки' : 'відгуків';
      return `${n} ${w}`;
    },
  },
  ru: {
    title: 'Отзывы', subtitle: 'Что клиенты говорят о вас',
    empty: 'Отзывов пока нет. Они появятся после первого выполненного визита.',
    anon: 'Аноним',
    avgRating: 'Средний рейтинг',
    reviewsCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'отзыв'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'отзыва' : 'отзывов';
      return `${n} ${w}`;
    },
  },
  en: {
    title: 'Reviews', subtitle: 'What clients say about you',
    empty: 'No reviews yet. They will appear after your first completed visit.',
    anon: 'Anonymous',
    avgRating: 'Average rating',
    reviewsCount: (n) => `${n} ${n === 1 ? 'review' : 'reviews'}`,
  },
};

export default function ReviewsPage() {
  const userId = useAuthStore((s) => s.userId);
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled || !master) { setLoading(false); return; }
      const { data } = await supabase
        .from('reviews')
        .select('id, score, comment, created_at, is_anonymous, reviewer_id')
        .eq('target_type', 'master')
        .eq('target_id', master.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setItems((data as Review[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const scored = items.filter((r) => typeof r.score === 'number' && (r.score ?? 0) > 0);
  const avgScore = scored.length > 0
    ? scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length
    : 0;

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Сводка: средний рейтинг + количество отзывов. */}
        {!loading && scored.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: 16, borderRadius: R.md,
            border: `1px solid ${T.borderSubtle}`,
            background: T.surface,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: T.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {avgScore.toFixed(1)}
              </span>
              <div style={{ display: 'flex', gap: 1, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={10}
                    fill={i <= Math.round(avgScore) ? '#fbbf24' : 'none'}
                    color={i <= Math.round(avgScore) ? '#fbbf24' : T.textTertiary}
                  />
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{t.avgRating}</p>
              <p style={{ fontSize: 12, color: T.textTertiary, margin: '2px 0 0' }}>{t.reviewsCount(scored.length)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <Loader2 className="mx-auto my-8 size-5 animate-spin" color={T.textTertiary} />
        ) : items.length === 0 ? (
          <div style={{ padding: 28, borderRadius: R.md, border: `1px dashed ${T.border}`, textAlign: 'center', background: T.surface }}>
            <Star size={22} color={T.textTertiary} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: T.textTertiary, margin: 0, lineHeight: 1.4 }}>{t.empty}</p>
          </div>
        ) : (
          items.map((r) => (
            <div key={r.id} style={{ padding: 14, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} fill={i <= (r.score ?? 0) ? '#fbbf24' : 'none'} color={i <= (r.score ?? 0) ? '#fbbf24' : T.textTertiary} />
                ))}
                <span style={{ fontSize: 11, color: T.textTertiary, marginLeft: 'auto' }}>
                  {new Date(r.created_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}
                </span>
              </div>
              {r.comment ? (
                <p style={{ fontSize: 13, color: T.text, margin: 0, lineHeight: 1.4 }}>{r.comment}</p>
              ) : (
                <p style={{ fontSize: 12, color: T.textTertiary, margin: 0, fontStyle: 'italic' }}>—</p>
              )}
              {r.is_anonymous && (
                <p style={{ fontSize: 10, color: T.textTertiary, margin: '4px 0 0' }}>{t.anon}</p>
              )}
            </div>
          ))
        )}
      </div>
    </MobilePage>
  );
}
