/** --- YAML
 * name: DashboardKpiStrip
 * description: Компактная полоса с 5 ключевыми KPI для главной dashboard (выручка сегодня/неделя/месяц, загрузка, следующая запись). Тянет данные из Supabase за период и считает локально.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar as CalendarIcon, Percent, Clock, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { startOfDay, endOfDay, startOfWeek, startOfMonth, format, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dfLocales: Record<string, Locale> = { ru, uk, en: enUS };

interface Props {
  masterId: string | null;
  workingHours: Record<string, { start: string; end: string } | null> | null;
  theme: 'light' | 'dark';
}

interface Row {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number | null;
}

function parseHours(wh: Props['workingHours'], day: Date): number {
  if (!wh) return 0;
  const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day.getDay()];
  const slot = wh[dow];
  if (!slot) return 0;
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  return Math.max(0, eh + em / 60 - sh - sm / 60);
}

export function DashboardKpiStrip({ masterId, workingHours, theme }: Props) {
  const t = useTranslations('dashboardKpi');
  const locale = useLocale();
  const df = dfLocales[locale] || ru;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!masterId) return;
    const supabase = createClient();
    (async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = new Date();
      monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price')
        .eq('master_id', masterId)
        .gte('starts_at', monthStart)
        .lte('starts_at', monthEnd.toISOString())
        .order('starts_at', { ascending: true });
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [masterId]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    let rToday = 0, rWeek = 0, rMonth = 0;
    let bookedMinsToday = 0;
    let nextApt: Row | null = null;

    for (const r of rows) {
      const d = new Date(r.starts_at);
      const completed = r.status === 'completed';
      const active = r.status !== 'cancelled';
      if (completed) {
        if (d >= todayStart && d <= todayEnd) rToday += r.price || 0;
        if (d >= weekStart) rWeek += r.price || 0;
        if (d >= monthStart) rMonth += r.price || 0;
      }
      if (active && d >= todayStart && d <= todayEnd) {
        const ends = new Date(r.ends_at).getTime();
        const starts = d.getTime();
        bookedMinsToday += Math.max(0, (ends - starts) / 60000);
      }
      if (active && d > now && (!nextApt || d < new Date(nextApt.starts_at))) {
        nextApt = r;
      }
    }

    const todayHours = parseHours(workingHours, now);
    const utilization = todayHours > 0 ? Math.min(100, Math.round((bookedMinsToday / (todayHours * 60)) * 100)) : 0;

    return { rToday, rWeek, rMonth, utilization, nextApt };
  }, [rows, workingHours]);

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#181818' : '#ffffff';
  const cardBorder = isDark ? '0.8px solid #333' : '0.8px solid #e5e5e5';
  const textPrimary = isDark ? '#f5f5f5' : '#0d0d0d';
  const textMuted = isDark ? '#a3a3a3' : '#737373';
  const accent = '#6950f3';

  function fmtMoney(n: number) {
    return new Intl.NumberFormat(locale, { style: 'decimal', maximumFractionDigits: 0 }).format(n) + ' ₴';
  }

  const kpis = [
    { icon: TrendingUp, label: t('today'), value: loading ? '—' : fmtMoney(stats.rToday) },
    { icon: CalendarIcon, label: t('week'), value: loading ? '—' : fmtMoney(stats.rWeek) },
    { icon: CalendarDays, label: t('month'), value: loading ? '—' : fmtMoney(stats.rMonth) },
    { icon: Percent, label: t('utilization'), value: loading ? '—' : `${stats.utilization}%` },
    {
      icon: Clock,
      label: t('nextAppointment'),
      value: loading
        ? '—'
        : stats.nextApt
          ? format(new Date(stats.nextApt.starts_at), 'HH:mm · dd MMM', { locale: df })
          : t('none'),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              backgroundColor: cardBg,
              border: cardBorder,
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div className="flex items-center gap-2" style={{ color: textMuted, fontSize: 12 }}>
              <Icon style={{ width: 14, height: 14, color: accent }} />
              {kpi.label}
            </div>
            <div style={{ color: textPrimary, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
              {kpi.value}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
