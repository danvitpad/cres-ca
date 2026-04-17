/** --- YAML
 * name: Marketing Hub
 * description: Marketing tab container — 4 tabs (Рассылки / Автоматика / Акции / Отзывы) replacing 14 scattered sub-pages.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, Bot, Percent, Star } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';

import CampaignsPage from './campaigns/page';
import AutomationPage from './automation/page';
import DealsPage from './deals/page';
import ReviewsPage from './reviews/page';

type TopTab = 'campaigns' | 'automation' | 'deals' | 'reviews';

const TABS: { key: TopTab; label: string; icon: typeof Send }[] = [
  { key: 'campaigns',  label: 'Рассылки',    icon: Send },
  { key: 'automation', label: 'Автоматика',  icon: Bot },
  { key: 'deals',      label: 'Акции',       icon: Percent },
  { key: 'reviews',    label: 'Отзывы',      icon: Star },
];

export default function MarketingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { C } = usePageTheme();

  const rawTab = searchParams.get('tab') || 'campaigns';
  const activeTab = TABS.some(t => t.key === rawTab) ? (rawTab as TopTab) : 'campaigns';

  function setTab(key: TopTab) {
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px',
          margin: 0,
        }}>
          Маркетинг
        </h1>
        <p style={{ fontSize: 14, color: C.textTertiary, margin: '4px 0 0' }}>
          Рассылки, автоматические напоминания, акции и отзывы
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px',
                border: 'none',
                background: isActive ? C.accent : 'transparent',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 550,
                fontFamily: FONT,
                fontFeatureSettings: FONT_FEATURES,
                color: isActive ? '#ffffff' : C.textTertiary,
                borderRadius: 8,
                transition: 'all 0.2s ease',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <Icon size={16} style={{ opacity: isActive ? 1 : 0.6 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content — inner pages manage their own padding */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ margin: '0 -36px' /* cancel outer pageContainer horizontal padding */ }}
      >
        {activeTab === 'campaigns' && <CampaignsPage />}
        {activeTab === 'automation' && <AutomationPage />}
        {activeTab === 'deals' && <DealsPage />}
        {activeTab === 'reviews' && <ReviewsPage />}
      </motion.div>
    </div>
  );
}
