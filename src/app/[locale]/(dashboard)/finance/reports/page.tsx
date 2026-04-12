/** --- YAML
 * name: AnalyticsReportsPage
 * description: Fresha-exact analytics/reports hub — categorized report cards with favorites, search, and filtering
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Search, Star, BarChart3, DollarSign, Users, CalendarDays, ShoppingBag, TrendingUp, Heart, Briefcase } from 'lucide-react';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  pageBg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '0.8px solid #e0e0e0',
  text: '#0d0d0d',
  textSecondary: '#737373',
  textMuted: '#a3a3a3',
  accent: '#6950f3',
  sidebarBg: '#0d0d0d',
  sidebarText: '#f5f5f5',
  sidebarTextSecondary: '#999999',
  sidebarTextMuted: '#737373',
  sidebarHover: '#222222',
  sidebarBorder: '#e5e5e5',
  divider: '#e5e5e5',
  searchBg: '#f5f5f5',
  premiumBadge: '#6950f3',
};
const DARK = {
  pageBg: '#000000',
  cardBg: '#000000',
  cardBorder: '0.8px solid #1a1a1a',
  text: '#f5f5f5',
  textSecondary: '#bfbfbf',
  textMuted: '#666666',
  accent: '#8880ff',
  sidebarBg: '#000000',
  sidebarText: '#e5e5e5',
  sidebarTextSecondary: '#999999',
  sidebarTextMuted: '#666666',
  sidebarHover: '#0a0a0a',
  sidebarBorder: '#1a1a1a',
  divider: '#1a1a1a',
  searchBg: '#000000',
  premiumBadge: '#8880ff',
};

type ReportCategory = 'all' | 'sales' | 'finance' | 'appointments' | 'team' | 'clients' | 'catalogue';

interface Report {
  id: string;
  titleKey: string;
  descKey: string;
  category: ReportCategory;
  isPremium: boolean;
  icon: typeof BarChart3;
}

const REPORTS: Report[] = [
  { id: 'performance-dashboard', titleKey: 'performanceDashboard', descKey: 'performanceDashboardDesc', category: 'all', isPremium: false, icon: TrendingUp },
  { id: 'online-dashboard', titleKey: 'onlineDashboard', descKey: 'onlineDashboardDesc', category: 'all', isPremium: false, icon: BarChart3 },
  { id: 'loyalty-dashboard', titleKey: 'loyaltyDashboard', descKey: 'loyaltyDashboardDesc', category: 'all', isPremium: false, icon: Heart },
  { id: 'performance-summary', titleKey: 'performanceSummary', descKey: 'performanceSummaryDesc', category: 'all', isPremium: true, icon: TrendingUp },
  { id: 'performance-over-time', titleKey: 'performanceOverTime', descKey: 'performanceOverTimeDesc', category: 'all', isPremium: true, icon: BarChart3 },
  { id: 'sales-summary', titleKey: 'salesSummary', descKey: 'salesSummaryDesc', category: 'sales', isPremium: false, icon: DollarSign },
  { id: 'sales-by-service', titleKey: 'salesByService', descKey: 'salesByServiceDesc', category: 'sales', isPremium: false, icon: DollarSign },
  { id: 'sales-by-product', titleKey: 'salesByProduct', descKey: 'salesByProductDesc', category: 'sales', isPremium: false, icon: ShoppingBag },
  { id: 'sales-by-team', titleKey: 'salesByTeam', descKey: 'salesByTeamDesc', category: 'sales', isPremium: false, icon: Users },
  { id: 'daily-sales', titleKey: 'dailySales', descKey: 'dailySalesDesc', category: 'sales', isPremium: false, icon: DollarSign },
  { id: 'discount-summary', titleKey: 'discountSummary', descKey: 'discountSummaryDesc', category: 'sales', isPremium: false, icon: DollarSign },
  { id: 'tax-summary', titleKey: 'taxSummary', descKey: 'taxSummaryDesc', category: 'finance', isPremium: false, icon: Briefcase },
  { id: 'payment-summary', titleKey: 'paymentSummary', descKey: 'paymentSummaryDesc', category: 'finance', isPremium: false, icon: DollarSign },
  { id: 'tips-report', titleKey: 'tipsReport', descKey: 'tipsReportDesc', category: 'finance', isPremium: false, icon: DollarSign },
  { id: 'gift-card-report', titleKey: 'giftCardReport', descKey: 'giftCardReportDesc', category: 'finance', isPremium: false, icon: DollarSign },
  { id: 'expense-report', titleKey: 'expenseReport', descKey: 'expenseReportDesc', category: 'finance', isPremium: false, icon: Briefcase },
  { id: 'appointments-summary', titleKey: 'appointmentsSummary', descKey: 'appointmentsSummaryDesc', category: 'appointments', isPremium: false, icon: CalendarDays },
  { id: 'cancellation-report', titleKey: 'cancellationReport', descKey: 'cancellationReportDesc', category: 'appointments', isPremium: false, icon: CalendarDays },
  { id: 'no-show-report', titleKey: 'noShowReport', descKey: 'noShowReportDesc', category: 'appointments', isPremium: false, icon: CalendarDays },
  { id: 'booking-sources', titleKey: 'bookingSources', descKey: 'bookingSourcesDesc', category: 'appointments', isPremium: false, icon: CalendarDays },
  { id: 'team-performance', titleKey: 'teamPerformance', descKey: 'teamPerformanceDesc', category: 'team', isPremium: false, icon: Users },
  { id: 'team-commission', titleKey: 'teamCommission', descKey: 'teamCommissionDesc', category: 'team', isPremium: false, icon: Users },
  { id: 'team-hours', titleKey: 'teamHours', descKey: 'teamHoursDesc', category: 'team', isPremium: false, icon: Users },
  { id: 'client-list-report', titleKey: 'clientListReport', descKey: 'clientListReportDesc', category: 'clients', isPremium: false, icon: Users },
  { id: 'client-retention', titleKey: 'clientRetention', descKey: 'clientRetentionDesc', category: 'clients', isPremium: false, icon: Users },
  { id: 'new-clients-report', titleKey: 'newClientsReport', descKey: 'newClientsReportDesc', category: 'clients', isPremium: false, icon: Users },
  { id: 'product-stock', titleKey: 'productStock', descKey: 'productStockDesc', category: 'catalogue', isPremium: false, icon: ShoppingBag },
  { id: 'inventory-usage', titleKey: 'inventoryUsage', descKey: 'inventoryUsageDesc', category: 'catalogue', isPremium: false, icon: ShoppingBag },
];

const SIDEBAR_ITEMS: { key: string; labelKey: string; count: number }[] = [
  { key: 'all', labelKey: 'allReports', count: REPORTS.length },
  { key: 'favorites', labelKey: 'favorites', count: 0 },
];

const CATEGORY_FILTERS: { key: ReportCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'catAll' },
  { key: 'sales', labelKey: 'catSales' },
  { key: 'finance', labelKey: 'catFinance' },
  { key: 'appointments', labelKey: 'catAppointments' },
  { key: 'team', labelKey: 'catTeam' },
  { key: 'clients', labelKey: 'catClients' },
  { key: 'catalogue', labelKey: 'catCatalogue' },
];

export default function AnalyticsReportsPage() {
  const t = useTranslations('analytics');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

  const [sidebarItem, setSidebarItem] = useState('all');
  const [category, setCategory] = useState<ReportCategory>('all');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filteredReports = REPORTS.filter(r => {
    if (sidebarItem === 'favorites' && !favorites.has(r.id)) return false;
    if (sidebarItem === 'standard' && r.isPremium) return false;
    if (sidebarItem === 'premium' && !r.isPremium) return false;
    if (category !== 'all' && r.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      const title = t(r.titleKey).toLowerCase();
      const desc = t(r.descKey).toLowerCase();
      if (!title.includes(s) && !desc.includes(s)) return false;
    }
    return true;
  });

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: FONT, backgroundColor: C.pageBg, padding: '32px 40px' }}>
      {/* Left sidebar — matches flyout panel style */}
      <div style={{
        width: 240,
        minWidth: 240,
        borderRight: `0.8px solid ${C.sidebarBorder}`,
        padding: '16px 0',
        backgroundColor: C.sidebarBg,
        flexShrink: 0,
        overflowY: 'auto',
      }}>
        <div style={{ padding: '4px 20px 12px', fontSize: 11, fontWeight: 600, color: C.sidebarTextMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('title')}
        </div>
        {SIDEBAR_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => { setSidebarItem(item.key); if (item.key === 'favorites') setCategory('all'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 20px',
              fontSize: 15,
              fontWeight: sidebarItem === item.key ? 600 : 400,
              color: C.sidebarText,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: FONT,
              borderRadius: 0,
              transition: 'background-color 100ms',
              lineHeight: '22px',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.sidebarHover; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span>{t(item.labelKey)}</span>
            <span style={{ fontSize: 13, color: C.sidebarTextSecondary }}>{item.key === 'favorites' ? favorites.size : item.count}</span>
          </button>
        ))}

        <div style={{ borderTop: `0.8px solid ${C.divider}`, margin: '8px 20px' }} />

        <div style={{ padding: '4px 20px 12px', fontSize: 11, fontWeight: 600, color: C.sidebarTextMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('categories')}
        </div>
        <button
          onClick={() => { setSidebarItem('standard'); setCategory('all'); }}
          style={{
            display: 'block', width: '100%', padding: '10px 20px', fontSize: 15, fontWeight: 400,
            color: C.sidebarText, backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left', fontFamily: FONT, lineHeight: '22px', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.sidebarHover; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {t('standard')} <span style={{ color: C.sidebarTextSecondary }}>({REPORTS.filter(r => !r.isPremium).length})</span>
        </button>
        <button
          onClick={() => { setSidebarItem('premium'); setCategory('all'); }}
          style={{
            display: 'block', width: '100%', padding: '10px 20px', fontSize: 15, fontWeight: 400,
            color: C.sidebarText, backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left', fontFamily: FONT, lineHeight: '22px', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.sidebarHover; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {t('premium')} <span style={{ color: C.sidebarTextSecondary }}>({REPORTS.filter(r => r.isPremium).length})</span>
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, lineHeight: '32px', margin: 0 }}>
              {t('reportingAndAnalytics')}
            </h1>
            <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
              {filteredReports.length} {t('reportsAvailable')}
            </p>
          </div>
        </div>

        {/* Search + Category filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: 14,
                fontFamily: FONT,
                border: C.cardBorder,
                borderRadius: 6,
                backgroundColor: C.searchBg,
                color: C.text,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CATEGORY_FILTERS.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: category === cat.key ? 600 : 400,
                  color: category === cat.key ? '#fff' : C.textSecondary,
                  backgroundColor: category === cat.key ? C.accent : 'transparent',
                  border: category === cat.key ? 'none' : C.cardBorder,
                  borderRadius: 16,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.15s',
                }}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredReports.map((report, i) => {
            const Icon = report.icon;
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  backgroundColor: C.cardBg,
                  border: C.cardBorder,
                  borderRadius: 8,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = mounted && resolvedTheme === 'dark' ? '#222' : '#f9f9f9')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.cardBg)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      backgroundColor: mounted && resolvedTheme === 'dark' ? '#222' : '#f0f0f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={20} style={{ color: C.accent }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: '20px' }}>
                        {t(report.titleKey)}
                      </div>
                      <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4, lineHeight: '18px' }}>
                        {t(report.descKey)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {report.isPremium && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: C.premiumBadge,
                        padding: '2px 8px',
                        borderRadius: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {t('premiumLabel')}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(report.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: favorites.has(report.id) ? '#f59e0b' : C.textMuted,
                      }}
                      title={t('addToFavorites')}
                    >
                      <Star size={16} fill={favorites.has(report.id) ? '#f59e0b' : 'none'} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredReports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMuted }}>
            <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>{t('noResults')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
