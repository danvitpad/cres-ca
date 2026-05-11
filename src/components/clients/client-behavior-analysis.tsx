/** --- YAML
 * name: ClientBehaviorAnalysis
 * description: One-click AI behaviour analysis card for a client. Hidden by
 *   default — clicking the button calls /behavior-analysis and reveals the
 *   risk level, VIP-readiness, summary, recommendations. MAX-tier feature.
 * created: 2026-05-01
 * --- */

'use client';

import { useState } from 'react';
import { Brain, Loader2, AlertTriangle, Crown, Lightbulb, RefreshCw } from 'lucide-react';

interface Analysis {
  risk_level: 'low' | 'medium' | 'high';
  vip_readiness: 'yes' | 'maybe' | 'no';
  summary: string;
  recommendations: string[];
}

interface Stats {
  visits_total: number;
  visits_last_90d: number;
  total_spent: number;
  avg_check: number;
  days_since_last_visit: number | null;
  avg_interval_days: number | null;
}

interface ApiResponse {
  stats: Stats;
  analysis: Analysis;
  ai_used: boolean;
  error?: string;
}

const RISK_LABELS: Record<Analysis['risk_level'], { label: string; color: string; bg: string }> = {
  low:    { label: 'низкий',  color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  medium: { label: 'средний', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  high:   { label: 'высокий', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
};

const VIP_LABELS: Record<Analysis['vip_readiness'], { label: string; color: string; bg: string }> = {
  yes:   { label: 'да, готов',     color: '#a855f7', bg: 'rgba(168,85,247,0.10)' },
  maybe: { label: 'возможно',      color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  no:    { label: 'пока рано',     color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
};

export function ClientBehaviorAnalysis({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/behavior-analysis`, { method: 'POST' });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || json.error) {
        setError(json.error ?? 'Не удалось получить анализ. Попробуйте через минуту.');
        return;
      }
      setData(json);
    } catch {
      setError('Не удалось связаться с AI. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  if (!data && !loading && !error) {
    return (
      <button
        type="button"
        onClick={run}
        className="w-full rounded-xl border bg-card hover:bg-accent/50 transition px-4 py-3 flex items-center gap-3 text-left group"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
          <Brain className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">AI-анализ поведения клиента</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Риск ухода, готовность стать VIP, что предложить
          </div>
        </div>
        <Lightbulb className="w-4 h-4 text-violet-500 group-hover:scale-110 transition" />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-6 flex items-center gap-3 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        AI анализирует поведение клиента…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
        <button onClick={run} className="text-xs text-violet-600 mt-2 underline">
          Попробовать ещё раз
        </button>
      </div>
    );
  }

  if (!data) return null;

  const risk = RISK_LABELS[data.analysis.risk_level];
  const vip = VIP_LABELS[data.analysis.vip_readiness];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">AI-анализ поведения</span>
        </div>
        <button onClick={run} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Риск ухода
          </div>
          <div
            className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
            style={{ color: risk.color, background: risk.bg }}
          >
            {risk.label}
          </div>
        </div>
        <div className="bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Crown className="h-3 w-3" /> VIP-готовность
          </div>
          <div
            className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
            style={{ color: vip.color, background: vip.bg }}
          >
            {vip.label}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 text-sm leading-relaxed">{data.analysis.summary}</div>

      {data.analysis.recommendations.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Что сделать
          </div>
          <ul className="space-y-1.5">
            {data.analysis.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-violet-500 shrink-0">→</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-px bg-border border-t">
        <div className="bg-card p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Визитов</div>
          <div className="text-base font-semibold tabular-nums mt-0.5">{data.stats.visits_total}</div>
        </div>
        <div className="bg-card p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Средний чек</div>
          <div className="text-base font-semibold tabular-nums mt-0.5">{data.stats.avg_check.toLocaleString()} ₴</div>
        </div>
        <div className="bg-card p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Дней назад</div>
          <div className="text-base font-semibold tabular-nums mt-0.5">
            {data.stats.days_since_last_visit ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
