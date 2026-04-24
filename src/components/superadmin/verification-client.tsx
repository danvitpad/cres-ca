/** --- YAML
 * name: Superadmin verification client
 * description: Lists pending verification requests with inline preview of document + selfie, approve/reject buttons.
 * created: 2026-04-24
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Loader2, FileText, User } from 'lucide-react';
import type { VerificationRow } from '@/lib/superadmin/verification-data';

const KIND_LABEL = { identity: 'Личность', expertise: 'Сертификация' } as const;

export function VerificationClient({ rows }: { rows: VerificationRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-[13px] text-white/50">Нет заявок на рассмотрении</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
              <th className="px-3 py-2.5 text-left font-medium">Пользователь</th>
              <th className="px-3 py-2.5 text-left font-medium">Тип</th>
              <th className="px-3 py-2.5 text-left font-medium">Заметка</th>
              <th className="px-3 py-2.5 text-left font-medium">Подана</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2.5">
                  <div className="text-white/90">{r.profileName}</div>
                  <div className="text-[11px] text-white/45">{r.profileEmail ?? '—'}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                    r.kind === 'identity'
                      ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }`}>
                    {r.kind === 'identity' ? <User className="size-3" /> : <FileText className="size-3" />}
                    {KIND_LABEL[r.kind]}
                  </span>
                </td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-white/70">{r.note ?? '—'}</td>
                <td className="px-3 py-2.5 text-white/55">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    onClick={() => setOpenId(r.id)}
                    className="h-7 rounded border border-violet-400/30 bg-violet-500/10 px-2 text-[11px] text-violet-200 hover:bg-violet-500/20"
                  >
                    Открыть
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && <ReviewModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

interface DetailData {
  id: string;
  kind: 'identity' | 'expertise';
  status: string;
  note: string | null;
  rejectionReason: string | null;
  documentUrl: string | null;
  selfieUrl: string | null;
  profile: { full_name: string | null; email: string | null } | null;
}

function ReviewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Load on mount
  useState(() => {
    fetch(`/api/superadmin/verification/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DetailData) => setDetail(d))
      .catch(() => toast.error('Не удалось загрузить'))
      .finally(() => setLoading(false));
  });

  const approve = async () => {
    setBusy('approve');
    try {
      const res = await fetch(`/api/superadmin/verification/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        toast.success('Одобрено');
        startTransition(() => router.refresh());
        onClose();
      } else {
        toast.error('Ошибка');
      }
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Укажи причину отказа');
      return;
    }
    setBusy('reject');
    try {
      const res = await fetch(`/api/superadmin/verification/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
      });
      if (res.ok) {
        toast.success('Отклонено');
        startTransition(() => router.refresh());
        onClose();
      } else {
        toast.error('Ошибка');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#14151a] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Проверка {detail ? (detail.kind === 'identity' ? 'личности' : 'сертификации') : ''}</h3>
            {detail && (
              <p className="mt-0.5 text-[12px] text-white/55">
                {detail.profile?.full_name ?? '—'} · {detail.profile?.email ?? '—'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="grid size-7 place-items-center rounded text-white/60 hover:bg-white/10">
            <X className="size-3.5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 text-white/55">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {detail && (
          <>
            {detail.note && (
              <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-[12px] text-white/75">
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-white/45">Заметка от пользователя</div>
                {detail.note}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {detail.documentUrl && (
                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/55">Документ</div>
                  <a href={detail.documentUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detail.documentUrl} alt="Document" className="h-64 w-full object-contain bg-white/5" />
                  </a>
                </div>
              )}
              {detail.selfieUrl && (
                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/55">Селфи с документом</div>
                  <a href={detail.selfieUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detail.selfieUrl} alt="Selfie" className="h-64 w-full object-contain bg-white/5" />
                  </a>
                </div>
              )}
            </div>

            <div className="mt-5">
              <label className="text-[11px] uppercase tracking-wider text-white/50">Причина отказа (если отклоняешь)</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Документ не читается / Селфи с другого лица / …"
                className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-rose-400/50"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={reject}
                disabled={!!busy || !rejectReason.trim()}
                className="flex h-9 items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 text-[13px] font-medium text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === 'reject' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                Отклонить
              </button>
              <button
                onClick={approve}
                disabled={!!busy}
                className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-500/80 px-3 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {busy === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Одобрить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
