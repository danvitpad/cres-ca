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
import {
  Megaphone,
  Users as UsersIcon,
  Scissors,
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
import { showConfirm, getInitData } from '@/lib/telegram/webapp';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import '@/styles/od-master-settings.css';

type MoreI18NKeys = keyof typeof I18N['ru'];

interface MoreLinkRaw {
  key: string;
  href: string;
  icon: LucideIcon;
  labelKey: MoreI18NKeys;
  hintKey: MoreI18NKeys;
  /** OD цветовая раскраска иконки: cobalt/emerald/amber/danger/info/purple/neutral */
  iconColor: 'cobalt' | 'emerald' | 'amber' | 'danger' | 'info' | 'purple' | 'neutral';
  /** true → открывать во внешнем браузере (web-страница, не Mini App page). */
  external?: boolean;
}

const I18N: Record<MiniAppLang, {
  title: string;
  clients: string; clientsHint: string;
  services: string; servicesHint: string;
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
    clients: 'Клієнти', clientsHint: 'Ваша база клієнтів',
    services: 'Послуги і ціни', servicesHint: 'Каталог, тривалість, вартість',
    marketing: 'Маркетинг', marketingHint: 'Розсилки, акції, промокоди',
    partners: 'Партнери', partnersHint: 'Реферали та взаємні рекомендації',
    team: 'Команда', teamHint: 'Салон та колеги',
    ai: 'AI-помічник', aiHint: 'Запитай — я відповім',
    profile: 'Профіль', profileHint: "Ім'я, аватар, тариф",
    settings: 'Налаштування', settingsHint: 'Тариф, сповіщення, мова та інше',
    queue: 'Жива черга', queueHint: 'Walk-in клієнти без запису',
    inventory: 'Склад', inventoryHint: 'Матеріали, залишки, поріг',
    suppliers: 'Постачальники', suppliersHint: 'Контакти, замовлення',
    templates: 'Шаблони', templatesHint: 'Тексти нагадувань, відгуків, ДР',
    schedule: 'Графік роботи', scheduleHint: 'Дні та робочі години',
    waitlist: 'Лист очікування', waitlistHint: 'Клієнти що чекають ваше вікно',
    logout: 'Вийти з акаунта',
    logoutConfirm: 'Точно вийти?',
  },
  ru: {
    title: 'Ещё',
    clients: 'Клиенты', clientsHint: 'Ваша база клиентов',
    services: 'Услуги и цены', servicesHint: 'Каталог, длительность, стоимость',
    marketing: 'Маркетинг', marketingHint: 'Рассылки, акции, промокоды',
    partners: 'Партнёры', partnersHint: 'Рефералы и взаимные рекомендации',
    team: 'Команда', teamHint: 'Салон и коллеги',
    ai: 'AI-помощник', aiHint: 'Спроси — отвечу',
    profile: 'Профиль', profileHint: 'Имя, аватар, тариф',
    settings: 'Настройки', settingsHint: 'Тариф, уведомления, язык и прочее',
    queue: 'Живая очередь', queueHint: 'Walk-in клиенты без записи',
    inventory: 'Склад', inventoryHint: 'Материалы, остатки, порог',
    suppliers: 'Поставщики', suppliersHint: 'Контакты, заказы',
    templates: 'Шаблоны', templatesHint: 'Тексты напоминаний, отзывов, ДР',
    schedule: 'График работы', scheduleHint: 'Дни и рабочие часы',
    waitlist: 'Лист ожидания', waitlistHint: 'Клиенты что ждут ваше окошко',
    logout: 'Выйти из аккаунта',
    logoutConfirm: 'Точно выйти?',
  },
  en: {
    title: 'More',
    clients: 'Clients', clientsHint: 'Your client base',
    services: 'Services & prices', servicesHint: 'Catalog, duration, price',
    marketing: 'Marketing', marketingHint: 'Broadcasts, deals, promo codes',
    partners: 'Partners', partnersHint: 'Referrals and mutual recommendations',
    team: 'Team', teamHint: 'Salon and colleagues',
    ai: 'AI assistant', aiHint: "Ask — I'll answer",
    profile: 'Profile', profileHint: 'Name, avatar, plan',
    settings: 'Settings', settingsHint: 'Plan, notifications, language and more',
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
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    const ok = await showConfirm(t.logoutConfirm);
    if (!ok) return;
    setLoggingOut(true);
    haptic('warning');
    // Паритет с /m/settings logout: одного signOut + router.replace мало —
    // Mini App при заходе на /telegram снова логинит по initData. Нужна
    // отвязка telegram_id через /api/telegram/unlink, очистка sessionStorage,
    // и hard-redirect window.location на /telegram/welcome.
    try {
      const initData = getInitData();
      if (initData) {
        await fetch('/api/telegram/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
      }
    } catch { /* ignore */ }
    try { await createClient().auth.signOut(); } catch { /* ignore */ }
    try { useAuthStore.getState().clearAuth(); } catch { /* ignore */ }
    try { sessionStorage.removeItem('cres:tg'); } catch { /* ignore */ }
    window.location.replace('/telegram/welcome');
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
    { key: 'clients', href: '/telegram/m/clients', icon: UsersIcon, labelKey: 'clients', hintKey: 'clientsHint', iconColor: 'neutral' },
    // Лист ожидания поднят сразу после Клиентов 2026-05-13 — раньше был
    // на 7-й позиции и его не замечали. Концептуально это «клиенты,
    // которые ждут окошко» — логически рядом с базой клиентов.
    { key: 'waitlist', href: '/telegram/m/waitlist', icon: Hourglass, labelKey: 'waitlist', hintKey: 'waitlistHint', iconColor: 'neutral' },
    { key: 'services', href: '/telegram/m/services', icon: Scissors, labelKey: 'services', hintKey: 'servicesHint', iconColor: 'neutral' },
    { key: 'marketing', href: '/telegram/m/marketing', icon: Megaphone, labelKey: 'marketing', hintKey: 'marketingHint', iconColor: 'neutral' },
    { key: 'templates', href: '/telegram/m/templates', icon: MessageSquare, labelKey: 'templates', hintKey: 'templatesHint', iconColor: 'neutral' },
    { key: 'inventory', href: '/telegram/m/inventory', icon: Package, labelKey: 'inventory', hintKey: 'inventoryHint', iconColor: 'neutral' },
    { key: 'suppliers', href: '/telegram/m/suppliers', icon: Truck, labelKey: 'suppliers', hintKey: 'suppliersHint', iconColor: 'neutral' },
    { key: 'partners', href: '/telegram/m/partners', icon: Users2, labelKey: 'partners', hintKey: 'partnersHint', iconColor: 'neutral' },
    ...(salonId ? [{ key: 'team', href: `/telegram/m/salon/${salonId}/dashboard`, icon: Building2, labelKey: 'team' as const, hintKey: 'teamHint' as const, iconColor: 'neutral' as const }] : []),
    { key: 'ai', href: '/telegram/m/ai', icon: Bot, labelKey: 'ai', hintKey: 'aiHint', iconColor: 'neutral' },
    { key: 'schedule', href: '/telegram/m/settings/schedule', icon: Clock, labelKey: 'schedule', hintKey: 'scheduleHint', iconColor: 'neutral' },
    { key: 'settings', href: '/telegram/m/settings', icon: SettingsIcon, labelKey: 'settings', hintKey: 'settingsHint', iconColor: 'neutral' },
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
