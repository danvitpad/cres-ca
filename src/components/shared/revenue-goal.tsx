/** --- YAML
 * name: RevenueGoal
 * description: Revenue goal progress bar with projections and gamification
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface RevenueGoalProps {
  masterId: string;
  goal: number | null;
  currency?: string;
}

export function RevenueGoal({ masterId, goal, currency = 'UAH' }: RevenueGoalProps) {
  const t = useTranslations('revenueGoal');
  const [currentRevenue, setCurrentRevenue] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [freeSlotsEstimate, setFreeSlotsEstimate] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Revenue this month
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('master_id', masterId)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const revenue = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
      setCurrentRevenue(revenue);

      // Completed appointments this month
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('master_id', masterId)
        .eq('status', 'completed')
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString());

      setAppointmentCount(count ?? 0);

      // Estimate remaining free slots (days left * avg slots per day)
      const daysLeft = monthEnd.getDate() - now.getDate();
      const daysPassed = now.getDate();
      const avgPerDay = daysPassed > 0 ? (count ?? 0) / daysPassed : 0;
      setFreeSlotsEstimate(Math.round(daysLeft * Math.max(avgPerDay * 1.5, 2) - (daysLeft * avgPerDay)));
    }
    load();
  }, [masterId]);

  if (!goal || goal <= 0) return null;

  const percent = Math.min((currentRevenue / goal) * 100, 100);
  const remaining = Math.max(goal - currentRevenue, 0);
  const avgCheck = appointmentCount > 0 ? currentRevenue / appointmentCount : 0;
  const clientsNeeded = avgCheck > 0 ? Math.ceil(remaining / avgCheck) : 0;

  // Projection: linear
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedRevenue = dayOfMonth > 0 ? (currentRevenue / dayOfMonth) * daysInMonth : 0;
  const onTrack = projectedRevenue >= goal;
  const behindPercent = goal > 0 ? ((goal - projectedRevenue) / goal) * 100 : 0;

  const statusColor = onTrack
    ? 'text-emerald-600'
    : behindPercent > 30
      ? 'text-red-600'
      : 'text-amber-600';

  const barColor = onTrack
    ? 'bg-emerald-500'
    : behindPercent > 30
      ? 'bg-red-500'
      : 'bg-amber-500';

  return (
    <div className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-3">
        <Target className={cn('h-5 w-5', statusColor)} />
        <h3 className="text-sm font-semibold">{t('monthlyGoal')}</h3>
      </div>

      {/* Amount display */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{currentRevenue.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">/ {goal.toLocaleString()} {currency}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden mb-3">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {avgCheck > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {t('needClients', { count: clientsNeeded, avgCheck: Math.round(avgCheck) })}
          </div>
        )}
        {freeSlotsEstimate > 0 && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {t('freeSlots', { count: freeSlotsEstimate })}
          </div>
        )}
      </div>

      {/* Status text */}
      <p className={cn('mt-2 text-xs font-medium', statusColor)}>
        {onTrack ? t('onTrack') : behindPercent > 30 ? t('behind') : t('slightlyBehind')}
      </p>
    </div>
  );
}
