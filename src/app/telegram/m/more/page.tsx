/** --- YAML
 * name: MasterMiniAppMoreTab
 * description: Таб «Ещё» — список разделов которые не получили отдельного слота
 *              в нижней навигации. Маркетинг / Партнёры / Расписание / Команда /
 *              Моя публичная страница / AI-чат / Настройки / Выход.
 * created: 2026-05-07
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  Users2,
  Building2,
  Bot,
  Settings as SettingsIcon,
  ChevronRight,
  ArrowUpRight,
  Package,
  Truck,
  MessageSquare,
  Clock,
  Hourglass,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import '@/styles/od-master-settings.css';

interface MoreLinkRaw {
  key: string;
  href: string;
  icon: LucideIcon;
  labelKey: keyof typeof I18N['ru'];
  hintKey: keyof typeof I18N['ru'];
  /** OD цветовая раскраска иконки: cobalt/emerald/amber/danger/info/purple */
  iconColor: 'cobalt' | 'emerald' | 'amber' | 'danger' | 'info' | 'purple';
  /** true → открывать во внешнем браузере (web-страница, не Mini App page). */
  external?: boolean;
}

const I18N: Record<MiniAppLang, {
  title: string;
  marketing: string; marketingHint: string;
  partners: string; partnersHint: string;
  team: string; teamHint: string;
  ai: string; aiHint: string;
  profile: string; profileHint: string;
  settings: string; settingsHint: string;
  queue: string; queueHint: string;
  inventory: string; inventoryHint: string;
  suppliers: string; suppliersHint: string;
  templates: string; templatesHint: string;
  schedule: string; scheduleHint: string;
  waitlist: string; waitlistHint: string;
  logout: string;
  logoutConfirm: string;
}> = {
  uk: {
    title: 'Ще',
    marketing: 'Маркетинг', marketingHint: 'Розсилки, акції, промокоди',
    partners: 'Партнери', partnersHint: 'Реферали та взаємні рекомендації',
    team: 'Команда', teamHint: 'Салон та колеги',
    ai: 'AI-помічник', aiHint: 'Запитай — я відповім',
    profile: 'Профіль', profileHint: 'Ім’я, аватар, тариф',
    settings: 'Налаштування', settingsHint: 'Тариф, сповіщення, мова',
    queue: 'Жива черга', queueHint: 'Walk-in клієнти без запису',
    inventory: 'Склад', inventoryHint: 'Матеріали, залишки, поріг',
    suppliers: 'Постачальники', suppliersHint: 'Контакти, замовлення',
    templates: 'Шаблони', templatesHint: 'Тексти нагадувань, відгуків, ДР',
    schedule: 'Графік роботи', scheduleHint: 'Дні та робочі години',
    waitlist: 'Лист очікування', waitlistHint: 'Клієнти що чекають твоє вікно',
    logout: 'Вийти з акаунта',
    logoutConfirm: 'Точно вийти?',
  },
  ru: {
    title: 'Ещё',
    marketing: 'Маркетинг', marketingHint: 'Рассылки, акции, промокоды',
    partners: 'Партнёры', partnersHint: 'Рефералы и взаимные рекомендации',
    team: 'Команда', teamHint: 'Салон и коллеги',
    ai: 'AI-помощник', aiHint: 'Спроси — отвечу',
    profile: 'Профиль', profileHint: 'Имя, аватар, тариф',
    settings: 'Настройки', settingsHint: 'Тариф, уведомления, язык',
    queue: 'Живая очередь', queueHint: 'Walk-in клиенты без записи',
    inventory: 'Склад', inventoryHint: 'Материалы, остатки, порог',
    suppliers: 'Поставщики', suppliersHint: 'Контакты, заказы',
    templates: 'Шаблоны', templatesHint: 'Тексты напоминаний, отзывов, ДР',
    schedule: 'График работы', scheduleHint: 'Дни и рабочие часы',
    waitlist: 'Лист ожидания', waitlistHint: 'Клиенты что ждут твоё окошко',
    logout: 'Выйти из аккаунта',
    logoutConfirm: 'Точно выйти?',
  },
  en: {
    title: 'More',
    marketing: 'Marketing', marketingHint: 'Broadcasts, deals, promo codes',
    partners: 'Partners', partnersHint: 'Referrals and mutual recommendations',
    team: 'Team', teamHint: 'Salon and colleagues',
    ai: 'AI assistant', aiHint: 'Ask — I’ll answer',
    profile: 'Profile', profileHint: 'Name, avatar, plan',
    settings: 'Settings', settingsHint: 'Plan, notifications, language',
    queue: 'Live queue', queueHint: 'Walk-in clients without appointment',
    inventory: 'Inventory', inventoryHint: 'Materials, stock, low threshold',
    suppliers: 'Suppliers', suppliersHint: 'Contacts, orders',
    templates: 'Templates', templatesHint: 'Reminder, review, birthday texts',
    schedule: 'Schedule', scheduleHint: 'Days and working hours',
    waitlist: 'Waitlist', waitlistHint: 'Clients waiting for your slot',
    logout: 'Log out',
    logoutConfirm: 'Log out?',
  },
};

