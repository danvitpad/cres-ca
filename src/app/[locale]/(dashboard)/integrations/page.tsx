/** --- YAML
 * name: IntegrationsPage
 * description: Real integrations list — live connection state for Telegram, Voice AI, Email, Payments, Referrals, Google Calendar. Renames /addons → /integrations.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Plug, MessageCircle, Mic, Mail, CreditCard, Gift, Calendar as CalendarIcon,
  CheckCircle2, Circle, Settings, ExternalLink,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';

type ConnStatus = 'connected' | 'available' | 'planned';

interface Integration {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  status: ConnStatus;
  hint?: string;
  settingsHref?: string;
  docsHref?: string;
}

const STATUS_META: Record<ConnStatus, { label: string }> = {
  connected: { label: 'Подключено' },
  available: { label: 'Доступно' },
  planned: { label: 'В разработке' },
};

export default function IntegrationsPage() {
  const { C, mounted } = usePageTheme();
  const { master } = useMaster();
  const locale = useLocale();
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user?.id) { setTelegramLinked(false); return; }
      supabase
        .from('profiles')
        .select('telegram_id')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          setTelegramLinked(Boolean((profile as { telegram_id?: number | null } | null)?.telegram_id));
        });
    });
  }, []);

  if (!mounted) return null;

  const referralEnabled = Boolean((master as unknown as Record<string, unknown>)?.client_referral_enabled);

  const integrations: Integration[] = [
    {
      key: 'telegram',
      icon: <MessageCircle size={20} />,
      title: 'Telegram Mini App',
      description: 'Мобильный клиент на базе Telegram — мастер и клиенты используют без установки приложения.',
      status: telegramLinked ? 'connected' : 'available',
      hint: telegramLinked
        ? 'Ваш Telegram привязан к аккаунту'
        : 'Откройте бота и отправьте /start, чтобы привязать',
      settingsHref: '/settings',
    },
    {
      key: 'voice-ai',
      icon: <Mic size={20} />,
      title: 'Голосовой помощник',
      description: 'Запись расходов, клиентов и напоминаний голосом — команда понимает украинский, русский и английский.',
      status: 'connected',
      hint: 'Активен для всех тарифов',
      settingsHref: '/voice-assistant',
    },
    {
      key: 'email',
      icon: <Mail size={20} />,
      title: 'Email-уведомления',
      description: 'Подтверждение записи и напоминания клиентам через Resend. Работает из коробки.',
      status: 'connected',
      hint: 'Отправка через Resend',
      settingsHref: '/settings?section=notifications',
    },
    {
      key: 'liqpay',
      icon: <CreditCard size={20} />,
      title: 'Предоплаты LiqPay',
      description: 'Клиенты оставляют предоплату при онлайн-записи — снижает количество no-show.',
      status: 'available',
      hint: 'Подключение по заявке — напишите в поддержку',
      settingsHref: '/settings',
    },
    {
      key: 'referrals',
      icon: <Gift size={20} />,
      title: 'Программа рекомендаций',
      description: 'Клиенты приводят друзей по вашей персональной ссылке, получают бонус после визита.',
      status: referralEnabled ? 'connected' : 'available',
      hint: referralEnabled ? 'Программа включена' : 'Включите на вкладке Маркетинг → Рекомендации',
      settingsHref: '/marketing?tab=referrals',
    },
    {
      key: 'google-calendar',
      icon: <CalendarIcon size={20} />,
      title: 'Google Calendar sync',
      description: 'Двусторонняя синхронизация записей с личным календарём — планируется.',
      status: 'planned',
      hint: 'Запланировано на Q3',
    },
  ];

  const statusColor = (s: ConnStatus) =>
    s === 'connected' ? { bg: C.successSoft, fg: C.success, border: C.success } :
      s === 'available' ? { bg: C.accentSoft, fg: C.accent, border: C.accent } :
        { bg: C.surfaceElevated, fg: C.textTertiary, border: C.border };

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const availableCount = integrations.filter(i => i.status === 'available').length;

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
      paddingBottom: 96,
      fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Plug size={22} style={{ color: C.accent }} />
          Интеграции
        </h1>
        <p style={{ fontSize: 14, color: C.textTertiary, margin: '6px 0 0', lineHeight: 1.5 }}>
          {connectedCount} подключено · {availableCount} доступно
        </p>
      </div>

      {/* Integration cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {integrations.map((int, i) => {
          const sc = statusColor(int.status);
          const isConnected = int.status === 'connected';
          return (
            <motion.div
              key={int.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 18,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: C.accentSoft, color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {int.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>
                      {int.title}
                    </h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: C.textSecondary, margin: 0, lineHeight: 1.5 }}>
                    {int.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999,
                  background: sc.bg, color: sc.fg,
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.02em',
                }}>
                  {isConnected ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  {STATUS_META[int.status].label}
                </span>
                {int.settingsHref && int.status !== 'planned' && (
                  <Link
                    href={`/${locale}${int.settingsHref}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600, color: C.accent, textDecoration: 'none',
                    }}
                  >
                    {isConnected ? <Settings size={12} /> : <ExternalLink size={12} />}
                    {isConnected ? 'Настроить' : 'Подключить'}
                  </Link>
                )}
              </div>

              {int.hint && (
                <div style={{
                  fontSize: 11.5, color: C.textTertiary, lineHeight: 1.45,
                  paddingTop: 4, borderTop: `1px dashed ${C.border}`,
                }}>
                  {int.hint}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 28,
        padding: '14px 18px',
        background: C.surface,
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        fontSize: 12, color: C.textSecondary,
      }}>
        Нужна интеграция, которой пока нет? Напишите в&nbsp;
        <Link href={`/${locale}/settings`} style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
          поддержку
        </Link>
        &nbsp;— добавим в план.
      </div>
    </div>
  );
}
