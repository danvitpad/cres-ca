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
import { Send, Ticket, MessageSquareHeart } from 'lucide-react';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import '@/styles/od-master-marketing.css';

const I18N: Record<MiniAppLang, {
  title: string; subtitle: string;
  broadcasts: string; broadcastsHint: string;
  promo: string; promoHint: string;
  reviews: string; reviewsHint: string;
}> = {
  uk: {
    title: 'Маркетинг', subtitle: 'Розсилки, промокоди, відгуки',
    broadcasts: 'Розсилки', broadcastsHint: 'Повідомлення клієнтам',
    promo: 'Промокоди', promoHint: 'Знижки та акційні коди',
    reviews: 'Відгуки', reviewsHint: 'Що клієнти кажуть про вас',
  },
  ru: {
    title: 'Маркетинг', subtitle: 'Рассылки, промокоды, отзывы',
    broadcasts: 'Рассылки', broadcastsHint: 'Сообщения клиентам',
    promo: 'Промокоды', promoHint: 'Скидки и акционные коды',
    reviews: 'Отзывы', reviewsHint: 'Что клиенты говорят о вас',
  },
  en: {
    title: 'Marketing', subtitle: 'Broadcasts, promo codes, reviews',
    broadcasts: 'Broadcasts', broadcastsHint: 'Messages to clients',
    promo: 'Promo codes', promoHint: 'Discounts and promo codes',
    reviews: 'Reviews', reviewsHint: 'What clients say about you',
  },
};

export default function MasterMiniAppMarketing() {
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const { haptic } = useTelegram();
  const router = useRouter();

  // Внутри Mini App — навигация router.push на нативную подстраницу.
  // Никаких openLink (это бы вышло в Chrome).
  function goTo(tab: 'broadcasts' | 'promo' | 'reviews') {
    haptic('selection');
    router.push(`/telegram/m/marketing/${tab}`);
  }

  // «Акции» убраны 2026-05-13 — концептуально это были те же промокоды
  // (deals/page.tsx читал promo_codes таблицу). Чтобы не путать мастера
  // дублирующей вкладкой, оставили 3 чётких раздела.
  const sections: Array<{ icon: typeof Send; title: string; hint: string; tab: 'broadcasts' | 'promo' | 'reviews' }> = [
    { icon: Send, title: t.broadcasts, hint: t.broadcastsHint, tab: 'broadcasts' },
    { icon: Ticket, title: t.promo, hint: t.promoHint, tab: 'promo' },
    { icon: MessageSquareHeart, title: t.reviews, hint: t.reviewsHint, tab: 'reviews' },
  ];

  return (
    <MobilePage className="od-master-marketing">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <PageHeader title={t.title} subtitle={t.subtitle} />

        {/* Литерально .mkt-grid + .mkt-card из OD master-marketing.html.
            2-колоночная сетка с иконкой в кружке наверху, title + sub
            под ней, опциональным бэйджем. Заменили вертикальный список
            строк на компактные карточки. */}
        <div className="mkt-grid" style={{ padding: `0 ${PAGE_PADDING_X}px` }}>
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                type="button"
                key={i}
                className="mkt-card"
                style={{ ['--i' as 'i']: i } as React.CSSProperties}
                onClick={() => goTo(s.tab)}
              >
                <div className="mc-icon-wrap">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <p className="mc-title">{s.title}</p>
                <p className="mc-sub">{s.hint}</p>
              </button>
            );
          })}
        </div>
      </motion.div>
    </MobilePage>
  );
}
