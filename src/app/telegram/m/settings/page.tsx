/** --- YAML
 * name: MasterMiniAppSettings
 * description: Mini App master settings — Apple-style list of sections (profile edit, services, schedule, tariff & payments, notifications, language, voice AI, help, logout). Opens from gear icon on /telegram/m/profile.
 * created: 2026-04-19
 * updated: 2026-04-19
 * --- */

'use client';

import Link from 'next/link';
import {
  UserCircle,
  Scissors,
  CalendarCheck,
  CreditCard,
  Bell,
  Globe,
  Microphone,
  Question,
  SignOut,
  CaretRight,
  ChartLineUp,
} from '@phosphor-icons/react';
import type { IconWeight } from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

// Only paths that actually exist (all 404s swapped out).
// Mobile-adapted Mini App pages preferred; web /ru pages marked with a "🖥" indicator.
interface SettingsItem {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; weight?: IconWeight; className?: string }>;
  isWeb?: boolean;
}
const ITEMS: SettingsItem[] = [
  { key: 'profile', href: '/telegram/m/profile', label: 'Профиль и портфолио', icon: UserCircle },
  { key: 'services', href: '/ru/services', label: 'Услуги и цены', icon: Scissors, isWeb: true },
  { key: 'schedule', href: '/ru/settings', label: 'График работы', icon: CalendarCheck, isWeb: true },
  { key: 'finance', href: '/telegram/m/stats', label: 'Финансы', icon: ChartLineUp },
  { key: 'billing', href: '/ru/settings/billing', label: 'Тариф и платежи', icon: CreditCard, isWeb: true },
  { key: 'notifications', href: '/telegram/notifications', label: 'Уведомления', icon: Bell },
  { key: 'voice', href: '/telegram/m/voice-assistant', label: 'Голосовой помощник', icon: Microphone },
  { key: 'help', href: '/ru/settings/faq', label: 'Помощь и поддержка', icon: Question, isWeb: true },
  { key: 'feedback', href: '/ru/settings/feedback', label: 'Обратная связь', icon: Globe, isWeb: true },
];

export default function MasterMiniAppSettings() {
  const { haptic } = useTelegram();
  const { clearAuth } = useAuthStore();

  async function logout() {
    haptic('warning');
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    window.location.href = '/telegram';
  }

  return (
    <div className="space-y-6 px-5 pt-6 pb-10">
      <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={() => haptic('light')}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.06] transition-colors"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70">
                  <Icon size={18} weight="regular" />
                </div>
                <span className="flex-1 text-[14px] font-medium">{item.label}</span>
                {item.isWeb && (
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/40">
                    web
                  </span>
                )}
                <CaretRight size={14} className="text-white/30" />
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3.5 text-[14px] font-semibold text-rose-300 active:bg-rose-500/20 transition-colors"
      >
        <SignOut size={16} weight="bold" /> Выйти
      </button>
    </div>
  );
}
