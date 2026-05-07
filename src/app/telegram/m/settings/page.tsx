/** --- YAML
 * name: MasterMiniAppSettings
 * description: Mini App master settings — theme-aware (light/dark via miniapp
 *   design tokens), Apple-style list of sections + bottom logout. Fixed:
 *   was using raw bg-white that broke in dark mode; logout now has timeout
 *   fallback so it never hangs the UI even if auth.signOut stalls.
 * created: 2026-04-19
 * updated: 2026-04-29
 * --- */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  CreditCard,
  Bell,
  Globe,
  HelpCircle,
  MessageCircle,
  Moon,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppTheme } from '@/components/miniapp/theme';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  back: string;
  profile: string; services: string; schedule: string; billing: string;
  notifications: string; language: string; voice: string; help: string; feedback: string;
  themeDark: string; themeManual: string; themeAsTelegram: string;
  accountSection: string; accountHint: string;
  loggingOut: string; logout: string;
}> = {
  uk: {
    back: 'Назад',
    profile: 'Профіль та портфоліо', services: 'Послуги та ціни', schedule: 'Графік роботи',
    billing: 'Тариф та платежі', notifications: 'Сповіщення', language: 'Мова',
    voice: 'Голосовий помічник', help: 'Допомога', feedback: 'Зворотний зв’язок',
    themeDark: 'Темна тема', themeManual: 'Вручну', themeAsTelegram: 'Як в Telegram',
    accountSection: 'Дії з обліковим записом',
    accountHint: 'Експорт даних та видалення облікового запису доступні у веб-версії:',
    loggingOut: 'Виходимо…', logout: 'Вийти',
  },
  ru: {
    back: 'Назад',
    profile: 'Профиль и портфолио', services: 'Услуги и цены', schedule: 'График работы',
    billing: 'Тариф и платежи', notifications: 'Уведомления', language: 'Язык',
    voice: 'Голосовой помощник', help: 'Помощь', feedback: 'Обратная связь',
    themeDark: 'Тёмная тема', themeManual: 'Вручную', themeAsTelegram: 'Как в Telegram',
    accountSection: 'Действия с учётной записью',
    accountHint: 'Экспорт данных и удаление учётной записи доступны в веб-версии:',
    loggingOut: 'Выходим…', logout: 'Выйти',
  },
  en: {
    back: 'Back',
    profile: 'Profile & portfolio', services: 'Services & prices', schedule: 'Schedule',
    billing: 'Plan & billing', notifications: 'Notifications', language: 'Language',
    voice: 'Voice assistant', help: 'Help', feedback: 'Feedback',
    themeDark: 'Dark theme', themeManual: 'Manual', themeAsTelegram: 'Match Telegram',
    accountSection: 'Account actions',
    accountHint: 'Data export and account deletion are available in the web version:',
    loggingOut: 'Signing out…', logout: 'Sign out',
  },
};

interface SettingsItem {
  key: string;
  href: string;
  labelKey: keyof typeof I18N['ru'];
  Icon: LucideIcon;
}

// Настройки — только то что не получило отдельного слота в нижней навигации.
// Профиль / Услуги / Голос убраны:
//   • Профиль открывается по аватару справа сверху на любом табе.
//   • Услуги стали отдельным табом (4-й слот) — /telegram/m/services.
//   • Голос идёт через TG-бот, отдельной страницы в Mini App больше нет.
const ITEMS: SettingsItem[] = [
  { key: 'schedule',      href: '/telegram/m/settings/schedule',       labelKey: 'schedule',      Icon: CalendarCheck },
  { key: 'billing',       href: '/telegram/m/settings/billing',        labelKey: 'billing',       Icon: CreditCard },
  { key: 'notifications', href: '/telegram/m/settings/notifications',  labelKey: 'notifications', Icon: Bell },
  { key: 'language',      href: '/telegram/m/settings/language',       labelKey: 'language',      Icon: Globe },
  { key: 'help',          href: '/telegram/m/settings/help',           labelKey: 'help',          Icon: HelpCircle },
  { key: 'feedback',      href: '/telegram/m/settings/feedback',       labelKey: 'feedback',      Icon: MessageCircle },
];

export default function MasterMiniAppSettings() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { theme, override, setOverride } = useMiniAppTheme();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    haptic('warning');

    // Always navigate even if signOut() hangs (TG WebView occasionally stalls
    // on auth requests). Race against a 1.5s timeout.
    // Navigate FIRST — full page replace kills the React tree, so the layout's
    // "!userId → router.replace('/telegram')" effect never fires.
    // clearAuth() is intentionally omitted: the store re-initialises from scratch
    // on the new page. signOut is fire-and-forget (TG WebView can stall auth).
    try { createClient().auth.signOut(); } catch { /* ignore */ }
    // Keep cres:tg so /telegram/welcome can render without bouncing through /telegram
    // (which would re-auth via initData and bring the user straight back to home).
    window.location.replace('/telegram/welcome');
  }

  return (
    <div
      style={{
        ...FONT_BASE,
        minHeight: '100dvh',
        background: T.bg,
        color: T.text,
      }}
    >
      <div style={{ padding: `16px ${PAGE_PADDING_X}px 32px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => { haptic('light'); router.back(); }}
          aria-label={t.back}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: SHADOW.card,
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>

        {/* Settings list */}
        <div
          style={{
            background: T.surface,
            borderRadius: R.lg,
            border: `1px solid ${T.borderSubtle}`,
            boxShadow: SHADOW.card,
            overflow: 'hidden',
          }}
        >
          {ITEMS.map((item, idx) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => haptic('light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderTop: idx === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                  textDecoration: 'none',
                  color: T.text,
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.12s',
                }}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = T.bgSubtle;
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }}
                onPointerLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
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
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.text }}>
                  {t[item.labelKey]}
                </span>
                <ChevronRight size={16} color={T.textTertiary} strokeWidth={2} />
              </Link>
            );
          })}
        </div>

        {/* Theme toggle */}
        <div
          style={{
            background: T.surface,
            borderRadius: R.lg,
            border: `1px solid ${T.borderSubtle}`,
            boxShadow: SHADOW.card,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => { haptic('light'); setOverride(theme === 'dark' ? 'light' : 'dark'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: T.text,
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
              <Moon size={18} strokeWidth={2} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: T.text }}>{t.themeDark}</span>
              <span style={{ display: 'block', fontSize: 12, color: T.textTertiary, marginTop: 1 }}>
                {override ? t.themeManual : t.themeAsTelegram}
              </span>
            </span>
            <MiniToggle on={theme === 'dark'} />
          </button>
        </div>

        {/* Web-only actions notice */}
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.borderSubtle}`,
            borderRadius: R.lg,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.5,
            color: T.textSecondary,
            boxShadow: SHADOW.card,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            {t.accountSection}
          </div>
          {t.accountHint}&nbsp;
          <a
            href={`https://cres-ca.com/${lang}/settings`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.accent, fontWeight: 500, textDecoration: 'none' }}
          >
            cres-ca.com/settings
          </a>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '14px 16px',
            borderRadius: R.lg,
            border: `1px solid ${T.dangerSoft}`,
            background: T.dangerSoft,
            color: T.danger,
            fontSize: 14,
            fontWeight: 600,
            cursor: loggingOut ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: loggingOut ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loggingOut
            ? <Loader2 size={16} className="animate-spin" />
            : <LogOut size={16} strokeWidth={2.4} />
          }
          {loggingOut ? t.loggingOut : t.logout}
        </button>
      </div>
    </div>
  );
}

function MiniToggle({ on }: { on: boolean }) {
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
