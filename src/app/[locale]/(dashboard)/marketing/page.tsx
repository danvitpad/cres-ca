/** --- YAML
 * name: Marketing Hub
 * description: Marketing tab container — 4 tabs (Рассылки / Автоматика / Акции / Отзывы) replacing 14 scattered sub-pages.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { TrendingUp, Tag, Star, Send } from 'lucide-react';
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

const TABS = [
  { value: 'campaigns',  label: 'Рассылки' },
  { value: 'automation', label: 'Автоматика' },
  { value: 'deals',      label: 'Акции' },
  { value: 'reviews',    label: 'Отзывы' },
  { value: 'referrals',  label: 'Рекомендации' },
] as const;

export default function MarketingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { C } = usePageTheme();
  const { master } = useMaster();
  const [stats, setStats] = useState<{
    activeCampaigns: number;
    activePromos: number;
    usedPromos: number;
    avgRating: number;
    totalReviews: number;
    weeklyBroadcasts: number;
  } | null>(null);

  // Загружаем агрегированные KPI маркетинга
  useEffect(() => {
    if (!master?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [campaignsR, promosR, reviewsR, broadcastsR] = await Promise.all([
        supabase.from('campaigns').select('id, is_active').eq('master_id', master.id),
        supabase.from('promo_codes').select('id, is_active, uses_count').eq('master_id', master.id),
        supabase.from('reviews').select('id, rating').eq('master_id', master.id),
        supabase.from('master_broadcasts').select('id, created_at').eq('master_id', master.id).gte('created_at', weekAgo),
      ]);
      if (cancelled) return;
      const campaigns = campaignsR.data ?? [];
      const promos = promosR.data ?? [];
      const reviews = reviewsR.data ?? [];
      const broadcasts = broadcastsR.data ?? [];
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
          Маркетинг
        </h1>
        <p style={{ fontSize: 14, color: C.textTertiary, margin: '6px 0 0' }}>
          Рассылки, автоматика, акции, отзывы и рекомендации
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
            label="Активных акций"
            value={String(stats.activeCampaigns)}
            sub={stats.activeCampaigns > 0 ? 'кампаний работает' : 'запустите первую'}
            icon={<TrendingUp size={14} />}
            C={C}
          />
          <MktKpiCard
            label="Промокоды"
            value={String(stats.activePromos)}
            sub={stats.usedPromos > 0 ? `использовано ${stats.usedPromos}×` : 'не использованы'}
            icon={<Tag size={14} />}
            highlight
            C={C}
          />
          <MktKpiCard
            label="Средний рейтинг"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            sub={stats.totalReviews > 0 ? `${stats.totalReviews} отзывов` : 'отзывов нет'}
            icon={<Star size={14} />}
            valueColor="#f59e0b"
            C={C}
          />
          <MktKpiCard
            label="Рассылок за неделю"
            value={String(stats.weeklyBroadcasts)}
            sub={stats.weeklyBroadcasts > 0 ? 'на этой неделе' : 'тихо'}
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
