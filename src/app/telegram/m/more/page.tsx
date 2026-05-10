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
  Users2,
  Building2,
  Bot,
  Settings as SettingsIcon,
  ChevronRight,
  ArrowUpRight,
  UserCheck,
  Package,
  Truck,
  MessageSquare,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { T, R, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useAuthStore } from '@/stores/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

interface MoreLinkRaw {
  key: string;
  href: string;
  icon: LucideIcon;
  labelKey: keyof typeof I18N['ru'];
  hintKey: keyof typeof I18N['ru'];
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
  },
};

export default function MasterMiniAppMore() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const [salonId, setSalonId] = useState<string | null>(null);

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
    { key: 'marketing', href: '/telegram/m/marketing', icon: Megaphone, labelKey: 'marketing', hintKey: 'marketingHint' },
    { key: 'templates', href: '/telegram/m/templates', icon: MessageSquare, labelKey: 'templates', hintKey: 'templatesHint' },
    { key: 'inventory', href: '/telegram/m/inventory', icon: Package, labelKey: 'inventory', hintKey: 'inventoryHint' },
    { key: 'suppliers', href: '/telegram/m/suppliers', icon: Truck, labelKey: 'suppliers', hintKey: 'suppliersHint' },
    { key: 'queue', href: '/telegram/m/queue', icon: UserCheck, labelKey: 'queue', hintKey: 'queueHint' },
    { key: 'partners', href: '/telegram/m/partners', icon: Users2, labelKey: 'partners', hintKey: 'partnersHint' },
    ...(salonId ? [{ key: 'team', href: `/telegram/m/salon/${salonId}/dashboard`, icon: Building2, labelKey: 'team' as const, hintKey: 'teamHint' as const }] : []),
    { key: 'ai', href: '/telegram/m/ai', icon: Bot, labelKey: 'ai', hintKey: 'aiHint' },
    { key: 'schedule', href: '/telegram/m/settings/schedule', icon: Clock, labelKey: 'schedule', hintKey: 'scheduleHint' },
    { key: 'settings', href: '/telegram/m/settings', icon: SettingsIcon, labelKey: 'settings', hintKey: 'settingsHint' },
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
    <MobilePage>
      <PageHeader title={t.title} />
      <div
        style={{
          margin: `4px ${PAGE_PADDING_X}px 0`,
          background: T.surface,
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: R.lg,
          boxShadow: SHADOW.card,
          overflow: 'hidden',
        }}
      >
        {links.map((it, idx) => {
          const Icon = it.icon;
          const RightIcon = it.external ? ArrowUpRight : ChevronRight;
          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 16px',
            borderTop: idx === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
            textDecoration: 'none',
            color: T.text,
            WebkitTapHighlightColor: 'transparent',
            background: 'transparent',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
            cursor: 'pointer',
          };
          const inner = (
            <>
              <Icon size={22} strokeWidth={1.8} color={T.textSecondary} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{t[it.labelKey]}</span>
                <span style={{ display: 'block', fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{t[it.hintKey]}</span>
              </span>
              <RightIcon size={16} color={T.textTertiary} strokeWidth={2} />
            </>
          );
          if (it.external) {
            return (
              <button key={it.key} type="button" onClick={() => openExternal(it.href)} style={rowStyle}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={it.key} href={it.href} onClick={() => haptic('light')} style={rowStyle as React.CSSProperties}>
              {inner}
            </Link>
          );
        })}
      </div>
    </MobilePage>
  );
}
