/** --- YAML
 * name: MasterMiniAppMarketing (placeholder)
 * description: Placeholder для маркетинга — рассылки, акции, промокоды.
 *              Полноценная Mini App-версия в разработке (отдельный спринт).
 *              Раньше пункт «Маркетинг» в /more открывал /ru/marketing во
 *              внешнем браузере — Данил попросил убрать переход на хром,
 *              всё в Mini App. Этот экран показывает что в работе и
 *              перечисляет что будет.
 * created: 2026-05-08
 * --- */

'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Megaphone, Send, Tag, Ticket, Sparkles, ChevronRight } from 'lucide-react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { useTelegram } from '@/components/miniapp/telegram-provider';

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string;
  inWorks: string; inWorksHint: string;
  broadcasts: string; broadcastsHint: string;
  deals: string; dealsHint: string;
  promo: string; promoHint: string;
  reviews: string; reviewsHint: string;
}> = {
  uk: {
    title: 'Маркетинг', subtitle: 'Розсилки, акції, промокоди',
    inWorks: 'Скоро у Mini App',
    inWorksHint: 'Готуємо нативний редактор. Поки що повні налаштування — у веб-кабінеті cres-ca.com',
    broadcasts: 'Розсилки', broadcastsHint: 'Шаблони + сегменти клієнтів',
    deals: 'Акції', dealsHint: 'Скидки, бонуси, абонементи',
    promo: 'Промокоди', promoHint: 'Унікальні коди для клієнтів',
    reviews: 'Відгуки', reviewsHint: 'Запити після візиту',
  },
  ru: {
    title: 'Маркетинг', subtitle: 'Рассылки, акции, промокоды',
    inWorks: 'Скоро в Mini App',
    inWorksHint: 'Готовим нативный редактор. Пока полные настройки — в веб-кабинете cres-ca.com',
    broadcasts: 'Рассылки', broadcastsHint: 'Шаблоны + сегменты клиентов',
    deals: 'Акции', dealsHint: 'Скидки, бонусы, абонементы',
    promo: 'Промокоды', promoHint: 'Уникальные коды для клиентов',
    reviews: 'Отзывы', reviewsHint: 'Запросы после визита',
  },
  en: {
    title: 'Marketing', subtitle: 'Broadcasts, deals, promo codes',
    inWorks: 'Coming to Mini App',
    inWorksHint: 'Native editor in the works. For now, full settings are in the web dashboard cres-ca.com',
    broadcasts: 'Broadcasts', broadcastsHint: 'Templates + client segments',
    deals: 'Deals', dealsHint: 'Discounts, bonuses, memberships',
    promo: 'Promo codes', promoHint: 'Unique codes for clients',
    reviews: 'Reviews', reviewsHint: 'Requests after visits',
  },
};

export default function MasterMiniAppMarketing() {
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const { haptic } = useTelegram();
  const router = useRouter();

  // Внутри Mini App — навигация router.push на нативную подстраницу.
  // Никаких openLink (это бы вышло в Chrome).
  function goTo(tab: 'broadcasts' | 'deals' | 'promo' | 'reviews') {
    haptic('selection');
    router.push(`/telegram/m/marketing/${tab}`);
  }

  const sections: Array<{ icon: typeof Send; title: string; hint: string; tab: 'broadcasts' | 'deals' | 'promo' | 'reviews' }> = [
    { icon: Send, title: t.broadcasts, hint: t.broadcastsHint, tab: 'broadcasts' },
    { icon: Tag, title: t.deals, hint: t.dealsHint, tab: 'deals' },
    { icon: Ticket, title: t.promo, hint: t.promoHint, tab: 'promo' },
    { icon: Sparkles, title: t.reviews, hint: t.reviewsHint, tab: 'reviews' },
  ];

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <PageHeader title={t.title} subtitle={t.subtitle} />

        {/* In-works hero */}
        <div
          style={{
            margin: `0 ${PAGE_PADDING_X}px`,
            padding: 20,
            borderRadius: R.lg,
            background: `linear-gradient(135deg, ${T.gradientFrom}20, ${T.gradientTo}20)`,
            border: `1px solid ${T.borderSubtle}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 12,
            boxShadow: SHADOW.card,
          }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: 18,
              background: `linear-gradient(135deg, ${T.gradientFrom}, ${T.gradientTo})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Megaphone size={26} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <p style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{t.inWorks}</p>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '4px 0 0', maxWidth: 320 }}>{t.inWorksHint}</p>
          </div>
        </div>

        {/* Что будет внутри */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: `0 ${PAGE_PADDING_X}px` }}>
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                type="button"
                key={i}
                onClick={() => goTo(s.tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  borderRadius: R.md,
                  border: `1px solid ${T.borderSubtle}`,
                  background: T.surface,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Icon size={22} strokeWidth={1.8} color={T.textSecondary} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: 12, color: T.textTertiary, margin: '2px 0 0' }}>{s.hint}</p>
                </div>
                <ChevronRight size={16} color={T.textTertiary} />
              </button>
            );
          })}
        </div>
      </motion.div>
    </MobilePage>
  );
}
