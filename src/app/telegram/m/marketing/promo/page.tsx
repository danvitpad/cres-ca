/** --- YAML
 * name: MasterMiniAppMarketing/PromoCodes
 * description: Список промокодов мастера. Native Mini App.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Ticket, Loader2 } from 'lucide-react';
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
  is_active: boolean | null;
  max_uses: number | null;
  uses_count: number | null;
  expires_at: string | null;
}

const I18N: Record<MiniAppLang, { title: string; subtitle: string; empty: string; uses: string; expires: string }> = {
  uk: { title: 'Промокоди', subtitle: 'Унікальні знижки для клієнтів', empty: 'Поки що жодного коду.', uses: 'використано', expires: 'до' },
  ru: { title: 'Промокоды', subtitle: 'Уникальные скидки для клиентов', empty: 'Пока ни одного кода.', uses: 'использовано', expires: 'до' },
  en: { title: 'Promo codes', subtitle: 'Unique discounts for clients', empty: 'No codes yet.', uses: 'used', expires: 'until' },
};

export default function PromoPage() {
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
        .select('id, code, discount_percent, discount_amount, is_active, max_uses, uses_count, expires_at')
        .eq('master_id', master.id)
        .order('is_active', { ascending: false })
        .order('expires_at', { ascending: false })
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
            <Ticket size={20} color={T.textTertiary} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: T.textTertiary, margin: 0 }}>{t.empty}</p>
          </div>
        ) : (
          items.map((p) => {
            const discount = p.discount_percent != null ? `−${p.discount_percent}%` : p.discount_amount != null ? `−${p.discount_amount}₴` : '—';
            const usesLine = `${p.uses_count ?? 0}${p.max_uses ? ` / ${p.max_uses}` : ''} ${t.uses}`;
            return (
              <div key={p.id} style={{
                padding: 14, borderRadius: R.md,
                border: `1px solid ${T.borderSubtle}`,
                background: T.surface,
                opacity: p.is_active ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, fontFamily: 'monospace', letterSpacing: 0.5 }}>{p.code}</p>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>{discount}</span>
                </div>
                <p style={{ fontSize: 11, color: T.textTertiary, margin: '4px 0 0' }}>
                  {usesLine}
                  {p.expires_at ? ` · ${t.expires} ${new Date(p.expires_at).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU')}` : ''}
                </p>
              </div>
            );
          })
        )}
      </div>
    </MobilePage>
  );
}
