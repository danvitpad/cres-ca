/** --- YAML
 * name: Superadmin subscriptions client
 * description: Tabs + row action menus for /superadmin/subscriptions — extend trial, override plan, cancel, jump to whitelist.
 * created: 2026-04-19
 * --- */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal } from 'lucide-react';
import { PillTabs } from '@/components/shared/pill-tabs';
import { useConfirm } from '@/hooks/use-confirm';
import type { SubsBuckets, SubRow, WhitelistRow } from '@/lib/superadmin/subscriptions-data';

type TabValue = 'active' | 'trial' | 'whitelist' | 'cancelled';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SubscriptionsClient({ buckets }: { buckets: SubsBuckets }) {
  const [tab, setTab] = useState<TabValue>('active');
  const items = [
    { value: 'active', label: 'Активные', count: buckets.active.length },
    { value: 'trial', label: 'Триал', count: buckets.trial.length },
    { value: 'whitelist', label: 'Whitelist', count: buckets.whitelist.length },
    { value: 'cancelled', label: 'Отменённые', count: buckets.cancelled.length },
  ];

  return (
    <>
      <div className="mb-4">
        <PillTabs items={items} value={tab} onChange={(v) => setTab(v as TabValue)} />
      </div>

      {tab === 'active' && <SubTable rows={buckets.active} variant="active" />}
      {tab === 'trial' && <TrialWarnings rows={buckets.trial} />}
      {tab === 'whitelist' && <WhitelistTable rows={buckets.whitelist} />}
      {tab === 'cancelled' && <SubTable rows={buckets.cancelled} variant="cancelled" />}
    </>
  );
}

function SubTable({ rows, variant }: { rows: SubRow[]; variant: 'active' | 'cancelled' }) {
  if (rows.length === 0) {
    return <EmptyBlock text={variant === 'active' ? 'Активных подписок нет' : 'Отменённых подписок нет'} />;
  }
  const showCancelled = variant === 'cancelled';
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full table-fixed text-[13px]">
        <thead>
          <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
            <th className="w-[24%] px-3 py-2.5 text-left font-medium">Имя</th>
            <th className="w-[10%] px-3 py-2.5 text-left font-medium">План</th>
            <th className="w-[10%] px-3 py-2.5 text-left font-medium">Период</th>
            <th className="w-[12%] px-3 py-2.5 text-left font-medium">{showCancelled ? 'Отменена' : 'С'}</th>
            <th className="w-[12%] px-3 py-2.5 text-left font-medium">{showCancelled ? 'Причина' : 'До'}</th>
            <th className="w-[10%] px-3 py-2.5 text-right font-medium">MRR</th>
            <th className="w-[8%] px-3 py-2.5 text-right font-medium">—</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
              <td className="truncate px-3 py-2.5">
                <Link href={`/superadmin/users/${r.profileId}`} className="text-white/90 hover:text-violet-300">
                  {r.profileName}
                </Link>
                <div className="truncate text-[11px] text-white/40">{r.profileEmail ?? '—'}</div>
              </td>
              <td className="truncate px-3 py-2.5 text-white/85 uppercase text-[11px] tracking-wider">{r.tier}</td>
              <td className="truncate px-3 py-2.5 text-white/65">{r.billingPeriod ?? 'месяц'}</td>
              <td className="truncate px-3 py-2.5 text-white/65">{fmtDate(showCancelled ? r.cancelledAt : r.createdAt)}</td>
              <td className="truncate px-3 py-2.5 text-white/65">{showCancelled ? (r.cancelReason ?? '—') : fmtDate(r.currentPeriodEnd)}</td>
              <td className="px-3 py-2.5 text-right text-white">{r.mrrContribution > 0 ? `${r.mrrContribution.toLocaleString('ru-RU')} ₴` : '—'}</td>
              <td className="px-3 py-2.5 text-right">
                {!showCancelled && <ActionMenu sub={r} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrialWarnings({ rows }: { rows: SubRow[] }) {
  if (rows.length === 0) return <EmptyBlock text="Активных триалов нет" />;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const d = r.daysLeft ?? 0;
        const urgent = d <= 5;
        return (
          <div key={r.id} className={['flex items-center justify-between gap-4 rounded-xl border p-4', urgent ? 'border-amber-400/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'].join(' ')}>
            <div className="min-w-0 flex-1">
              <Link href={`/superadmin/users/${r.profileId}`} className="text-[14px] font-medium text-white/90 hover:text-violet-300">
                {urgent ? '⚠️ ' : ''}
                {r.profileName}
              </Link>
              <div className="truncate text-[12px] text-white/50">
                {r.profileEmail ?? '—'} · триал до {fmtDate(r.trialEndsAt)}
              </div>
            </div>
            <div className={['shrink-0 text-[12px]', urgent ? 'text-amber-300' : 'text-white/55'].join(' ')}>
              {d > 0 ? `осталось ${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}` : 'истёк'}
            </div>
            <ActionMenu sub={r} />
          </div>
        );
      })}
    </div>
  );
}

