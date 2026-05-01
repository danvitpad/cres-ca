/** --- YAML
 * name: Purge user button (superadmin)
 * description: Безвозвратно удаляет пользователя ОТОВСЮДУ — auth + БД + связанные
 *   таблицы. Защита: нужно ввести email пользователя для подтверждения. Только
 *   супер-админ. Нельзя удалить самого себя.
 * created: 2026-05-01
 * --- */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function PurgeUserButton({
  profileId,
  profileName,
  profileEmail,
  isSelf,
}: {
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  /** Этот юзер — текущий супер-админ. Кнопка disabled. */
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const purge = async () => {
    const trimmed = confirmEmail.trim().toLowerCase();
    if (!trimmed) {
      toast.error('Введите email пользователя для подтверждения');
      return;
    }
    if (profileEmail && trimmed !== profileEmail.toLowerCase()) {
      toast.error('Email не совпадает');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/users/${profileId}/purge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm_email: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = json.error ?? 'unknown';
        const map: Record<string, string> = {
          confirm_email_required: 'Введите email для подтверждения',
          confirm_email_mismatch: `Email не совпадает (ожидалось: ${json.expected_email_hint ?? '—'})`,
          cannot_purge_self: 'Нельзя удалить самого себя',
          not_found: 'Пользователь не найден',
        };
        toast.error(map[reason] ?? `Ошибка: ${reason}`);
        return;
      }
      toast.success(`${profileName} удалён полностью. Можно регистрироваться заново на ${trimmed}.`);
      setOpen(false);
      setConfirmEmail('');
      // Перенаправляем на список — страница юзера сейчас 404
      startTransition(() => router.push('/superadmin/users'));
    } catch {
      toast.error('Не удалось связаться с сервером');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSelf) {
    return (
      <button
        type="button"
        disabled
        title="Нельзя удалить самого себя"
        className="flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 text-[13px] font-medium text-white/30"
      >
        <Trash2 className="size-3.5" />
        Удалить полностью
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 text-[13px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
      >
        <Trash2 className="size-3.5" />
        Удалить полностью
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-[#14151a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Удалить пользователя полностью</h3>
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

            <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/[0.06] p-3 text-[12px] text-rose-100/90">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
                <div className="space-y-1.5">
                  <div className="font-semibold text-rose-200">Это нельзя отменить.</div>
                  <div>
                    Будут удалены: аккаунт в Authentication, профиль, мастер, клиенты, записи,
                    услуги, склад, расходы, рассылки, бонусы, рефералы, отзывы, уведомления —
                    всё, что связано с этим пользователем.
                  </div>
                  <div>
                    После удаления тот же email сможет зарегистрироваться заново как новый
                    пользователь.
                  </div>
                </div>
              </div>
            </div>

            <label className="block text-[11px] uppercase tracking-wider text-white/50">
              Подтверждение — введите email пользователя
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={profileEmail ?? 'email@example.com'}
              className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-rose-400/60"
              autoFocus
              disabled={submitting}
            />
            {profileEmail && (
              <div className="mt-1 text-[10px] text-white/35">
                ожидается: <span className="text-white/55">{profileEmail}</span>
              </div>
            )}

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
                onClick={purge}
                disabled={submitting || !confirmEmail.trim()}
                className="h-9 rounded-md bg-rose-500/90 px-4 text-[13px] font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Удаляю…' : 'Удалить полностью'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
