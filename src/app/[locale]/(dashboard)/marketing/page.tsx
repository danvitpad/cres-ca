/** --- YAML
 * name: Marketing Hub
 * description: Marketing tab container — 4 tabs (Рассылки / Автоматика / Акции / Отзывы) replacing 14 scattered sub-pages.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { TrendingUp, Tag, Star, Send, Megaphone, Ticket, Heart, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { usePageTheme, pageContainer } from '@/lib/dashboard-theme';
import { useMaster } from '@/hooks/use-master';
import { createClient } from '@/lib/supabase/client';

import CampaignsPage from './campaigns/page';
import AutomationPage from './automation/page';
import DealsPage from './deals/page';
import ReviewsPage from './reviews/page';
import BroadcastsPage from './broadcasts/page';
import { ReferralProgramPanel } from '@/components/marketing/referral-program-panel';

// Объединил «Рассылки» (по своей CRM-базе) и «Подписчикам» (публичные подписки)
// под один таб «Рассылки» с внутренним переключателем аудитории. Снаружи —
// одно понятное место «куда пойти чтобы кому-то что-то разослать».
type TopTab = 'campaigns' | 'automation' | 'deals' | 'reviews' | 'referrals';

type MktLang = 'uk' | 'ru' | 'en';
const MKT_LABELS: Record<MktLang, {
  title: string; subtitle: string;
  tabs: Record<TopTab, string>;
  kpiActiveCampaigns: string; kpiActiveCampaignsSubOn: string; kpiActiveCampaignsSubOff: string;
  kpiPromos: string; kpiPromosUsed: (n: number) => string; kpiPromosEmpty: string;
  kpiRating: string; kpiRatingSub: (n: number) => string; kpiRatingEmpty: string;
  kpiBroadcasts: string; kpiBroadcastsOn: string; kpiBroadcastsOff: string;
  // Mobile
  mobHeader: string; mobHeroLabel: string;
  mobHeroDelta: string;
  cardDeals: string; cardDealsSub: string; cardDealsBadge: (n: number) => string;
  cardPromos: string; cardPromosSub: string; cardPromosBadge: (n: number) => string;
  cardReviews: string; cardReviewsSub: string; cardReviewsBadge: (n: number) => string;
  cardBroadcasts: string; cardBroadcastsSub: string; cardBroadcastsBadge: (n: number) => string;
  refTitle: string; refSubFmt: (n: number, sum: number) => string;
  locale: string;
}> = {
  uk: {
    title: 'Маркетинг', subtitle: 'Розсилки, автоматика, акції, відгуки і рекомендації',
    tabs: { campaigns: 'Розсилки', automation: 'Автоматика', deals: 'Акції', reviews: 'Відгуки', referrals: 'Рекомендації' },
    kpiActiveCampaigns: 'Активні акції',
    kpiActiveCampaignsSubOn: 'кампаній працює', kpiActiveCampaignsSubOff: 'запустіть першу',
    kpiPromos: 'Промокоди', kpiPromosUsed: (n) => `використано ${n}×`, kpiPromosEmpty: 'не використані',
    kpiRating: 'Середній рейтинг', kpiRatingSub: (n) => `${n} відгуків`, kpiRatingEmpty: 'відгуків немає',
    kpiBroadcasts: 'Розсилок за тиждень', kpiBroadcastsOn: 'цього тижня', kpiBroadcastsOff: 'тихо',
    mobHeader: 'Маркетинг', mobHeroLabel: 'ДОХІД З МАРКЕТИНГУ',
    mobHeroDelta: '+18% порівняно з минулим місяцем',
    cardDeals: 'Акції', cardDealsSub: 'Знижки, абонементи', cardDealsBadge: (n) => `${n} активні`,
    cardPromos: 'Промокоди', cardPromosSub: 'Разові та багаторазові', cardPromosBadge: (n) => `${n} активні`,
    cardReviews: 'Відгуки', cardReviewsSub: 'Збір та відповіді', cardReviewsBadge: (n) => `${n} всього`,
    cardBroadcasts: 'Розсилки', cardBroadcastsSub: 'Email і Telegram', cardBroadcastsBadge: (n) => `${n} за тиждень`,
    refTitle: 'Реферальна програма',
    refSubFmt: (n, sum) => `${n} рекомендованих · ₴ ${sum.toLocaleString('uk-UA')} надійшло`,
    locale: 'uk-UA',
  },
  ru: {
    title: 'Маркетинг', subtitle: 'Рассылки, автоматика, акции, отзывы и рекомендации',
    tabs: { campaigns: 'Рассылки', automation: 'Автоматика', deals: 'Акции', reviews: 'Отзывы', referrals: 'Рекомендации' },
    kpiActiveCampaigns: 'Активных акций',
    kpiActiveCampaignsSubOn: 'кампаний работает', kpiActiveCampaignsSubOff: 'запустите первую',
    kpiPromos: 'Промокоды', kpiPromosUsed: (n) => `использовано ${n}×`, kpiPromosEmpty: 'не использованы',
    kpiRating: 'Средний рейтинг', kpiRatingSub: (n) => `${n} отзывов`, kpiRatingEmpty: 'отзывов нет',
    kpiBroadcasts: 'Рассылок за неделю', kpiBroadcastsOn: 'на этой неделе', kpiBroadcastsOff: 'тихо',
    mobHeader: 'Маркетинг', mobHeroLabel: 'ДОХОД С МАРКЕТИНГА',
    mobHeroDelta: '+18% по сравнению с прошлым месяцем',
    cardDeals: 'Акции', cardDealsSub: 'Скидки, абонементы', cardDealsBadge: (n) => `${n} активные`,
    cardPromos: 'Промокоды', cardPromosSub: 'Разовые и многоразовые', cardPromosBadge: (n) => `${n} активные`,
    cardReviews: 'Отзывы', cardReviewsSub: 'Сбор и ответы', cardReviewsBadge: (n) => `${n} всего`,
    cardBroadcasts: 'Рассылки', cardBroadcastsSub: 'Email и Telegram', cardBroadcastsBadge: (n) => `${n} за неделю`,
    refTitle: 'Реферальная программа',
    refSubFmt: (n, sum) => `${n} рекомендованных · ₴ ${sum.toLocaleString('ru-RU')} получено`,
    locale: 'ru-RU',
  },
  en: {
    title: 'Marketing', subtitle: 'Broadcasts, automation, deals, reviews and referrals',
    tabs: { campaigns: 'Broadcasts', automation: 'Automation', deals: 'Deals', reviews: 'Reviews', referrals: 'Referrals' },
    kpiActiveCampaigns: 'Active deals',
    kpiActiveCampaignsSubOn: 'campaigns running', kpiActiveCampaignsSubOff: 'launch your first',
    kpiPromos: 'Promo codes', kpiPromosUsed: (n) => `used ${n}×`, kpiPromosEmpty: 'not used',
    kpiRating: 'Average rating', kpiRatingSub: (n) => `${n} reviews`, kpiRatingEmpty: 'no reviews',
    kpiBroadcasts: 'Broadcasts this week', kpiBroadcastsOn: 'this week', kpiBroadcastsOff: 'quiet',
    mobHeader: 'Marketing', mobHeroLabel: 'MARKETING REVENUE',
    mobHeroDelta: '+18% vs last month',
    cardDeals: 'Deals', cardDealsSub: 'Discounts, subscriptions', cardDealsBadge: (n) => `${n} active`,
    cardPromos: 'Promo codes', cardPromosSub: 'Single-use and reusable', cardPromosBadge: (n) => `${n} active`,
    cardReviews: 'Reviews', cardReviewsSub: 'Collect and respond', cardReviewsBadge: (n) => `${n} total`,
    cardBroadcasts: 'Broadcasts', cardBroadcastsSub: 'Email and Telegram', cardBroadcastsBadge: (n) => `${n} this week`,
    refTitle: 'Referral program',
    refSubFmt: (n, sum) => `${n} referred · ₴ ${sum.toLocaleString('en-US')} earned`,
    locale: 'en-US',
  },
};

export default function MarketingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { C } = usePageTheme();
  const { master } = useMaster();
  const localeRaw = useLocale();
  const mktLang: MktLang = (['uk', 'ru', 'en'].includes(localeRaw) ? localeRaw : 'ru') as MktLang;
  const L = MKT_LABELS[mktLang];
  const TABS: ReadonlyArray<{ value: TopTab; label: string }> = [
    { value: 'campaigns',  label: L.tabs.campaigns },
    { value: 'automation', label: L.tabs.automation },
    { value: 'deals',      label: L.tabs.deals },
    { value: 'reviews',    label: L.tabs.reviews },
    { value: 'referrals',  label: L.tabs.referrals },
  ];
  const [stats, setStats] = useState<{
    activeCampaigns: number;
    activePromos: number;
    usedPromos: number;
    avgRating: number;
    totalReviews: number;
    weeklyBroadcasts: number;
  } | null>(null);
  const [refStats, setRefStats] = useState<{ count: number; sum: number }>({ count: 0, sum: 0 });

  // Mobile state
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileSection, setMobileSection] = useState<TopTab | null>(null);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Загружаем агрегированные KPI маркетинга
  useEffect(() => {
    if (!master?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [campaignsR, promosR, reviewsR, broadcastsR, refRewardsR] = await Promise.all([
        supabase.from('campaigns').select('id, is_active').eq('master_id', master.id),
        supabase.from('promo_codes').select('id, is_active, uses_count').eq('master_id', master.id),
        supabase.from('reviews').select('id, rating').eq('master_id', master.id),
        supabase.from('master_broadcasts').select('id, created_at').eq('master_id', master.id).gte('created_at', weekAgo),
        // Реферальные награды у этого мастера: каждая запись = одна
        // успешная рекомендация (триггер 00161 пишет visit_earn после
        // первого завершённого визита приведённого клиента).
        supabase.from('loyalty_transactions')
          .select('amount')
          .eq('master_id', master.id)
          .eq('kind', 'referral_reward'),
      ]);
      if (cancelled) return;
      const campaigns = campaignsR.data ?? [];
      const promos = promosR.data ?? [];
      const reviews = reviewsR.data ?? [];
      const broadcasts = broadcastsR.data ?? [];
      const refRewards = (refRewardsR.data ?? []) as Array<{ amount: number | string | null }>;
      const refCount = refRewards.length;
      const refSum = refRewards.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setRefStats({ count: refCount, sum: refSum });
      const avgRating = reviews.length > 0
        ? reviews.reduce((s: number, r: { rating: number | null }) => s + (Number(r.rating) || 0), 0) / reviews.length
        : 0;
      setStats({
        activeCampaigns: campaigns.filter((c: { is_active: boolean | null }) => c.is_active).length,
        activePromos: promos.filter((p: { is_active: boolean | null }) => p.is_active).length,
        usedPromos: promos.reduce((s: number, p: { uses_count: number | null }) => s + (Number(p.uses_count) || 0), 0),
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        weeklyBroadcasts: broadcasts.length,
      });
    })();
    return () => { cancelled = true; };
  }, [master?.id]);

  // Hydration-safe: на SSR всегда default 'campaigns'. После монтирования
  // useEffect читает реальный ?tab= из URL и переключает таб. Раньше читали
  // searchParams напрямую при первом render → SSR ≠ client → React #418
  // → нужен был F5 чтобы вкладка ожила.
  const [activeTab, setActiveTab] = useState<TopTab>('campaigns');
  useEffect(() => {
    const rawTab = searchParams.get('tab') || 'campaigns';
    if (TABS.some(t => t.value === rawTab)) {
      setActiveTab(rawTab as TopTab);
    } else {
      setActiveTab('campaigns');
    }
  }, [searchParams]);

  function setTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'campaigns') params.delete('tab');
    else params.set('tab', key);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  // ── MOBILE VIEW ──────────────────────────────────────────────────────────
  if (isMobileView) {
    // Section detail view (tapped one of the 4 section cards)
    if (mobileSection) {
      const sectionLabel = TABS.find(t => t.value === mobileSection)?.label ?? '';
      return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setMobileSection(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#2563eb', padding: '4px 0' }}>
              <ArrowLeft style={{ width: 20, height: 20 }} />
            </button>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{sectionLabel}</span>
          </div>
          <div style={{ padding: '0' }}>
            {mobileSection === 'campaigns' && <CampaignsWithAudienceSwitcher />}
            {mobileSection === 'automation' && <AutomationPage />}
            {mobileSection === 'deals' && <DealsPage />}
            {mobileSection === 'reviews' && <ReviewsPage />}
            {mobileSection === 'referrals' && <ReferralProgramPanel />}
          </div>
        </div>
      );
    }

    // Overview grid
    const mktSections = [
      { key: 'deals' as TopTab,      icon: Megaphone, title: L.cardDeals,      sub: L.cardDealsSub,      badge: stats ? L.cardDealsBadge(stats.activeCampaigns) : '—', badgeWarn: false },
      { key: 'campaigns' as TopTab,  icon: Ticket,    title: L.cardPromos,     sub: L.cardPromosSub,     badge: stats ? L.cardPromosBadge(stats.activePromos) : '—',   badgeWarn: false },
      { key: 'reviews' as TopTab,    icon: Star,      title: L.cardReviews,    sub: L.cardReviewsSub,    badge: stats ? L.cardReviewsBadge(stats.totalReviews) : '—',  badgeWarn: false },
      { key: 'campaigns' as TopTab,  icon: Send,      title: L.cardBroadcasts, sub: L.cardBroadcastsSub, badge: stats ? L.cardBroadcastsBadge(stats.weeklyBroadcasts) : '—', badgeWarn: true },
    ] as const;

    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{L.mobHeader}</span>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Hero KPI card */}
          <div style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: 16, padding: '20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{L.mobHeroLabel} — {new Date().toLocaleString(L.locale, { month: 'long' }).toUpperCase()}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>₴ 12 480</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              <TrendingUp style={{ width: 13, height: 13 }} />
              {L.mobHeroDelta}
            </div>
          </div>

          {/* 2×2 section grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {mktSections.map((sec, i) => (
              <button
                key={i}
                onClick={() => setMobileSection(sec.key)}
                style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px', textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <sec.icon style={{ width: 18, height: 18, color: '#2563eb' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{sec.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{sec.sub}</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10,
                  background: sec.badgeWarn ? '#fffbeb' : '#f0fdf4',
                  color: sec.badgeWarn ? '#d97706' : '#16a34a',
                  border: `1px solid ${sec.badgeWarn ? '#fde68a' : '#bbf7d0'}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sec.badgeWarn ? '#d97706' : '#16a34a' }} />
                  {sec.badge}
                </div>
              </button>
            ))}
          </div>

          {/* Referral card */}
          <button
            onClick={() => setMobileSection('referrals')}
            style={{ width: '100%', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Heart style={{ width: 20, height: 20, color: '#ef4444' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{L.refTitle}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{L.refSubFmt(refStats.count, refStats.sum)}</div>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: '#cbd5e1', flexShrink: 0 }} />
          </button>
        </div>

        {/* FAB */}
        <button
          onClick={() => setMobileSection('deals')}
          style={{ position: 'fixed', bottom: 88, right: 20, width: 52, height: 52, borderRadius: 26, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,99,235,0.35)', zIndex: 40 }}
        >
          <Plus style={{ width: 24, height: 24, color: '#fff' }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      ...pageContainer,
      color: C.text,
      background: C.bg,
      minHeight: '100%',
    }}>
      {/* Header (Open Design: 28px bold) */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: C.text,
          letterSpacing: '-0.02em', margin: 0, lineHeight: 1,
        }}>
          {L.title}
        </h1>
        <p style={{ fontSize: 14, color: C.textTertiary, margin: '6px 0 0' }}>
          {L.subtitle}
        </p>
      </div>

      {/* KPI strip — Open Design master-marketing.html port (4 cards с дельтами) */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}>
          <MktKpiCard
            label={L.kpiActiveCampaigns}
            value={String(stats.activeCampaigns)}
            sub={stats.activeCampaigns > 0 ? L.kpiActiveCampaignsSubOn : L.kpiActiveCampaignsSubOff}
            icon={<TrendingUp size={14} />}
            C={C}
          />
          <MktKpiCard
            label={L.kpiPromos}
            value={String(stats.activePromos)}
            sub={stats.usedPromos > 0 ? L.kpiPromosUsed(stats.usedPromos) : L.kpiPromosEmpty}
            icon={<Tag size={14} />}
            highlight
            C={C}
          />
          <MktKpiCard
            label={L.kpiRating}
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            sub={stats.totalReviews > 0 ? L.kpiRatingSub(stats.totalReviews) : L.kpiRatingEmpty}
            icon={<Star size={14} />}
            valueColor="#f59e0b"
            C={C}
          />
          <MktKpiCard
            label={L.kpiBroadcasts}
            value={String(stats.weeklyBroadcasts)}
            sub={stats.weeklyBroadcasts > 0 ? L.kpiBroadcastsOn : L.kpiBroadcastsOff}
            icon={<Send size={14} />}
            C={C}
          />
        </div>
      )}

      {/* Underline tabs — matches Finance and Catalog styling.
          Wrap on narrow screens, never horizontal-scroll (the scroll added
          visual noise on desktop without solving anything). */}
      <div style={{
        marginTop: 16, marginBottom: 24,
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: `1px solid ${C.border}`,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTab(tab.value)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? C.accent : 'transparent'}`,
                color: isActive ? C.text : C.textSecondary,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        key={activeTab}
        style={activeTab === 'referrals' ? undefined : { margin: '0 -36px' /* cancel outer pageContainer horizontal padding */ }}
      >
        {activeTab === 'campaigns' && <CampaignsWithAudienceSwitcher />}
        {activeTab === 'automation' && <AutomationPage />}
        {activeTab === 'deals' && <DealsPage />}
        {activeTab === 'reviews' && <ReviewsPage />}
        {activeTab === 'referrals' && <ReferralProgramPanel />}
      </div>
    </div>
  );
}

/* ─── Inner sub-switch: Клиенты CRM / Публичные подписчики.
   Раньше это были 2 отдельных верхних таба, что путало (рассылка-есть-рассылка
   независимо от того кому шлёшь). Теперь — один таб «Рассылки» c подвыбором
   аудитории внутри. Под капотом два разных composer-а: CampaignsPage умеет
   слать по сегментам своих клиентов; BroadcastsPage — по публичным followers. */
function CampaignsWithAudienceSwitcher() {
  const { C } = usePageTheme();
  const [audience, setAudience] = useState<'clients' | 'subscribers'>('clients');
  return (
    <div>
      <div style={{ padding: '0 36px 0', display: 'flex', gap: 8 }}>
        <button
          onClick={() => setAudience('clients')}
          style={{
            padding: '8px 14px', borderRadius: 999, border: '1px solid',
            borderColor: audience === 'clients' ? C.text : C.border,
            background: audience === 'clients' ? C.text : 'transparent',
            color: audience === 'clients' ? C.bg : C.textSecondary,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Клиентам из CRM
        </button>
        <button
          onClick={() => setAudience('subscribers')}
          style={{
            padding: '8px 14px', borderRadius: 999, border: '1px solid',
            borderColor: audience === 'subscribers' ? C.text : C.border,
            background: audience === 'subscribers' ? C.text : 'transparent',
            color: audience === 'subscribers' ? C.bg : C.textSecondary,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Публичным подписчикам
        </button>
      </div>
      {audience === 'clients' ? <CampaignsPage /> : <BroadcastsPage />}
    </div>
  );
}

/* ─── Marketing KPI tile (Open Design master-marketing.html port) ─── */
function MktKpiCard({
  label, value, sub, icon, valueColor, highlight, C,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueColor?: string;
  highlight?: boolean;
  C: ReturnType<typeof usePageTheme>['C'];
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeftWidth: highlight ? 3 : 1,
        borderLeftColor: highlight ? C.accent : C.border,
        borderRadius: 16,
        padding: '18px 22px',
        fontVariantNumeric: 'tabular-nums',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: C.textTertiary,
        marginBottom: 8,
      }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
        color: valueColor ?? C.text,
        lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.textTertiary }}>
          {sub}
        </div>
      )}
    </div>
  );
}
