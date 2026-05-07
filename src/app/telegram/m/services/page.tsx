/** --- YAML
 * name: MasterMiniAppServicesTab
 * description: Услуги мастера как отдельный таб (4-й слот). Read-only список
 *              активных услуг + ссылка на веб-дашборд для добавления/редактирования.
 *              Раньше был re-export из settings/services, но SettingsShell внутри
 *              рендерил кнопку «Назад», которая на табе не нужна — теперь свой
 *              лейаут с PageHeader без back-кнопки.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Scissors, Clock, ArrowUpRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
  color: string | null;
}

const I18N: Record<MiniAppLang, {
  title: string;
  subtitle: (active: number, archived: number) => string;
  empty: string; emptyHint: string;
  add: string; addHint: string;
  minutes: string;
}> = {
  uk: {
    title: 'Послуги і ціни',
    subtitle: (a, ar) => `${a} активних · ${ar} в архіві`,
    empty: 'Поки немає послуг',
    emptyHint: 'Створи послугу у веб-дашборді',
    add: 'Додати / редагувати',
    addHint: 'Редагування цін та послуг — у веб-дашборді.',
    minutes: 'хв',
  },
  ru: {
    title: 'Услуги и цены',
    subtitle: (a, ar) => `${a} активных · ${ar} в архиве`,
    empty: 'Пока нет услуг',
    emptyHint: 'Создай услугу в веб-дашборде',
    add: 'Добавить / редактировать',
    addHint: 'Редактирование цен и услуг — в веб-дашборде.',
    minutes: 'мин',
  },
  en: {
    title: 'Services & prices',
    subtitle: (a, ar) => `${a} active · ${ar} archived`,
    empty: 'No services yet',
    emptyHint: 'Create a service in the web dashboard',
    add: 'Add / edit',
    addHint: 'Editing prices and services — in the web dashboard.',
    minutes: 'min',
  },
};

export default function MasterMiniAppServicesTab() {
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase
        .from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!master) { setLoading(false); return; }
      const { data } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, currency, is_active, color')
        .eq('master_id', master.id)
        .order('name');
      setItems((data as Service[] | null) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const activeCount = items.filter((s) => s.is_active).length;

  return (
    <MobilePage>
      <PageHeader title={t.title} subtitle={loading ? undefined : t.subtitle(activeCount, items.length - activeCount)} />

      <div style={{ padding: `8px ${PAGE_PADDING_X}px 0`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ height: 64, borderRadius: R.md, background: T.bgSubtle }}
              className="animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 28,
              border: `1px dashed ${T.border}`,
              borderRadius: R.md,
              background: T.surface,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44, height: 44, margin: '0 auto', borderRadius: 12,
                background: T.bgSubtle, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Scissors size={20} color={T.textTertiary} />
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: T.text, fontWeight: 600 }}>{t.empty}</p>
            <p style={{ marginTop: 4, fontSize: 11, color: T.textTertiary }}>{t.emptyHint}</p>
          </div>
        ) : (
          items.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: R.md,
                border: `1px solid ${T.borderSubtle}`,
                background: s.is_active ? T.surface : T.bgSubtle,
                opacity: s.is_active ? 1 : 0.6,
                boxShadow: SHADOW.card,
              }}
            >
              <span
                style={{ width: 10, height: 10, borderRadius: 999, background: s.color || T.accent, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: T.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} />
                  {s.duration_minutes} {t.minutes}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                {Number(s.price).toFixed(0)}{' '}
                <span style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary }}>
                  {s.currency === 'UAH' ? '₴' : s.currency}
                </span>
              </p>
            </motion.div>
          ))
        )}

        <Link
          href={`/${lang}/services`}
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 16px',
            borderRadius: R.md,
            border: `1px solid ${T.accent}`,
            background: T.accentSoft,
            color: T.accent,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          {t.add}
          <ArrowUpRight size={13} strokeWidth={2.4} />
        </Link>
        <p style={{ textAlign: 'center', fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
          {t.addHint}
        </p>
      </div>
    </MobilePage>
  );
}
