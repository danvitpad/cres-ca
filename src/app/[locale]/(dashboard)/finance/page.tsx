/** --- YAML
 * name: FinancePage
 * description: Finance hub — 4 tabs (Сводка / Услуги / Отчёты / Записи). Tab state in URL search params.
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
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';

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
      fontFamily: FONT,
      fontFeatureSettings: FONT_FEATURES,
      color: C.text,
      background: C.bg,
      padding: '32px 40px',
      maxWidth: 900,
      margin: '0 auto',
      width: '100%',
    }}>
      {/* ─── Tab bar ─── */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
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
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px',
                border: 'none', background: 'transparent',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 510,
                fontFamily: FONT,
                fontFeatureSettings: '"cv01", "ss03"',
                color: isActive ? C.text : C.textTertiary,
                borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} style={{ opacity: isActive ? 1 : 0.5 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tab content ─── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
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
