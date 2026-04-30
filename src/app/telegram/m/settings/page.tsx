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
  User as UserIcon,
  Scissors,
  CalendarCheck,
  CreditCard,
  Bell,
  Globe,
  Mic,
  HelpCircle,
  MessageCircle,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { T, R, FONT_BASE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

interface SettingsItem {
  key: string;
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ITEMS: SettingsItem[] = [
  { key: 'profile',       href: '/telegram/m/profile',                 label: 'Профиль и портфолио',  Icon: UserIcon },
  { key: 'services',      href: '/telegram/m/settings/services',       label: 'Услуги и цены',         Icon: Scissors },
  { key: 'schedule',      href: '/telegram/m/settings/schedule',       label: 'График работы',        Icon: CalendarCheck },
  { key: 'billing',       href: '/telegram/m/settings/billing',        label: 'Тариф и платежи',      Icon: CreditCard },
  { key: 'notifications', href: '/telegram/m/settings/notifications',  label: 'Уведомления',           Icon: Bell },
  { key: 'language',      href: '/telegram/m/settings/language',       label: 'Язык',                  Icon: Globe },
  { key: 'voice',         href: '/telegram/m/voice-assistant',         label: 'Голосовой помощник',    Icon: Mic },
  { key: 'help',          href: '/telegram/m/settings/help',           label: 'Помощь',                Icon: HelpCircle },
  { key: 'feedback',      href: '/telegram/m/settings/feedback',       label: 'Обратная связь',        Icon: MessageCircle },
];

export default function MasterMiniAppSettings() {
  const { haptic } = useTelegram();
  const router = useRouter();
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
          aria-label="Назад"
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
                  {item.label}
                </span>
                <ChevronRight size={16} color={T.textTertiary} strokeWidth={2} />
              </Link>
            );
          })}
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
            Действия с учётной записью
          </div>
          Экспорт данных и удаление учётной записи доступны в веб-версии:&nbsp;
          <a
            href="https://cres-ca.com/ru/settings"
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
          {loggingOut ? 'Выходим…' : 'Выйти'}
        </button>
      </div>
    </div>
  );
}