export default function MasterMiniAppMore() {
  const { haptic } = useTelegram();
  const router = useRouter();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    if (typeof window !== 'undefined' && !window.confirm(t.logoutConfirm)) return;
    setLoggingOut(true);
    haptic('warning');
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch { /* best-effort */ }
    useAuthStore.getState().clearAuth();
    router.replace('/telegram');
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: member } = await supabase
        .from('salon_members')
        .select('salon_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .maybeSingle<{ salon_id: string }>();
      if (cancelled) return;
      if (member?.salon_id) setSalonId(member.salon_id);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Публичная страница НЕ здесь — она открывается тапом на кружок аватара
  // справа сверху (HeaderAvatar) → /telegram/m/public-page.
  // Маркетинг временно открывается во внешнем браузере (Mini-App-версия в работе).
  // Профиль убран по запросу 2026-05-07 — всё что было в нём (имя, аватар,
  // тариф, био, контакты) живёт на публичной странице (открывается тапом
  // на кружок аватара справа сверху). Sign out — в Настройках.
  const links: MoreLinkRaw[] = [
    { key: 'marketing', href: '/telegram/m/marketing', icon: Megaphone, labelKey: 'marketing', hintKey: 'marketingHint', iconColor: 'purple' },
    { key: 'templates', href: '/telegram/m/templates', icon: MessageSquare, labelKey: 'templates', hintKey: 'templatesHint', iconColor: 'cobalt' },
    { key: 'inventory', href: '/telegram/m/inventory', icon: Package, labelKey: 'inventory', hintKey: 'inventoryHint', iconColor: 'emerald' },
    { key: 'suppliers', href: '/telegram/m/suppliers', icon: Truck, labelKey: 'suppliers', hintKey: 'suppliersHint', iconColor: 'amber' },
    // 'Живая очередь' убрана 2026-05-10 — фича оказалась не нужна.
    { key: 'waitlist', href: '/telegram/m/waitlist', icon: Hourglass, labelKey: 'waitlist', hintKey: 'waitlistHint', iconColor: 'info' },
    { key: 'partners', href: '/telegram/m/partners', icon: Users2, labelKey: 'partners', hintKey: 'partnersHint', iconColor: 'cobalt' },
    ...(salonId ? [{ key: 'team', href: `/telegram/m/salon/${salonId}/dashboard`, icon: Building2, labelKey: 'team' as const, hintKey: 'teamHint' as const, iconColor: 'purple' as const }] : []),
    { key: 'ai', href: '/telegram/m/ai', icon: Bot, labelKey: 'ai', hintKey: 'aiHint', iconColor: 'cobalt' },
    { key: 'schedule', href: '/telegram/m/settings/schedule', icon: Clock, labelKey: 'schedule', hintKey: 'scheduleHint', iconColor: 'amber' },
    { key: 'settings', href: '/telegram/m/settings', icon: SettingsIcon, labelKey: 'settings', hintKey: 'settingsHint', iconColor: 'emerald' },
  ];

  function openExternal(href: string) {
    haptic('light');
    const fullUrl = href.startsWith('http') ? href : `${typeof window !== 'undefined' ? window.location.origin : ''}${href}`;
    const w = window as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } };
    if (w.Telegram?.WebApp?.openLink) {
      w.Telegram.WebApp.openLink(fullUrl);
    } else {
      window.open(fullUrl, '_blank');
    }
  }

  return (
    <MobilePage className="od-master-settings">
      <PageHeader title={t.title} />

      {/* Литерально .settings-card + .settings-row из OD master-settings.html.
          Иконка слева — .settings-row-icon с одной из цветовых классов
          (icon-cobalt/emerald/amber/danger/info/purple). Заголовок +
          подзаголовок — .settings-row-title + .settings-row-sub. Справа —
          .settings-row-chevron. Разделители — handled by
          .settings-row:not(:last-child)::after. */}
      <div style={{ padding: `0 ${PAGE_PADDING_X}px`, marginTop: 4 }}>
        <div className="settings-card">
          {links.map((it) => {
            const Icon = it.icon;
            const RightIcon = it.external ? ArrowUpRight : ChevronRight;
            const inner = (
              <>
                <div className={`settings-row-icon icon-${it.iconColor}`}>
                  <Icon size={16} strokeWidth={2} />
                </div>
                <div className="settings-row-body">
                  <div className="settings-row-title">{t[it.labelKey]}</div>
                  <div className="settings-row-sub" style={{ fontSize: 11, color: 'var(--m-text-tertiary)', marginTop: 2 }}>
                    {t[it.hintKey]}
                  </div>
                </div>
                <span className="settings-row-chevron">
                  <RightIcon size={16} strokeWidth={2} />
                </span>
              </>
            );
            if (it.external) {
              return (
                <button key={it.key} type="button" className="settings-row" onClick={() => openExternal(it.href)}>
                  {inner}
                </button>
              );
            }
            return (
              <Link key={it.key} href={it.href} className="settings-row" onClick={() => haptic('light')}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Литерально .settings-logout-row из OD master-settings.html */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="settings-logout-row"
        style={{
          marginTop: 16,
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          opacity: loggingOut ? 0.5 : 1,
        }}
      >
        <LogOut size={18} strokeWidth={2} />
        {t.logout}
      </button>
    </MobilePage>
  );
}
