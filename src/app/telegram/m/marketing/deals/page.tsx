/** --- YAML
 * name: MasterMiniAppMarketing/Deals
 * description: Акции мастера. Поскольку отдельной таблицы deals нет — пока
 *   показываем агрегацию активных промокодов (как разновидность скидок) и
 *   указатель что полноценные акции редактируются в веб-кабинете.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Tag, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Promo {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  expires_at: string | null;
}

const I18N: Record<MiniAppLang, { title: string; subtitle: string; empty: string; hint: string }> = {
  uk: { title: 'Акції', subtitle: 'Активні знижки та бонуси', empty: 'Поки що жодної акції.', hint: 'Активні промокоди — як разновид акції. Повноцінний редактор знижок та абонементів — у веб-кабінеті.' },
  ru: { title: 'Акции', subtitle: 'Активные скидки и бонусы', empty: 'Пока ни одной акции.', hint: 'Активные промокоды — как разновидность акции. Полноценный редактор скидок и абонементов — в веб-кабинете.' },
  en: { title: 'Deals', subtitle: 'Active discounts and bonuses', empty: 'No deals yet.', hint: 'Active promo codes count as deals. Full editor for discounts & memberships — in the web cabinet.' },
};

export default function DealsPage() {
  const userId = useAuthStore((s) => s.userId);
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase.from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (cancelled || !master) { setLoading(false); return; }
      const { data } = await supabase
        .from('promo_codes')
        .select('id, code, discount_percent, discount_amount, expires_at')
        .eq('master_id', master.id)
        .eq('is_active', true)
        .limit(50);
      if (cancelled) return;
      setItems((data as Promo[] | null) ?? []);
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
            <Tag size={20} color={T.textTertiary} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: T.textTertiary, margin: 0 }}>{t.empty}</p>
          </div>
        ) : (
          items.map((p) => {
            const discount = p.discount_percent != null ? `−${p.discount_percent}%` : p.discount_amount != null ? `−${p.discount_amount}₴` : '—';
            return (
              <div key={p.id} style={{ padding: 14, borderRadius: R.md, border: `1px solid ${T.borderSubtle}`, background: T.surface }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0, fontFamily: 'monospace' }}>{p.code}</p>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{discount}</span>
                </div>
                {p.expires_at && (
                  <p style={{ fontSize: 11, color: T.textTertiary, margin: '4px 0 0' }}>
                    до {new Date(p.expires_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}
                  </p>
                )}
              </div>
            );
          })
        )}
        <p style={{ fontSize: 11, color: T.textTertiary, marginTop: 12, padding: `0 4px` }}>{t.hint}</p>
      </div>
    </MobilePage>
  );
}
