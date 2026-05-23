/** --- YAML
 * name: ComplaintsClient
 * description: UI for /superadmin/complaints — табы по статусу, карточки жалоб
 *              с действиями «В работу» / «Закрыть» / «Открыть заново».
 * created: 2026-04-30
 * --- */

'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flag, Mail, Phone, Calendar as CalendarIcon, Check } from 'lucide-react';

interface ComplaintRow {
  id: string;
  reporter_id: string;
  master_id: string;
  appointment_id: string | null;
  reason_code: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  resolution_note: string | null;
  closed_at: string | null;
  created_at: string;
  reporter_name: string | null;
  reporter_email: string | null;
  master_name: string | null;
  master_email: string | null;
}

const REASON_LABELS: Record<string, string> = {
  no_show: 'Мастер не пришёл',
  rude: 'Хамство / неуважение',
  wrong_service: 'Сделал не ту услугу',
  dirty: 'Антисанитария / грязь',
  overpriced: 'Завышенная цена',
  other: 'Другое',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Открыта',
  in_progress: 'В работе',
  closed: 'Закрыта',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  in_progress: 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]',
  closed: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
};

export function ComplaintsClient({ rows }: { rows: ComplaintRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'open' | 'in_progress' | 'closed'>('open');
  const [, startTransition] = useTransition();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter(r => r.status === tab), [rows, tab]);

  const counts = useMemo(() => ({
    open: rows.filter(r => r.status === 'open').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    closed: rows.filter(r => r.status === 'closed').length,
  }), [rows]);

  const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'closed', resolutionNote?: string) => {
    setSubmittingId(id);
    try {
      const res = await fetch(`/api/superadmin/complaints/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution_note: resolutionNote ?? null }),
      });
      if (res.ok) {
        toast.success('Статус обновлён');
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['open', 'in_progress', 'closed'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-medium transition-colors ${
              tab === t
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/5 bg-transparent text-white/55 hover:bg-white/5'
            }`}
          >
            {STATUS_LABELS[t]}
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/5 text-white/30">
            <Flag className="size-5" />
          </div>
          <p className="text-[13px] text-white/55">
            {tab === 'open' && 'Открытых жалоб нет.'}
            {tab === 'in_progress' && 'В работе ничего нет.'}
            {tab === 'closed' && 'Закрытых жалоб пока не было.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ComplaintCard
              key={r.id}
              row={r}
              busy={submittingId === r.id}
              onUpdate={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({
  row,
  busy,
  onUpdate,
}: {
  row: ComplaintRow;
  busy: boolean;
  onUpdate: (id: string, status: 'open' | 'in_progress' | 'closed', note?: string) => void;
}) {
  const [closingNote, setClosingNote] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);

  const created = new Date(row.created_at);

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[row.status]}`}>
            {STATUS_LABELS[row.status]}
          </span>
          <span className="text-[12px] text-white/40">
            <CalendarIcon className="mr-1 inline size-3 -mt-0.5" />
            {created.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
        <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-white/55">
          {REASON_LABELS[row.reason_code] ?? row.reason_code}
        </span>
      </div>

      {/* Reporter / Master */}
      <div className="mb-3 grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-white/40">От</div>
          <div className="font-medium text-white">{row.reporter_name ?? '—'}</div>
          <div className="flex items-center gap-1 text-white/55">
            <Mail className="size-3" />
            {row.reporter_email ?? '—'}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-white/40">На мастера</div>
          <div className="font-medium text-white">{row.master_name ?? '—'}</div>
          <div className="flex items-center gap-1 text-white/55">
            <Phone className="size-3" />
            {row.master_email ?? '—'}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[13px] text-white/80">
        {row.description}
      </div>

      {/* Resolution note (если есть) */}
      {row.resolution_note && (
        <div className="mb-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 p-3 text-[12px] text-emerald-200">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-emerald-300/70">Решение</div>
          {row.resolution_note}
        </div>
      )}

      {/* Actions */}
      {!showCloseForm ? (
        <div className="flex flex-wrap gap-2">
          {row.status === 'open' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onUpdate(row.id, 'in_progress')}
                className="h-8 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 text-[12px] font-medium text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)]/15 disabled:opacity-50"
              >
                Принять в работу
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowCloseForm(true)}
                className="h-8 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                Закрыть
              </button>
            </>
          )}
          {row.status === 'in_progress' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCloseForm(true)}
              className="h-8 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
            >
              Закрыть
            </button>
          )}
          {row.status === 'closed' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(row.id, 'open')}
              className="h-8 rounded-md border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              Открыть заново
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={closingNote}
            onChange={e => setClosingNote(e.target.value)}
            placeholder="Комментарий к закрытию (необязательно)"
            rows={2}
            className="w-full resize-none rounded-md border border-white/10 bg-white/[0.04] p-2 text-[12px] text-white placeholder-white/30 outline-none focus:border-emerald-400/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onUpdate(row.id, 'closed', closingNote.trim() || undefined);
                setShowCloseForm(false);
                setClosingNote('');
              }}
              className="h-8 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
            >
              <Check className="mr-1 inline size-3 -mt-0.5" />
              Подтвердить закрытие
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setShowCloseForm(false); setClosingNote(''); }}
              className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] font-medium text-white/70 hover:bg-white/[0.08]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
