/** --- YAML
 * name: Superadmin beta client
 * description: Клиентская часть /superadmin/beta. Большой переключатель «Опубликовать
 *   продукт» сверху, ниже — табы «Ожидают / Одобрены / Использованы / Отклонены»
 *   со списком заявок и действиями. Внизу — форма ручного добавления.
 * created: 2026-04-29
 * --- */

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Trash2, Plus, AlertTriangle, Globe, Lock, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';
import type { BetaInviteRow, BetaPageData } from '@/lib/superadmin/beta-data';

type Tab = 'pending' | 'approved' | 'used' | 'rejected';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Вручную',
  bot_request: 'Через бота',
  self_signup: 'Сам пытался',
  imported: 'Импорт',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BetaClient({ initial }: { initial: BetaPageData }) {
  const [tab, setTab] = useState<Tab>(initial.counts.pending > 0 ? 'pending' : 'approved');
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <PublishCard
        publicSignupOpen={initial.publicSignupOpen}
        grantPlan={initial.grantPlan}
        grantMonths={initial.grantMonths}
      />

      <div className="mt-6 mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
          {(['pending', 'approved', 'used', 'rejected'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                tab === t
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80',
              ].join(' ')}
            >
              {tabLabel(t)}{' '}
              <span className="ml-1 text-white/40">{initial.counts[t]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-md bg-violet-500/20 px-3 text-[13px] font-medium text-violet-200 transition-colors hover:bg-violet-500/30"
        >
          <Plus className="size-4" />
          Добавить вручную
        </button>
      </div>

      {showAdd && <AddForm onDone={() => setShowAdd(false)} />}

      <InvitesTable rows={initial.invites.filter((i) => i.status === tab)} />
    </>
  );
}

function tabLabel(t: Tab): string {
  if (t === 'pending') return 'Ожидают';
  if (t === 'approved') return 'Одобрены';
  if (t === 'used') return 'Зарегистрированы';
  return 'Отклонены';
}

function PublishCard({
  publicSignupOpen,
  grantPlan,
  grantMonths,
}: {
  publicSignupOpen: boolean;
  grantPlan: string;
  grantMonths: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const togglePublish = async () => {
    const willOpen = !publicSignupOpen;
    const ok = await confirm({
      title: willOpen ? 'Опубликовать сервис?' : 'Закрыть регистрацию?',
      description: willOpen
        ? 'Регистрация откроется ВСЕМ — без проверки бета-листа. Это действие супер-админа фиксируется в логе и приходит уведомлением в @crescasuperadmin_bot.'
        : 'Регистрация снова потребует бета-приглашения. Уже зарегистрированные пользователи продолжат работать.',
      confirmLabel: willOpen ? 'Опубликовать' : 'Закрыть',
      destructive: !willOpen,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch('/api/superadmin/beta/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: willOpen }),
      });
      if (!res.ok) {
        toast.error('Не удалось переключить');
        return;
      }
      toast.success(willOpen ? 'Сервис опубликован' : 'Сервис закрыт');
      router.refresh();
    });
  };

  return (
    <div
      className={[
        'rounded-xl border p-5 transition-colors',
        publicSignupOpen
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={[
              'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg',
              publicSignupOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300',
            ].join(' ')}
          >
            {publicSignupOpen ? <Globe className="size-5" /> : <Lock className="size-5" />}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white">
              {publicSignupOpen
                ? 'Сервис опубликован — регистрация открыта всем'
                : 'Сервис в бета-режиме — регистрация только из списка'}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/60">
              {publicSignupOpen
                ? 'Любой может регистрироваться напрямую через cres-ca.com или Mini App. Бета-список игнорируется.'
                : `Регистрация разрешена только тем, кого вы добавили в список ниже. Одобренные получают тариф «${grantPlan}» бесплатно на ${grantMonths} мес. после релиза.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={togglePublish}
          disabled={pending}
          className={[
            'shrink-0 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50',
            publicSignupOpen
              ? 'border border-amber-400/30 text-amber-200 hover:bg-amber-500/10'
              : 'bg-emerald-500/80 text-white hover:bg-emerald-500',
          ].join(' ')}
        >
          {pending ? '...' : publicSignupOpen ? 'Закрыть' : 'Опубликовать продукт'}
        </button>
      </div>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [tgId, setTgId] = useState('');
  const [fullName, setFullName] = useState('');
  const [note, setNote] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!email.trim() && !tgId.trim()) {
      toast.error('Укажи email или Telegram ID');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/superadmin/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || undefined,
          telegram_id: tgId.trim() ? Number(tgId.trim()) : undefined,
          full_name: fullName.trim() || undefined,
          note: note.trim() || undefined,
          auto_approve: autoApprove,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'already_exists') {
          toast.error('Эта почта или TG-ID уже есть в списке');
        } else {
          toast.error('Не удалось добавить');
        }
        return;
      }
      toast.success(autoApprove ? 'Добавлен и одобрен' : 'Добавлен в очередь');
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-violet-400/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Telegram ID</label>
          <input
            type="text"
            value={tgId}
            onChange={(e) => setTgId(e.target.value.replace(/\D/g, ''))}
            placeholder="123456789"
            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-violet-400/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Имя</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иван Иванов"
            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-violet-400/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-white/40">Комментарий</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="откуда узнали и т.д."
            className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-violet-400/50"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/70">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="size-4 accent-violet-500"
          />
          Сразу одобрить (без статуса «Ожидает»)
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.04]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-violet-500/80 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? '...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvitesTable({ rows }: { rows: BetaInviteRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'delete',
    reason?: string,
  ) => {
    setBusyId(id);
    try {
      const url = `/api/superadmin/beta/${id}`;
      const res =
        action === 'delete'
          ? await fetch(url, { method: 'DELETE' })
          : await fetch(url, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: action === 'approve' ? 'approved' : 'rejected',
                rejection_reason: reason,
              }),
            });
      if (!res.ok) {
        toast.error('Не удалось');
        return;
      }
      toast.success(
        action === 'approve' ? 'Одобрено — TG-уведомление отправлено' :
        action === 'reject' ? 'Отклонено' : 'Удалено',
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
        <AlertTriangle className="size-8 text-white/20" />
        <p className="mt-3 text-[13px] text-white/50">Список пуст</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
            <th className="px-4 py-3 text-left font-medium">Контакт</th>
            <th className="px-4 py-3 text-left font-medium">Источник</th>
            <th className="px-4 py-3 text-left font-medium">Сообщение</th>
            <th className="px-4 py-3 text-left font-medium">Создан</th>
            <th className="px-4 py-3 text-right font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <div className="font-medium text-white">{r.full_name || r.profile_full_name || 'Без имени'}</div>
                <div className="mt-0.5 flex flex-col gap-0.5 text-[12px] text-white/50">
                  {r.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {r.email}
                    </span>
                  )}
                  {r.telegram_id && (
                    <span className="inline-flex items-center gap-1">
                      <Send className="size-3" />
                      TG: {r.telegram_id}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-white/60">{SOURCE_LABEL[r.source] ?? r.source}</td>
              <td className="px-4 py-3">
                {r.request_text ? (
                  <p className="max-w-[300px] text-[12px] text-white/60">{r.request_text}</p>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-[12px] text-white/40">{fmtDate(r.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAction(r.id, 'approve')}
                        disabled={busyId === r.id}
                        className="flex h-7 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        <Check className="size-3" />
                        Одобрить
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Отклонить заявку?',
                            description: 'Пользователь увидит отказ при следующей попытке.',
                            confirmLabel: 'Отклонить',
                            destructive: true,
                          });
                          if (ok) handleAction(r.id, 'reject');
                        }}
                        disabled={busyId === r.id}
                        className="flex h-7 items-center gap-1 rounded-md border border-white/10 px-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        <X className="size-3" />
                        Отклонить
                      </button>
                    </>
                  )}
                  {r.status === 'approved' && r.used_at === null && (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                      Ждём регистрации
                    </span>
                  )}
                  {r.status === 'used' && (
                    <span className="text-[11px] text-white/40">
                      Зарегистрировался {fmtDate(r.used_at)}
                    </span>
                  )}
                  {r.status === 'rejected' && (
                    <span className="rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300">
                      Отклонено
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Удалить заявку?',
                        description: 'Безвозвратно удалит запись из бета-листа.',
                        confirmLabel: 'Удалить',
                        destructive: true,
                      });
                      if (ok) handleAction(r.id, 'delete');
                    }}
                    disabled={busyId === r.id}
                    className="flex size-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
