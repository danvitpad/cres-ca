/** --- YAML
 * name: AnalyticsDrawerContent
 * description: Fresha-style performance analytics drawer — time tabs, sales summary, channel breakdown charts
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, Users, CreditCard, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { FONT } from '@/lib/dashboard-theme';

const LIGHT = {
  bg: '#ffffff',
  text: '#000000',
  textMuted: '#737373',
  border: '#e5e5e5',
  accent: 'var(--color-accent)',
  accentSoft: '#f0eefe',
  success: '#22c55e',
  successSoft: '#f0fdf4',
  danger: '#d4163a',
  dangerSoft: '#fef2f2',
  cardBg: '#f9f9f9',
  chartBar: 'var(--color-accent)',
  chartBarMuted: '#e5e5e5',
  purpleCard: 'var(--color-accent)',
  purpleCardText: '#ffffff',
};

const DARK = {
  bg: '#000000',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  border: '#1a1a1a',
  accent: '#2dd4bf',
  accentSoft: '#2a2545',
  success: '#22c55e',
  successSoft: '#052e16',
  danger: '#ef4444',
  dangerSoft: '#450a0a',
  cardBg: '#000000',
  chartBar: '#2dd4bf',
  chartBarMuted: '#1a1a1a',
  purpleCard: 'var(--color-accent)',
  purpleCardText: '#ffffff',
};

const TIME_TABS = [
  { key: 'yesterday', label: 'Вчера' },
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
] as const;

const CHANNELS = [
  { key: 'online', label: 'Онлайн запись', color: 'var(--color-accent)' },
  { key: 'manual', label: 'Ручная запись', color: '#f59e0b' },
  { key: 'telegram', label: 'Telegram', color: '#0ea5e9' },
  { key: 'walk_in', label: 'Без записи', color: '#2dd4bf' },
];

interface AnalyticsDrawerContentProps {
  masterId: string;
  theme?: 'light' | 'dark';
}

interface SalesData {
  totalSales: number;
  totalAppointments: number;
  completedAppointments: number;
  uniqueClients: number;
  avgCheck: number;
  trend: number; // percentage vs previous period
  channelBreakdown: Array<{ channel: string; count: number; amount: number }>;
}

interface UpcomingData {
  scheduledAppointments: number;
  channelBreakdown: Array<{ channel: string; count: number }>;
}

function getDateRange(tab: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  switch (tab) {
    case 'yesterday': {
      const ys = new Date(todayStart);
      ys.setDate(ys.getDate() - 1);
      return { start: ys, end: todayStart };
    }
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'week': {
      const ws = new Date(todayStart);
      ws.setDate(ws.getDate() - 7);
      return { start: ws, end: todayEnd };
    }
    case 'month': {
      const ms = new Date(todayStart);
      ms.setMonth(ms.getMonth() - 1);
      return { start: ms, end: todayEnd };
    }
    default:
      return { start: todayStart, end: todayEnd };
  }
}

function SimpleBar({ value, max, color, bgColor }: { value: number; max: number; color: string; bgColor: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 8, borderRadius: 4, backgroundColor: bgColor, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
    </div>
  );
}

export function AnalyticsDrawerContent({ masterId, theme = 'light' }: AnalyticsDrawerContentProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [activeTab, setActiveTab] = useState<string>('today');
  const [sales, setSales] = useState<SalesData | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { start, end } = getDateRange(activeTab);

      // Fetch all appointments for the period with booked_via and client_id
      const { data: allAppts } = await supabase
        .from('appointments')
        .select('id, starts_at, status, price, currency, booked_via, client_id')
        .eq('master_id', masterId)
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString());

      const all = allAppts || [];
      const completed = all.filter(a => a.status === 'completed');

      const totalSales = completed.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const avgCheck = completed.length > 0 ? totalSales / completed.length : 0;
      const uniqueClients = new Set(completed.map(a => a.client_id)).size;

      // Real channel breakdown from booked_via field
      const channelMap: Record<string, string> = { web: 'online', manual: 'manual', telegram: 'telegram' };
      const channelCounts: Record<string, { count: number; amount: number }> = {
        online: { count: 0, amount: 0 }, manual: { count: 0, amount: 0 },
        telegram: { count: 0, amount: 0 }, walk_in: { count: 0, amount: 0 },
      };
      for (const a of all) {
        const ch = channelMap[a.booked_via as string] || 'walk_in';
        channelCounts[ch].count++;
        if (a.status === 'completed') channelCounts[ch].amount += Number(a.price) || 0;
      }

      // Trend: compare with previous equivalent period
      const periodMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodMs);
      const prevEnd = new Date(start);
      const { data: prevAppts } = await supabase
        .from('appointments')
        .select('id')
        .eq('master_id', masterId)
        .gte('starts_at', prevStart.toISOString())
        .lt('starts_at', prevEnd.toISOString());
      const prevCount = (prevAppts || []).length;
      const trend = prevCount > 0 ? Math.round(((all.length - prevCount) / prevCount) * 100) : 0;

      setSales({
        totalSales,
        totalAppointments: all.length,
        completedAppointments: completed.length,
        uniqueClients,
        avgCheck: Math.round(avgCheck),
        trend,
        channelBreakdown: Object.entries(channelCounts).map(([channel, data]) => ({
          channel, count: data.count, amount: Math.round(data.amount),
        })),
      });

      // Fetch upcoming 7 days with real booked_via
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 7);
      const { data: upcomingAppts } = await supabase
        .from('appointments')
        .select('id, status, booked_via')
        .eq('master_id', masterId)
        .gte('starts_at', new Date().toISOString())
        .lt('starts_at', futureEnd.toISOString())
        .in('status', ['booked', 'confirmed']);

      const upAll = upcomingAppts || [];
      const upChannelCounts: Record<string, number> = { online: 0, manual: 0, telegram: 0, walk_in: 0 };
      for (const a of upAll) {
        const ch = channelMap[a.booked_via as string] || 'walk_in';
        upChannelCounts[ch]++;
      }
      setUpcoming({
        scheduledAppointments: upAll.length,
        channelBreakdown: Object.entries(upChannelCounts).map(([channel, count]) => ({ channel, count })),
      });

      setLoading(false);
    }
    load();
  }, [masterId, activeTab]);

  const maxChannel = sales ? Math.max(...sales.channelBreakdown.map(c => c.count), 1) : 1;
  const maxUpcoming = upcoming ? Math.max(...upcoming.channelBreakdown.map(c => c.count), 1) : 1;

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      {/* Time tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 0 16px', borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {TIME_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? C.purpleCardText : C.textMuted,
              backgroundColor: activeTab === tab.key ? C.accent : 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 12, backgroundColor: C.cardBg, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Sales summary section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Сводка за {TIME_TABS.find(t => t.key === activeTab)?.label.toLowerCase()}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {/* Total sales */}
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <CreditCard style={{ width: 14, height: 14, color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>Всего продаж</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sales?.totalSales || 0} ₴</div>
                {(sales?.trend || 0) !== 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    {sales!.trend > 0 ? (
                      <TrendingUp style={{ width: 12, height: 12, color: C.success }} />
                    ) : (
                      <TrendingDown style={{ width: 12, height: 12, color: C.danger }} />
                    )}
                    <span style={{ fontSize: 11, color: sales!.trend > 0 ? C.success : C.danger, fontWeight: 600 }}>
                      {sales!.trend > 0 ? '+' : ''}{sales!.trend}%
                    </span>
                  </div>
                )}
              </div>

              {/* Appointments count */}
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Calendar style={{ width: 14, height: 14, color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>Записи</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sales?.totalAppointments || 0}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {sales?.completedAppointments || 0} завершено
                </div>
              </div>

              {/* Avg check */}
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <BarChart3 style={{ width: 14, height: 14, color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>Средний чек</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sales?.avgCheck || 0} ₴</div>
              </div>

              {/* Clients served */}
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Users style={{ width: 14, height: 14, color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>Клиентов</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sales?.uniqueClients || 0}</div>
              </div>
            </div>

            {/* Channel breakdown */}
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>Продажи по каналам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CHANNELS.map((ch) => {
                const data = sales?.channelBreakdown.find(c => c.channel === ch.key);
                return (
                  <div key={ch.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ch.color }} />
                        <span style={{ fontSize: 13, color: C.text }}>{ch.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data?.count || 0}</span>
                    </div>
                    <SimpleBar value={data?.count || 0} max={maxChannel} color={ch.color} bgColor={C.chartBarMuted} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming 7 days - purple card */}
          <div style={{
            padding: 20,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${C.purpleCard}, ${C.purpleCard}dd)`,
            color: C.purpleCardText,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginBottom: 8 }}>Следующие 7 дней</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
              {upcoming?.scheduledAppointments || 0}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>запланированных записей</div>

            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8 }}>Записи по каналам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CHANNELS.map((ch) => {
                const data = upcoming?.channelBreakdown.find(c => c.channel === ch.key);
                return (
                  <div key={ch.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, opacity: 0.9 }}>{ch.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{data?.count || 0}</span>
                    </div>
                    <SimpleBar value={data?.count || 0} max={maxUpcoming} color="rgba(255,255,255,0.7)" bgColor="rgba(255,255,255,0.2)" />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
