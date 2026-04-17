/** --- YAML
 * name: FinancePage
 * description: Finance hub — 4 tabs (Сводка / Услуги / Отчёты / Записи). Tab state in URL search params. Full-width layout.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Scissors, FileBarChart, CalendarCheck,
} from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES, pageContainer } from '@/lib/dashboard-theme';

import { SummaryTab } from './_tabs/summary-tab';
import { ServicesTab } from './_tabs/services-tab';
import { ReportsTab } from './_tabs/reports-tab';
import { AppointmentsTab } from './_tabs/appointments-tab';

type TopTab = 'summary' | 'services' | 'reports' | 'appointments';

const TABS: { key: TopTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'summary',      label: 'Сводка',   icon: LayoutDashboard },
  { key: 'services',     label: 'Услуги',   icon: Scissors },
  { key: 'reports',      label: 'Отчёты',   icon: FileBarChart },
  { key: 'appointments', label: 'Записи',   icon: CalendarCheck },
];

type Period = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all';

export default function FinancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { C, isDark } = usePageTheme();

  const rawTab = searchParams.get('tab') || 'summary';
  const activeTab = TABS.some(t => t.key === rawTab) ? (rawTab as TopTab) : 'summary';

  const [period, setPeriod] = useState<Period>('month');

  function setTab(key: TopTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'summary') {
      params.delete('tab');
    } else {
      params.set('tab', key);
    }
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
      {/* ─── Tab bar ─── */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 4,
        marginBottom: 28,
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
                fontFeatureSettings: '"cv01", "ss03"',
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

      {/* ─── Tab content ─── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {activeTab === 'summary' && (
          <SummaryTab C={C} isDark={isDark} period={period} setPeriod={setPeriod} />
        )}
        {activeTab === 'services' && (
          <ServicesTab C={C} />
        )}
        {activeTab === 'reports' && (
          <ReportsTab C={C} />
        )}
        {activeTab === 'appointments' && (
          <AppointmentsTab C={C} />
        )}
      </motion.div>
    </div>
  );
}
