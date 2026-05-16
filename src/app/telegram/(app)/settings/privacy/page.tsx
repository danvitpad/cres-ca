/** --- YAML
 * name: ClientMiniAppSettings/Privacy
 * description: Управление приватностью клиента — кто видит профиль, история визитов,
 *              рейтинги, может ли мастер делиться его данными с командой.
 *              Сохраняется в profiles.privacy_* через /api/me/privacy.
 * created: 2026-05-02
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, History, Star, Users, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

interface PrivacyState {
  profile_visible: boolean;       // профиль виден другим клиентам / мастерам
  show_visit_history: boolean;    // показывать историю визитов мастеру
  show_in_reviews: boolean;       // публиковать имя в отзывах
  share_with_team: boolean;       // мастер может делиться картой клиента с командой
}

const DEFAULTS: PrivacyState = {
  profile_visible: true,
  show_visit_history: true,
  show_in_reviews: true,
  share_with_team: false,
};

export default function ClientPrivacyPage() {
  const { haptic } = useTelegram();
  const [state, setState] = useState<PrivacyState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me/privacy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        privacy_profile_visible?: boolean;
        privacy_show_visit_history?: boolean;
        privacy_show_in_reviews?: boolean;
        privacy_share_with_team?: boolean;
      } | null) => {
        if (!data) return;
        setState({
          profile_visible:    data.privacy_profile_visible    ?? DEFAULTS.profile_visible,
          show_visit_history: data.privacy_show_visit_history ?? DEFAULTS.show_visit_history,
          show_in_reviews:    data.privacy_show_in_reviews    ?? DEFAULTS.show_in_reviews,
          share_with_team:    data.privacy_share_with_team    ?? DEFAULTS.share_with_team,
        });
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  async function toggle<K extends keyof PrivacyState>(key: K) {
    if (busy || !loaded) return;
    haptic('selection');
    const next = { ...state, [key]: !state[key] };
    setState(next);
    setBusy(true);
    try {
      const apiKey = `privacy_${key}` as string;
      await fetch('/api/me/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [apiKey]: next[key] }),
      });
    } catch { /* tolerant */ }
    setBusy(false);
  }

  const ITEMS: Array<{
    key: keyof PrivacyState;
    Icon: typeof Eye;
    title: string;
    sub: string;
  }> = [
    { key: 'profile_visible',    Icon: Eye,     title: 'Профіль видно',           sub: 'Інші користувачі можуть знайти вас у пошуку' },
    { key: 'show_visit_history', Icon: History, title: 'Історія візитів',         sub: 'Майстер бачить ваші минулі записи' },
    { key: 'show_in_reviews',    Icon: Star,    title: 'Ім\'я у відгуках',        sub: 'Публікувати ім\'я поряд із вашими відгуками' },
    { key: 'share_with_team',    Icon: Users,   title: 'Доступ команди салону',   sub: 'Усі майстри салону бачать вашу картку' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        ...FONT_BASE,
        padding: `16px ${PAGE_PADDING_X}px 16px`,
        background: T.bg,
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
        Приватність
      </h1>
      <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6 }}>
        Керуйте, якими даними ділитися з майстрами і командами
      </p>

      <div
        style={{
          marginTop: 20,
          background: T.surface,
          borderRadius: R.lg,
          border: `1px solid ${T.borderSubtle}`,
          boxShadow: SHADOW.card,
          overflow: 'hidden',
          opacity: loaded ? 1 : 0.5,
        }}
      >
        {ITEMS.map((it, i) => {
          const Icon = it.Icon;
          const on = state[it.key];
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => toggle(it.key)}
              disabled={!loaded || busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '14px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: T.text,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: T.accentSoft,
                  color: T.accent,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{it.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{it.sub}</span>
              </span>
              <Toggle on={on} />
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          background: T.surface,
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: R.lg,
          padding: '14px 16px',
          fontSize: 13,
          lineHeight: 1.6,
          color: T.textSecondary,
          display: 'flex',
          gap: 10,
        }}
      >
        <Shield size={18} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
        <div>
          Повна політика конфіденційності та видалення акаунту доступні у веб-версії:{' '}
          <a
            href="https://cres-ca.com/uk/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.accent, fontWeight: 600, textDecoration: 'none' }}
          >
            cres-ca.com/privacy
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: on ? T.accent : T.borderSubtle,
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}
