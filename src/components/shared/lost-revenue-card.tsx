/** --- YAML
 * name: LostRevenueCard
 * description: AI-powered revenue insights card for the finance dashboard
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Calendar, Users, TrendingUp, ShoppingBag, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  type: 'schedule_gaps' | 'dormant_clients' | 'price_optimization' | 'upsell_missed';
  title: string;
  description: string;
  action: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  schedule_gaps: <Calendar className="h-4 w-4" />,
  dormant_clients: <Users className="h-4 w-4" />,
  price_optimization: <TrendingUp className="h-4 w-4" />,
  upsell_missed: <ShoppingBag className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  schedule_gaps: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  dormant_clients: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  price_optimization: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  upsell_missed: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
};

export function LostRevenueCard() {
  const t = useTranslations('finance');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInsights() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/lost-revenue');
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t('aiInsights')}</h3>
            <p className="text-xs text-muted-foreground">{t('aiInsightsDescription')}</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('noInsights')}</p>
        ) : (
          <AnimatePresence mode="popLayout">
            {insights.map((insight, i) => (
              <motion.div
                key={`${insight.type}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className={cn('mt-0.5 rounded-md p-1.5', typeColors[insight.type])}>
                    {typeIcons[insight.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
                <button className="flex w-full items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-[var(--ds-accent)] transition-colors hover:bg-muted">
                  {insight.action}
                  <ChevronRight className="ml-auto h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
