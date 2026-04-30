/** --- YAML
 * name: Marketing Hub
 * description: Marketing tab container — 4 tabs (Рассылки / Автоматика / Акции / Отзывы) replacing 14 scattered sub-pages.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePageTheme, pageContainer } from '@/lib/dashboard-theme';

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
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{
          fontSize: 24, fontWeight: 600, color: C.text, letterSpacing: '-0.3px',
          margin: 0,
        }}>
          Маркетинг
        </h1>
        <p style={{ fontSize: 13, color: C.textTertiary, margin: '4px 0 0' }}>
          Рассылки, автоматика, акции, отзывы и рекомендации
        </p>
      </div>

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

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={activeTab === 'referrals' ? undefined : { margin: '0 -36px' /* cancel outer pageContainer horizontal padding */ }}
      >
        {activeTab === 'campaigns' && <CampaignsWithAudienceSwitcher />}
        {activeTab === 'automation' && <AutomationPage />}
        {activeTab === 'deals' && <DealsPage />}
        {activeTab === 'reviews' && <ReviewsPage />}
        {activeTab === 'referrals' && <ReferralProgramPanel />}
      </motion.div>
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
