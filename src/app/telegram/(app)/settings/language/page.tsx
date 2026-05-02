/** --- YAML
 * name: ClientMiniAppSettings/Language
 * description: Выбор UI-языка для клиента. Пишет в profiles.ui_language через
 *              /api/me/ui-prefs и cookie NEXT_LOCALE для немедленного применения
 *              на web. Также сохраняет в localStorage cres:locale.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

type Lang = 'uk' | 'ru' | 'en';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function ClientLanguagePage() {
  const { haptic } = useTelegram();
  const [current, setCurrent] = useState<Lang>('uk');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cres:locale') as Lang | null;
      if (stored && ['uk', 'ru', 'en'].includes(stored)) setCurrent(stored);
    } catch {}
    fetch('/api/me/ui-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ui_language?: Lang } | null) => {
        if (data?.ui_language) setCurrent(data.ui_language);
      })
      .catch(() => {});
  }, []);

  async function pick(code: Lang) {
    if (code === current || busy) return;
    haptic('selection');
    setBusy(true);
    setCurrent(code);
    try {
      await fetch('/api/me/ui-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_language: code }),
      });
    } catch {}
    try { localStorage.setItem('cres:locale', code); } catch {}
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
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
      <Link
        href="/telegram/settings"
        onClick={() => haptic('light')}
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
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} strokeWidth={2.4} />
        Назад
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
        Язык
      </h1>
      <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6 }}>
        Синхронизируется с веб-кабинетом
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
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: T.text,
                opacity: busy ? 0.6 : 1,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 22 }}>{l.flag}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{l.label}</span>
              {current === l.code && <Check size={16} color={T.accent} strokeWidth={2.5} />}
            </button>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 11, color: T.textTertiary, marginTop: 12, paddingLeft: 8 }}>
        Влияет на язык интерфейса в Mini App и веб-кабинете.
      </p>
    </motion.div>
  );
}
