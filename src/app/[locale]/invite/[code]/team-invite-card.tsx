/** --- YAML
 * name: TeamInviteCard
 * description: Client component — renders the team invite acceptance card (salon name, role, accept button).
 *              Handles expired/used states, posts to /api/invite/[code]/accept, redirects to /today on success.
 * created: 2026-04-19
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, AlertCircle, Clock, Building2 } from 'lucide-react';

interface Props {
  code: string;
  locale: string;
  salon: { id: string; name: string; logoUrl: string | null; teamMode: string } | null;
  role: 'master' | 'receptionist';
  usedAt: string | null;
  expired: boolean;
}

export default function TeamInviteCard({ code, locale, salon, role, usedAt, expired }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = role === 'master' ? 'мастер' : 'администратор';
  const already = Boolean(usedAt);
  const disabled = already || expired || busy;

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invite/${code}/accept`, { method: 'POST' });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; salon_id?: string; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? 'Не удалось принять приглашение');
      setBusy(false);
      return;
    }
    router.push(`/${locale}/today`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center text-center">
          {salon?.logoUrl ? (
            <Image
              src={salon.logoUrl}
              alt={salon.name}
              width={80}
              height={80}
              className="rounded-2xl object-cover mb-4"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-white" />
            </div>
          )}

          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-1">
            {salon?.name ?? 'Салон'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            приглашает вас присоединиться как <span className="font-medium text-slate-700 dark:text-slate-300">{roleLabel}</span>
          </p>

          {already && (
            <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4 flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-left">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Приглашение уже принято</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Это приглашение больше не действует.</div>
              </div>
            </div>
          )}

          {expired && !already && (
            <div className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="text-left">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-200">Срок приглашения истёк</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Попросите владельца салона выслать новую ссылку.</div>
              </div>
            </div>
          )}

          {error && (
            <div className="w-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
              <div className="text-left">
                <div className="text-sm font-medium text-red-900 dark:text-red-200">Ошибка</div>
                <div className="text-xs text-red-700 dark:text-red-400 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={accept}
            disabled={disabled}
            className="w-full h-12 rounded-xl bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Принимаем…' : already ? 'Приглашение принято' : expired ? 'Приглашение истекло' : 'Принять приглашение'}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/${locale}/today`)}
            className="mt-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
