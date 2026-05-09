/** --- YAML
 * name: ClientMiniAppSettings/Language
 * description: Выбор UI-языка для клиента. Пишет в profiles.ui_language через
 *              /api/me/ui-prefs, cookie NEXT_LOCALE и localStorage cres:locale.
 *              После выбора делает hard-navigation обратно на /telegram/settings
 *              чтобы вся Mini App перезагрузилась с новым языком.
 * created: 2026-05-02
 * updated: 2026-05-05
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, setMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const I18N: Record<Lang, { title: string; subtitle: string; back: string; saved: string }> = {
  uk: { title: 'Мова', subtitle: 'Мова інтерфейсу Mini App', back: 'Назад', saved: 'Збережено' },
  ru: { title: 'Язык', subtitle: 'Язык интерфейса Mini App', back: 'Назад', saved: 'Сохранено' },
  en: { title: 'Language', subtitle: 'Mini App interface language', back: 'Back', saved: 'Saved' },
};

export default function ClientLanguagePage() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const lang = useMiniAppLocale();
  const [current, setCurrent] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);

  // Sync current selection with locale once localStorage is read
  useEffect(() => { setCurrent(lang); }, [lang]);

  const t = I18N[current];

  async function pick(code: Lang) {
    if (code === current || busy) return;
    haptic('selection');
    setBusy(true);
    setCurrent(code);

    // Persist + broadcast — все Mini App компоненты через useMiniAppLocale
    // мгновенно перерисуются.
    setMiniAppLocale(code);

    // router.refresh() обновляет server-rendered части (next-intl
    // прочитает новую cookie NEXT_LOCALE) БЕЗ полного reload —
    // остаёмся на странице языка с UI state.
    router.refresh();

    // DB save в фоне — best-effort, не блокирует UI.
    fetch('/api/me/ui-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_language: code }),
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 250));
    setBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        ...FONT_BASE,
        padding: `16px ${PAGE_PADDING_X}px 16px`,
        background: T.bg,
        minHeight: '100dvh',
      }}
    >
      <button
        type="button"
        onClick={() => { haptic('light'); window.history.back(); }}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: R.pill,
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.text,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 16,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <ArrowLeft size={14} strokeWidth={2.4} />
        {t.back}
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
        {t.title}
      </h1>
      <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6 }}>
        {t.subtitle}
      </p>

      <ul
        style={{
          marginTop: 20,
          listStyle: 'none',
          padding: 0,
          background: T.surface,
          borderRadius: R.lg,
          border: `1px solid ${T.borderSubtle}`,
          boxShadow: SHADOW.card,
          overflow: 'hidden',
        }}
      >
        {LANGS.map((l, i) => (
          <li key={l.code}>
            <button
              type="button"
              onClick={() => pick(l.code)}
              disabled={busy}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                color: T.text,
                opacity: busy && current !== l.code ? 0.4 : 1,
                textAlign: 'left',
                transition: 'opacity 0.15s',
              }}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{l.label}</span>
              {current === l.code && (
                busy
                  ? <Loader2 size={16} color={T.accent} className="animate-spin" />
                  : <Check size={16} color={T.accent} strokeWidth={2.5} />
              )}
            </button>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 11, color: T.textTertiary, marginTop: 12, paddingLeft: 8 }}>
        {current === 'uk' && 'Застосовується до Mini App та веб-кабінету.'}
        {current === 'ru' && 'Применяется к Mini App и веб-кабинету.'}
        {current === 'en' && 'Applies to Mini App and web cabinet.'}
      </p>
    </motion.div>
  );
}
