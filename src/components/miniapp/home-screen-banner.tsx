/** --- YAML
 * name: HomeScreenBanner
 * description: >
 *   One-shot banner prompting Telegram users to add the Mini App to their
 *   home screen. Shown only when TG.checkHomeScreenStatus === 'missed' and
 *   the user hasn't dismissed before (localStorage cres:hsp).
 *   Calls TG.addToHomeScreen() on confirm. Hides itself on dismiss.
 * created: 2026-05-09
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { tg, isTelegram } from '@/lib/telegram/webapp';
import { T, R, TYPE } from '@/components/miniapp/design';

const STORAGE_KEY = 'cres:hsp'; // home screen prompt dismissed

const I18N = {
  uk: { text: 'Додай на головний екран — одне торкання і ти тут', add: 'Додати' },
  ru: { text: 'Добавь на главный экран — один тап и ты здесь', add: 'Добавить' },
  en: { text: 'Add to home screen — one tap and you\'re here', add: 'Add' },
};

type Lang = 'uk' | 'ru' | 'en';

function getLang(): Lang {
  try {
    const s = localStorage.getItem('cres:locale') as Lang | null;
    if (s && ['uk', 'ru', 'en'].includes(s)) return s;
  } catch {}
  return 'uk';
}

export function HomeScreenBanner() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<Lang>('uk');

  useEffect(() => {
    if (!isTelegram()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    setLang(getLang());

    const webapp = tg();
    if (!webapp?.checkHomeScreenStatus) return;
    webapp.checkHomeScreenStatus((status: string) => {
      if (status === 'missed') setVisible(true);
    });
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }

  function addToHome() {
    tg()?.addToHomeScreen();
    dismiss();
  }

  if (!visible) return null;

  const t = I18N[lang];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: R.md,
        background: T.accentSoft,
        border: `1px solid ${T.accent}22`,
        marginBottom: 4,
      }}
    >
      <Smartphone size={16} style={{ color: T.accent, flexShrink: 0 }} />
      <p style={{ ...TYPE.caption, color: T.accent, flex: 1, margin: 0 }}>
        {t.text}
      </p>
      <button
        onClick={addToHome}
        style={{
          background: T.accent,
          color: '#fff',
          border: 'none',
          borderRadius: R.sm,
          padding: '4px 10px',
          ...TYPE.micro,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {t.add}
      </button>
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: T.accent, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