function WhitelistTable({ rows }: { rows: WhitelistRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="text-[13px] text-white/55">В whitelist никого нет.</div>
        <Link href="/superadmin/whitelist" className="mt-2 inline-block text-[13px] font-medium text-violet-300 hover:text-violet-200">
          Перейти в раздел Whitelist →
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
            <th className="px-3 py-2.5 text-left font-medium">Имя</th>
            <th className="px-3 py-2.5 text-left font-medium">План</th>
            <th className="px-3 py-2.5 text-left font-medium">Причина</th>
            <th className="px-3 py-2.5 text-left font-medium">С</th>
            <th className="px-3 py-2.5 text-left font-medium">До</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
              <td className="px-3 py-2.5">
                <Link href={`/superadmin/users/${r.profileId}`} className="text-white/90 hover:text-violet-300">
                  {r.profileName}
                </Link>
                <div className="truncate text-[11px] text-white/40">{r.profileEmail ?? '—'}</div>
              </td>
              <td className="px-3 py-2.5 uppercase text-[11px] tracking-wider text-emerald-300">{r.grantedPlan}</td>
              <td className="px-3 py-2.5 text-white/65">{r.reason ?? '—'}</td>
              <td className="px-3 py-2.5 text-white/65">{fmtDate(r.createdAt)}</td>
              <td className="px-3 py-2.5 text-white/65">{r.expiresAt ? fmtDate(r.expiresAt) : 'Навсегда'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-[13px] text-white/50">
      {text}
    </div>
  );
}

function ActionMenu({ sub }: { sub: SubRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();

  const call = async (body: Record<string, unknown>, successMsg: string) => {
    const res = await fetch('/api/superadmin/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscriptionId: sub.id, ...body }),
    });
    if (res.ok) {
      toast.success(successMsg);
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      toast.error(`Ошибка: ${err.error}`);
    }
    setOpen(false);
  };

  const extendTrial = async () => {
    const days = 7;
    const ok = await confirm({ title: 'Продлить триал?', description: `Триал ${sub.profileName} будет продлён на ${days} дней.`, confirmLabel: 'Продлить' });
    if (ok) await call({ action: 'extend_trial', days }, `Триал продлён на ${days} дней`);
  };

  const override = async (tier: 'starter' | 'pro' | 'business') => {
    const ok = await confirm({ title: `Перевести на ${tier}?`, description: 'Подписка будет переведена в статус active на указанный план без оплаты.', confirmLabel: 'Перевести' });
    if (ok) await call({ action: 'override_plan', tier }, `План обновлён на ${tier}`);
  };

  const cancel = async () => {
    const ok = await confirm({ title: 'Отменить подписку?', description: 'Подписка будет помечена как отменённая.', confirmLabel: 'Отменить', destructive: true });
    if (ok) await call({ action: 'cancel', reason: 'superadmin_cancel' }, 'Подписка отменена');
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="grid size-8 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
        aria-label="Действия"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="Закрыть меню" />
          <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-md border border-white/10 bg-[#1f2023] shadow-2xl">
            {sub.tier === 'trial' && (
              <button type="button" onClick={extendTrial} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
                Продлить триал на 7 дней
              </button>
            )}
            <button type="button" onClick={() => override('starter')} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
              Перевести на Starter
            </button>
            <button type="button" onClick={() => override('pro')} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
              Перевести на Pro
            </button>
            <button type="button" onClick={() => override('business')} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
              Перевести на Business
            </button>
            <div className="h-px bg-white/10" />
            <Link href={`/superadmin/whitelist?profile_id=${sub.profileId}`} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
              Добавить в whitelist
            </Link>
            <Link href={`/superadmin/users/${sub.profileId}`} className="block w-full px-3 py-2 text-left text-[12.5px] text-white/85 hover:bg-white/[0.08]">
              История платежей / детали
            </Link>
            <div className="h-px bg-white/10" />
            <button type="button" onClick={cancel} className="block w-full px-3 py-2 text-left text-[12.5px] text-rose-300 hover:bg-rose-500/10">
              Отменить подписку
            </button>
          </div>
        </>
      )}
    </div>
  );
}
