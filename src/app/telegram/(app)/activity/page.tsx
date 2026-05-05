/** --- YAML
 * name: MiniAppActivityPage
 * description: «Действие» — Fresha-style. Большой заголовок, чёрные tab-pills
 *              (Все / Записи / Подарочные карты / Абонементы), список карточек или
 *              empty-state с CTA «Поиск заведений». Светлая тема, премиум.
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { resolveCardDisplay, type SalonRef } from '@/lib/client/display-mode';
import { formatMoney } from '@/lib/format/money';
import {
  MobilePage,
  PageHeader,
  TabPills,
  EmptyState,
  AvatarCircle,
} from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';

type Lang = 'uk' | 'ru' | 'en';

const I18N: Record<Lang, {
  title: string;
  tabAll: string; tabUpcoming: string; tabGiftCards: string; tabMemberships: string; tabPast: string;
  noGiftCards: string; noMemberships: string; noGiftCardsDesc: string; noMembershipsDesc: string;
  noActivity: string; noActivityDesc: string;
  searchMasters: string; searchVenues: string;
  status: Record<string, string>;
}> = {
  uk: {
    title: 'Активність',
    tabAll: 'Всі', tabUpcoming: 'Записи', tabGiftCards: 'Подарункові карти',
    tabMemberships: 'Абонементи', tabPast: 'Історія',
    noGiftCards: 'Немає подарункових карт', noMemberships: 'Немає абонементів',
    noGiftCardsDesc: 'Куплені та отримані подарункові карти відображатимуться тут',
    noMembershipsDesc: 'Активні абонементи у майстрів відображатимуться тут',
    noActivity: 'Немає активності',
    noActivityDesc: 'Ваші зустрічі, покупки та підписки відображатимуться тут',
    searchMasters: 'Пошук майстрів', searchVenues: 'Пошук закладів',
    status: {
      booked: 'Записано', confirmed: 'Підтверджено', in_progress: 'Йде',
      completed: 'Завершено', cancelled: 'Скасовано', cancelled_by_client: 'Скасовано',
      cancelled_by_master: 'Скасовано', no_show: 'Не з\'явився',
    },
  },
  ru: {
    title: 'Действие',
    tabAll: 'Все', tabUpcoming: 'Записи', tabGiftCards: 'Подарочные карты',
    tabMemberships: 'Абонементы', tabPast: 'История',
    noGiftCards: 'Нет подарочных карт', noMemberships: 'Нет абонементов',
    noGiftCardsDesc: 'Купленные и полученные подарочные карты будут отображаться здесь',
    noMembershipsDesc: 'Активные абонементы у мастеров будут отображаться здесь',
    noActivity: 'Нет активности',
    noActivityDesc: 'Ваши встречи, покупки и подписки будут отображаться здесь',
    searchMasters: 'Поиск мастеров', searchVenues: 'Поиск заведений',
    status: {
      booked: 'Записан', confirmed: 'Подтверждено', in_progress: 'Идёт',
      completed: 'Завершено', cancelled: 'Отменено', cancelled_by_client: 'Отменено',
      cancelled_by_master: 'Отменено', no_show: 'Не пришёл',
    },
  },
  en: {
    title: 'Activity',
    tabAll: 'All', tabUpcoming: 'Upcoming', tabGiftCards: 'Gift cards',
    tabMemberships: 'Memberships', tabPast: 'History',
    noGiftCards: 'No gift cards', noMemberships: 'No memberships',
    noGiftCardsDesc: 'Purchased and received gift cards will appear here',
    noMembershipsDesc: 'Active memberships with masters will appear here',
    noActivity: 'No activity',
    noActivityDesc: 'Your appointments, purchases and subscriptions will appear here',
    searchMasters: 'Find masters', searchVenues: 'Find venues',
    status: {
      booked: 'Booked', confirmed: 'Confirmed', in_progress: 'In progress',
      completed: 'Completed', cancelled: 'Cancelled', cancelled_by_client: 'Cancelled',
      cancelled_by_master: 'Cancelled', no_show: 'No show',
    },
  },
};

// Card labels are derived from the locale in the component

type SalonEmbed =
  | { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null }
  | null;

function unwrapSalon(s: SalonEmbed | SalonEmbed[] | null | undefined): SalonRef | null {
  if (!s) return null;
  const obj = Array.isArray(s) ? s[0] ?? null : s;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, logo_url: obj.logo_url, city: obj.city, rating: obj.rating };
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  currency: string | null;
  service_name: string;
  service_color: string | null;
  master_id: string | null;
  master_display_name: string | null;
  master_avatar: string | null;
  master_specialization: string | null;
  master_salon_id: string | null;
  salon: SalonRef | null;
}

type Tab = 'all' | 'upcoming' | 'past' | 'gift_cards' | 'memberships';

export default function MiniAppActivityPage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const tabOptions: { value: Tab; label: string }[] = [
    { value: 'all', label: t.tabAll },
    { value: 'upcoming', label: t.tabUpcoming },
    { value: 'gift_cards', label: t.tabGiftCards },
    { value: 'memberships', label: t.tabMemberships },
    { value: 'past', label: t.tabPast },
  ];
  const cardLabels = {
    masterPlaceholder: lang === 'en' ? 'Master' : lang === 'uk' ? 'Майстер' : 'Мастер',
    salonPlaceholder: lang === 'en' ? 'Salon' : lang === 'uk' ? 'Салон' : 'Салон',
    managerAssigned: lang === 'en' ? 'Master will be assigned by admin' : lang === 'uk' ? 'Майстра призначить адміністратор' : 'Мастер будет назначен администратором',
  };
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      const initData = (() => {
        if (typeof window === 'undefined') return null;
        const w = window as { Telegram?: { WebApp?: { initData?: string } } };
        const live = w.Telegram?.WebApp?.initData;
        if (live) return live;
        try {
          const stash = sessionStorage.getItem('cres:tg');
          if (stash) {
            const parsed = JSON.parse(stash) as { initData?: string };
            if (parsed.initData) return parsed.initData;
          }
        } catch {
          /* ignore */
        }
        return null;
      })();
      if (!initData) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/telegram/c/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      const data = json.appointments ?? [];
      const rows: AppointmentRow[] = data.map((row: unknown) => {
        const a = row as {
          id: string;
          starts_at: string;
          status: string;
          price: number | null;
          currency: string | null;
          master:
            | {
                id: string | null;
                display_name: string | null;
                avatar_url: string | null;
                specialization: string | null;
                salon_id: string | null;
                profile:
                  | { full_name: string | null; avatar_url: string | null }
                  | { full_name: string | null; avatar_url: string | null }[]
                  | null;
                salon: SalonEmbed | SalonEmbed[];
              }
            | null;
          service: { name: string | null; color: string | null } | { name: string | null; color: string | null }[] | null;
        };
        const master = Array.isArray(a.master) ? a.master[0] ?? null : a.master;
        const masterProfile =
          master && master.profile
            ? ((Array.isArray(master.profile) ? master.profile[0] ?? null : master.profile) as {
                full_name: string | null;
                avatar_url: string | null;
              } | null)
            : null;
        const svc = Array.isArray(a.service) ? a.service[0] ?? null : a.service;
        const salonRaw = master?.salon ?? null;
        return {
          id: a.id,
          starts_at: a.starts_at,
          status: a.status,
          price: Number(a.price ?? 0),
          currency: a.currency ?? 'UAH',
          service_name: svc?.name ?? '—',
          service_color: svc?.color ?? null,
          master_id: master?.id ?? null,
          master_display_name: master?.display_name ?? masterProfile?.full_name ?? null,
          master_avatar: master?.avatar_url ?? masterProfile?.avatar_url ?? null,
          master_specialization: master?.specialization ?? null,
          master_salon_id: master?.salon_id ?? null,
          salon: unwrapSalon(salonRaw as SalonEmbed | SalonEmbed[] | null),
        };
      });
      setAppointments(rows);
      setLoading(false);
    })();
  }, [userId]);

  const { upcoming, past, all } = useMemo(() => {
    const now = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const a of appointments) {
      const isDone = ['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(
        a.status,
      );
      if (!isDone && new Date(a.starts_at).getTime() >= now - 3600 * 1000) up.push(a);
      else pa.push(a);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    pa.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcoming: up, past: pa, all: [...up, ...pa] };
  }, [appointments]);

  const visible: AppointmentRow[] =
    tab === 'all' ? all : tab === 'upcoming' ? upcoming : tab === 'past' ? past : [];
  const isAppointmentTab = tab === 'all' || tab === 'upcoming' || tab === 'past';

  return (
    <MobilePage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <PageHeader title={t.title} />

        <TabPills
          value={tab}
          onChange={(v) => {
            setTab(v);
            haptic('selection');
          }}
          options={tabOptions}
          accent="#0a0a0c"
        />

        <div style={{ padding: `8px ${PAGE_PADDING_X}px 0` }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 88,
                    width: '100%',
                    borderRadius: R.md,
                    background: T.bgSubtle,
                    animation: 'pulse 1.6s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : !isAppointmentTab ? (
            <EmptyState
              icon={
                <span style={{ fontSize: 56, lineHeight: 1 }}>
                  {tab === 'gift_cards' ? '🎁' : '🎫'}
                </span>
              }
              title={tab === 'gift_cards' ? t.noGiftCards : t.noMemberships}
              desc={tab === 'gift_cards' ? t.noGiftCardsDesc : t.noMembershipsDesc}
              ctaLabel={t.searchMasters}
              ctaHref="/telegram/search"
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<CalendarDaysIcon />}
              title={t.noActivity}
              desc={t.noActivityDesc}
              ctaLabel={t.searchVenues}
              ctaHref="/telegram/search"
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visible.map((a, i) => {
                const masterRef = a.master_id
                  ? {
                      id: a.master_id,
                      display_name: a.master_display_name,
                      avatar_url: a.master_avatar,
                      specialization: a.master_specialization,
                      salon_id: a.master_salon_id,
                    }
                  : null;
                const d = resolveCardDisplay(masterRef, a.salon, cardLabels);
                const dateLocale = lang === 'en' ? 'en-GB' : lang === 'uk' ? 'uk-UA' : 'ru-RU';
                const date = new Date(a.starts_at).toLocaleString(dateLocale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link
                      href={`/telegram/activity/${a.id}`}
                      onClick={() => haptic('light')}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        background: T.surface,
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: R.md,
                        textDecoration: 'none',
                        color: T.text,
                      }}
                    >
                      <AvatarCircle url={a.master_avatar} name={d.primary || 'M'} size={48} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.primary}
                        </p>
                        {d.secondary && (
                          <p style={{ ...TYPE.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.secondary}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: a.service_color ?? T.accent,
                            }}
                          />
                          <span style={{ ...TYPE.caption, fontWeight: 600, color: T.textSecondary }}>
                            {a.service_name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, ...TYPE.caption }}>
                          <Calendar size={13} />
                          <span>{date}</span>
                          {a.price > 0 && (
                            <>
                              <span style={{ color: T.textTertiary }}>·</span>
                              <span style={{ fontWeight: 600, color: T.text }}>
                                {formatMoney(a.price, a.currency)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <StatusChip status={a.status} labels={t.status} />
                        <ChevronRight size={18} color={T.textTertiary} />
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </MobilePage>
  );
}

function CalendarDaysIcon() {
  // Soft purple-pink gradient calendar icon — Fresha empty-state vibe
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: R.md,
        background: `linear-gradient(135deg, ${T.gradientFrom}40 0%, ${T.gradientTo}40 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CalendarDays size={32} color={T.accent} strokeWidth={2} />
    </div>
  );
}

function StatusChip({ status, labels }: { status: string; labels: Record<string, string> }) {
  const baseMap: Record<string, { bg: string; color: string; icon: React.ElementType }> = {
    booked: { bg: '#dbeafe', color: '#1d4ed8', icon: Clock3 },
    confirmed: { bg: T.successSoft, color: T.success, icon: CheckCircle2 },
    in_progress: { bg: T.accentSoft, color: T.accent, icon: Clock3 },
    completed: { bg: T.successSoft, color: T.success, icon: CheckCircle2 },
    cancelled: { bg: T.dangerSoft, color: T.danger, icon: XCircle },
    cancelled_by_client: { bg: T.dangerSoft, color: T.danger, icon: XCircle },
    cancelled_by_master: { bg: T.dangerSoft, color: T.danger, icon: XCircle },
    no_show: { bg: T.warningSoft, color: T.warning, icon: XCircle },
  };
  const base = baseMap[status] ?? baseMap.booked;
  const info = { ...base, label: labels[status] ?? labels.booked ?? status };
  const Icon = info.icon;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 8px',
        borderRadius: R.pill,
        background: info.bg,
        color: info.color,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      <Icon size={11} /> {info.label}
    </span>
  );
}
