/** --- YAML
 * name: Rebook panel
 * description: Dashboard widget for masters showing pending rebook suggestions. Approve → client gets TG message.
 *              Dismiss → suggestion archived.
 * created: 2026-04-24
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, Check, X, Loader2, AlertCircle } from 'lucide-react';

export interface RebookCardData {
  id: string;
  clientName: string;
  serviceName: string;
  suggestedStartsAt: string;
  altSlots: Array<{ starts_at: string }>;
  medianIntervalDays: number;
  lastVisitAt: string;
  clientHasTelegram: boolean;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const day = DOW[d.getDay()];
  const date = d.getDate();
  const month = d.toLocaleDateString('ru-RU', { month: 'short' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${date} ${month} · ${time}`;
}

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'сегодня';
  if (days < 7) return `${days} д назад`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} нед назад`;
  const months = Math.floor(days / 30);
  return `${months} мес назад`;
}

export function RebookPanel({ items }: { items: RebookCardData[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.04] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-violet-200">
          <RefreshCw className="size-3.5" />
          Пора вернуть клиентов
        </h2>
        <span className="text-[11px] text-white/45">{items.length} {items.length === 1 ? 'клиент' : 'клиентов'}</span>
      </div>
      <p className="mb-4 text-[12px] text-white/55">
        AI проанализировал историю визитов. Одобри предложение — клиенту придёт сообщение в Telegram с кнопками выбора времени.
      </p>
      <ul className="space-y-2">
        {items.map((item) => <RebookCard key={item.id} item={item} />)}
      </ul>
    </div>
  );
}

function RebookCard({ item }: { item: RebookCardData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<'approve' | 'dismiss' | null>(null);

  const approve = async () => {
    if (!item.clientHasTelegram) {
      toast.error('У клиента не привязан Telegram — свяжись по телефону');
      return;
    }
    setBusy('approve');
    try {
      const res = await fetch(`/api/rebook/${item.id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`${item.clientName} — сообщение отправлено`);
        startTransition(() => router.refresh());
      } else if (data.error === 'stale') {
        toast.error('Все предложенные слоты уже заняты. Заново через завтра.');
        startTransition(() => router.refresh());
      } else {
        toast.error(data.message ?? data.error ?? 'Ошибка');
      }
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async () => {
    setBusy('dismiss');
    try {
      const res = await fetch(`/api/rebook/${item.id}/dismiss`, { method: 'POST' });
      if (res.ok) {
        toast.success('Предложение скрыто');
        startTransition(() => router.refresh());
      } else {
        toast.error('Ошибка');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-white">{item.clientName}</p>
            {!item.clientHasTelegram && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                <AlertCircle className="size-2.5" />
                нет TG
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-white/60">
            {item.serviceName} · обычно раз в {item.medianIntervalDays} дн · был {daysAgo(item.lastVisitAt)}
          </p>
          <p className="mt-1.5 text-[12px] font-medium text-violet-200">
            Предложить: {fmt(item.suggestedStartsAt)}
            {item.altSlots.length > 0 && (
              <span className="ml-1 text-white/40">
                (+{item.altSlots.length} альт.)
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={dismiss}
            disabled={!!busy}
            className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            title="Скрыть"
          >
            {busy === 'dismiss' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
          <button
            onClick={approve}
            disabled={!!busy || !item.clientHasTelegram}
            className="grid size-8 place-items-center rounded-md border border-violet-400/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            title="Одобрить → отправить клиенту"
          >
            {busy === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
        </div>
      </div>
    </li>
  );
}
