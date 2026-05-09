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

const I18N: Record<MiniAppLang, { title: string; subtitle: string; empty: string; anon: string }> = {
  uk: { title: 'Відгуки', subtitle: 'Що клієнти кажуть про вас', empty: 'Відгуків ще немає.', anon: 'Анонімно' },
  ru: { title: 'Отзывы', subtitle: 'Что клиенты говорят о вас', empty: 'Отзывов пока нет.', anon: 'Аноним' },
  en: { title: 'Reviews', subtitle: 'What clients say about you', empty: 'No reviews yet.', anon: 'Anonymous' },
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

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Loader2 className="mx-auto my-8 size-5 animate-spin" color={T.textTertiary} />
        ) : items.length === 0 ? (
          <div style={{ padding: 24, borderRadius: R.md, border: `1px dashed ${T.border}`, textAlign: 'center' }}>
            <Star size={20} color={T.textTertiary} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: T.textTertiary, margin: 0 }}>{t.empty}</p>
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
