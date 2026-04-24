/** --- YAML
 * name: Ban user button
 * description: Inline button on user detail page. Opens a small modal with reason field. Bans via /api/superadmin/blacklist.
 * created: 2026-04-21
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, X } from 'lucide-react';
import { toast } from 'sonner';

export function BanUserButton({
  profileId,
  profileName,
  isBanned,
}: {
  profileId: string;
  profileName: string;
  isBanned: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const ban = async () => {
    if (!reason.trim()) {
      toast.error('Укажите причину');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/blacklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, reason: reason.trim() }),
      });
      if (res.ok) {
        toast.success(`${profileName} заблокирован`);
        setOpen(false);
        setReason('');
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const unban = async () => {
    if (!confirm(`Разблокировать ${profileName}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/blacklist?profile_id=${profileId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Разблокирован');
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isBanned) {
    return (
      <button
        type="button"
        onClick={unban}
        disabled={submitting}
        className="flex h-9 items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 text-[13px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
      >
        <Ban className="size-3.5" />
        Разблокировать
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 text-[13px] font-medium text-rose-200 transition-colors hover:bg-rose-500/15"
      >
        <Ban className="size-3.5" />
        Заблокировать
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-rose-400/20 bg-[#14151a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Заблокировать пользователя</h3>
                <p className="mt-0.5 text-[12px] text-white/55">{profileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
                disabled={submitting}
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
              После блокировки: пользователь будет немедленно выкинут из сессии, не сможет войти. Подписка отменена, whitelist удалён.
            </div>

            <label className="block text-[11px] uppercase tracking-wider text-white/50">Причина блокировки</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: спам, оскорбления в чате, фрод"
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-rose-400/50"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-white/35">видна пользователю на экране блокировки</div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={ban}
                disabled={!reason.trim() || submitting}
                className="h-9 rounded-md bg-rose-500/80 px-4 text-[13px] font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Блокирую…' : 'Заблокировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
