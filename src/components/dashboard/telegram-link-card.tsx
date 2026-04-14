/** --- YAML
 * name: TelegramLinkCard
 * description: Карточка «Подключи Telegram» в dashboard overview. Показывается когда у профиля мастера не задан telegram_id. Генерит одноразовый deeplink через /api/telegram/link/init и открывает t.me — после /start linkmaster_<token> webhook пишет telegram_id.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface Props {
  theme: 'light' | 'dark';
}

export function TelegramLinkCard({ theme }: Props) {
  const t = useTranslations('dashboard.telegramLink');
  const { userId } = useAuthStore();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('profiles').select('telegram_id').eq('id', userId).single();
      setLinked(!!data?.telegram_id);
    })();
  }, [userId]);

  const handleConnect = async () => {
    setLoadingLink(true);
    try {
      const res = await fetch('/api/telegram/link/init', { method: 'POST' });
      const j = await res.json();
      if (j?.deeplink) {
        window.open(j.deeplink, '_blank');
      }
    } finally {
      setLoadingLink(false);
    }
  };

  if (linked === null || linked === true) return null;

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#181818' : '#ffffff';
  const border = isDark ? '0.8px solid #333' : '0.8px solid #e0e0e0';
  const text = isDark ? '#f5f5f5' : '#0d0d0d';
  const textMuted = isDark ? '#a3a3a3' : '#737373';
  const tgBlue = '#229ED9';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{
          gridColumn: '1 / -1',
          backgroundColor: cardBg,
          border,
          borderRadius: 16,
          padding: 20,
          fontFamily: FONT,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            minWidth: 48,
            borderRadius: 12,
            backgroundColor: tgBlue,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.643.135-.953l11.566-4.458c.538-.196 1.006.128.832.938z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 2 }}>{t('title')}</div>
          <div style={{ fontSize: 13, color: textMuted }}>{t('subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={handleConnect}
          disabled={loadingLink}
          style={{
            border: 'none',
            backgroundColor: tgBlue,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            opacity: loadingLink ? 0.6 : 1,
            fontFamily: FONT,
          }}
        >
          {loadingLink ? t('connecting') : t('connect')}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
