/** --- YAML
 * name: Marketing Hub
 * description: Marketing tab container — 4 tabs (Рассылки / Автоматика / Акции / Отзывы) replacing 14 scattered sub-pages.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePageTheme, pageContainer } from '@/lib/dashboard-theme';

import CampaignsPage from './campaigns/page';
import AutomationPage from './automation/page';
import DealsPage from './deals/page';
import ReviewsPage from './reviews/page';
import { ReferralProgramPanel } from '@/components/marketing/referral-program-panel';

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

  const rawTab = searchParams.get('tab') || 'campaigns';
  const activeTab = TABS.some(t => t.value === rawTab) ? (rawTab as TopTab) : 'campaigns';

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
        {activeTab === 'campaigns' && <CampaignsPage />}
        {activeTab === 'automation' && <AutomationPage />}
        {activeTab === 'deals' && <DealsPage />}
        {activeTab === 'reviews' && <ReviewsPage />}
        {activeTab === 'referrals' && <ReferralProgramPanel />}
      </motion.div>
    </div>
  );
}
