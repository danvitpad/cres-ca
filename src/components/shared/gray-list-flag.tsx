/** --- YAML
 * name: Gray-list flag
 * description: Small warning badge shown next to client names who have 2+ no-shows. Master can still book them but gets a warning + option to require deposit (Phase 2).
 * created: 2026-04-24
 * --- */

import { AlertTriangle } from 'lucide-react';

export function GrayListFlag({
  noShowCount,
  threshold = 2,
  variant = 'pill',
}: {
  noShowCount: number;
  threshold?: number;
  variant?: 'pill' | 'icon' | 'row';
}) {
  if (noShowCount < threshold) return null;

  if (variant === 'icon') {
    return (
      <span title={`${noShowCount} no-show — рекомендуется предоплата`} className="inline-flex text-amber-400">
        <AlertTriangle className="size-3.5" />
      </span>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[12px] text-amber-200">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <strong>Рискованный клиент:</strong> {noShowCount} пропусков. Рекомендуется взять предоплату при записи.
        </div>
      </div>
    );
  }

  return (
    <span
      title={`${noShowCount} no-show`}
      className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
    >
      <AlertTriangle className="size-2.5" />
      {noShowCount}×
    </span>
  );
}
