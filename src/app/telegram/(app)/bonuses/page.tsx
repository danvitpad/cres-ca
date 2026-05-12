/** --- YAML
 * name: MiniAppBonusesPage
 * description: Страница бонусов — заморожена решением 2026-05-06.
 *              Per-master loyalty работает в БД (loyalty_balances), но
 *              агрегированный экран «у вас X баллов всего» — не делаем.
 *              Раньше страница рендерила null → если клиент попадал по
 *              прямой ссылке, видел белый экран. Теперь — явный empty-state
 *              чтобы было понятно что раздел в работе.
 * created: 2026-04-19
 * updated: 2026-05-09
 * --- */

'use client';

import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, { title: string; body: string; backHome: string }> = {
  uk: {
    title: 'Бонусна програма скоро',
    body: 'Ми готуємо нову програму лояльності. Бонуси за візити вже накопичуються у ваших майстрів — їх можна буде застосувати в наступних релізах.',
    backHome: 'На головну',
  },
  ru: {
    title: 'Бонусная программа скоро',
    body: 'Готовим новую программу лояльности. Бонусы за визиты уже копятся у ваших мастеров — применить их можно будет в ближайших релизах.',
    backHome: 'На главную',
  },
  en: {
    title: 'Loyalty program soon',
    body: 'We are preparing a new loyalty program. Bonuses are already accumulating with your masters and will be redeemable in upcoming releases.',
    backHome: 'Back to home',
  },
};

export default function MiniAppBonusesPage() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        ...FONT_BASE,
        minHeight: '60dvh',
        padding: `48px ${PAGE_PADDING_X}px`,
        background: T.bg,
        color: T.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: T.accentSoft,
          color: T.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Gift size={26} strokeWidth={2.2} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
        {t.title}
      </h1>
      <p style={{ fontSize: 14, color: T.textSecondary, margin: '10px 0 24px', maxWidth: 320, lineHeight: 1.45 }}>
        {t.body}
      </p>
      <button
        type="button"
        onClick={() => { haptic('light'); router.push('/telegram'); }}
        style={{
          padding: '10px 20px',
          borderRadius: R.pill,
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.text,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t.backHome}
      </button>
    </motion.div>
  );
}
