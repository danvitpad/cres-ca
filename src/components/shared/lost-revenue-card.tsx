/** --- YAML
 * name: LostRevenueCard
 * description: AI-подсказки по доходу. Карусель из 1 карточки за раз
 *              со стрелками + точками-индикаторами. Компактные карточки —
 *              убран дубль текста (title служит заголовком, action — кнопкой).
 * updated: 2026-05-01
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Calendar, Users, TrendingUp, ShoppingBag,
  ChevronRight, RefreshCw, ChevronLeft,
} from 'lucide-react';
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
  schedule_gaps: 'text-[var(--color-accent)] bg-[var(--color-accent-soft)] dark:text-[var(--color-accent-text)] dark:bg-[var(--color-accent-soft)]',
  dormant_clients: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  price_optimization: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  upsell_missed: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
};

export function LostRevenueCard() {
  const t = useTranslations('finance');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

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

  // Когда подсказки обновились — сбрасываем активный индекс на первую,
  // чтобы пользователь не залип на пустом слайде после рефреша.
  useEffect(() => {
    if (activeIdx >= insights.length) setActiveIdx(0);
  }, [insights, activeIdx]);

  const total = insights.length;
  const current = total > 0 ? insights[activeIdx] : null;
  const goPrev = () => setActiveIdx((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIdx((i) => (i + 1) % total);

  return (
    <div className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ds-accent-soft)] text-[var(--ds-accent)] shrink-0">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">{t('aiInsights')}</h3>
            {total > 1 && (
              <p className="text-[11px] text-muted-foreground leading-tight">
                {activeIdx + 1} из {total}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchInsights}
          disabled={loading}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Обновить"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : !current ? (
          <p className="py-3 text-center text-sm text-muted-foreground">{t('noInsights')}</p>
        ) : (
          <div className="flex items-stretch gap-2">
            {/* Prev arrow (only if more than 1) */}
            {total > 1 && (
              <button
                type="button"
                onClick={goPrev}
                className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted self-center"
                aria-label="Назад"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${current.type}-${activeIdx}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex-1 min-w-0 rounded-lg border p-3"
              >
                {/* Заголовок + конкретное действие. Раньше было 3 строки
                    (title + description + action) — два из них дублировали
                    друг друга. Оставляем только заголовок и action. */}
                <div className="flex items-start gap-2">
                  <div className={cn('mt-0.5 rounded-md p-1', typeColors[current.type])}>
                    {typeIcons[current.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{current.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">
                      {current.action}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Next arrow */}
            {total > 1 && (
              <button
                type="button"
                onClick={goNext}
                className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted self-center"
                aria-label="Вперёд"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Dots */}
        {total > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {insights.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`Подсказка ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === activeIdx
                    ? 'w-5 bg-[var(--ds-accent)]'
                    : 'w-1.5 bg-muted hover:bg-muted-foreground/40',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
