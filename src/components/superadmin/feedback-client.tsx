/** --- YAML
 * name: Superadmin feedback client
 * description: PillTabs (all/new/reviewed/actioned/closed) + cards with expanded body, voice playback, status transition buttons.
 * created: 2026-04-19
 * --- */

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mic, FileText, MessageCircle, Check, Archive, RotateCcw, PlayCircle } from 'lucide-react';
import { PillTabs } from '@/components/shared/pill-tabs';
import type { FeedbackRow, FeedbackStatus, FeedbackCounts } from '@/lib/superadmin/feedback-data';

type TabValue = 'all' | FeedbackStatus;

const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  new: { label: 'Новое', cls: 'bg-emerald-500/15 text-emerald-200' },
  reviewed: { label: 'Просмотрено', cls: 'bg-sky-500/15 text-sky-200' },
  actioned: { label: 'В работе', cls: 'bg-violet-500/15 text-violet-200' },
  closed: { label: 'Закрыто', cls: 'bg-white/10 text-white/55' },
};

const SOURCE_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  web_settings: { label: 'Web', Icon: FileText },
  telegram_bot: { label: 'TG-бот', Icon: MessageCircle },
  telegram_voice: { label: 'TG-голос', Icon: Mic },
  mobile: { label: 'Mobile', Icon: FileText },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FeedbackClient({ rows, counts }: { rows: FeedbackRow[]; counts: FeedbackCounts }) {
  const [tab, setTab] = useState<TabValue>('new');
  const filtered = useMemo(() => tab === 'all' ? rows : rows.filter((r) => r.status === tab), [rows, tab]);
  const items = [
    { value: 'new', label: 'Новые', count: counts.new },
    { value: 'reviewed', label: 'Просмотренные', count: counts.reviewed },
    { value: 'actioned', label: 'В работе', count: counts.actioned },
    { value: 'closed', label: 'Закрытые', count: counts.closed },
    { value: 'all', label: 'Все', count: counts.total },
  ];

  return (
    <>
      <div className="mb-4">
        <PillTabs items={items} value={tab} onChange={(v) => setTab(v as TabValue)} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-[13px] text-white/50">
          В этой категории пусто.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => <FeedbackCard key={r.id} row={r} />)}
        </div>
      )}
    </>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const srcMeta = SOURCE_META[row.source] ?? SOURCE_META.web_settings;
  const statusMeta = STATUS_META[row.status];
  const isVoice = !!row.voiceFileUrl || row.source === 'telegram_voice';

  const changeStatus = async (next: FeedbackStatus) => {
    setBusy(true);
    const res = await fetch('/api/superadmin/feedback', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: row.id, status: next }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Статус: ${STATUS_META[next].label}`);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      toast.error(`Ошибка: ${err.error}`);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-full bg-violet-500/15 text-violet-200">
            {isVoice ? <Mic className="size-4" /> : <FileText className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-medium text-white">{row.profileName}</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                <srcMeta.Icon className="size-3" />
                {srcMeta.label}
              </span>
            </div>
            <div className="text-[11px] text-white/45">{row.profileEmail ?? '—'} · {fmtDate(row.createdAt)}</div>
          </div>
        </div>
        <span className={['rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wider', statusMeta.cls].join(' ')}>
          {statusMeta.label}
        </span>
      </div>

      {isVoice && row.cleanedText && (
        <>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-white/45">AI-суть</div>
          <div className="mb-3 rounded-md border border-emerald-400/20 bg-emerald-500/[0.04] p-2.5 text-[13px] text-white/85">{row.cleanedText}</div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-white/45">Оригинал</div>
          <div className="mb-3 rounded-md border border-white/5 bg-white/[0.02] p-2.5 text-[12px] italic text-white/55">{row.originalText}</div>
        </>
      )}
      {!isVoice && (
        <div className="mb-3 whitespace-pre-wrap text-[13px] text-white/85">{row.originalText}</div>
      )}

      {row.voiceFileUrl && (
        <a href={row.voiceFileUrl} target="_blank" rel="noreferrer" className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] text-violet-300 hover:bg-white/[0.08]">
          <PlayCircle className="size-3.5" />
          Прослушать
        </a>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {row.status === 'new' && (
          <>
            <ActionBtn onClick={() => changeStatus('reviewed')} disabled={busy} Icon={Check} label="Просмотрено" tone="sky" />
            <ActionBtn onClick={() => changeStatus('actioned')} disabled={busy} Icon={Check} label="В работу" tone="violet" />
            <ActionBtn onClick={() => changeStatus('closed')} disabled={busy} Icon={Archive} label="Отклонить" tone="muted" />
          </>
        )}
        {row.status === 'reviewed' && (
          <>
            <ActionBtn onClick={() => changeStatus('actioned')} disabled={busy} Icon={Check} label="В работу" tone="violet" />
            <ActionBtn onClick={() => changeStatus('closed')} disabled={busy} Icon={Archive} label="Закрыть" tone="muted" />
            <ActionBtn onClick={() => changeStatus('new')} disabled={busy} Icon={RotateCcw} label="В новые" tone="muted" />
          </>
        )}
        {row.status === 'actioned' && (
          <>
            <ActionBtn onClick={() => changeStatus('closed')} disabled={busy} Icon={Check} label="Готово" tone="emerald" />
            <ActionBtn onClick={() => changeStatus('reviewed')} disabled={busy} Icon={RotateCcw} label="Отложить" tone="muted" />
          </>
        )}
        {row.status === 'closed' && (
          <ActionBtn onClick={() => changeStatus('actioned')} disabled={busy} Icon={RotateCcw} label="Вернуть в работу" tone="violet" />
        )}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, Icon, label, tone }: { onClick: () => void; disabled: boolean; Icon: React.ComponentType<{ className?: string }>; label: string; tone: 'emerald' | 'violet' | 'sky' | 'muted' }) {
  const toneMap = {
    emerald: 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.14]',
    violet: 'border-violet-400/30 bg-violet-500/[0.08] text-violet-200 hover:bg-violet-500/[0.14]',
    sky: 'border-sky-400/30 bg-sky-500/[0.08] text-sky-200 hover:bg-sky-500/[0.14]',
    muted: 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={['flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors disabled:opacity-40', toneMap[tone]].join(' ')}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
