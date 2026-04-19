/** --- YAML
 * name: Superadmin offers client
 * description: PillTabs (Все/Черновики/Запланированные/Отправленные/Отменённые) + offer cards + "Создать" button that launches OfferWizard.
 * created: 2026-04-19
 * --- */

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Copy, Megaphone, Users, Building2, UserSearch, Target, Percent, Coins, Gift, TrendingUp, X, Trash2 } from 'lucide-react';
import { PillTabs } from '@/components/shared/pill-tabs';
import { useConfirm } from '@/hooks/use-confirm';
import { OfferWizard } from '@/components/superadmin/offer-wizard';
import type { OfferListRow, OfferTarget, OfferType } from '@/lib/superadmin/offers-data';

const TYPE_META: Record<OfferType, { label: string; Icon: React.ComponentType<{ className?: string }>; unit: string; color: string }> = {
  discount_percent: { label: 'Скидка %', Icon: Percent, unit: '%', color: 'text-emerald-300' },
  discount_fixed: { label: 'Скидка', Icon: Coins, unit: '₴', color: 'text-amber-300' },
  free_months: { label: 'Бесплатные мес', Icon: Gift, unit: 'мес', color: 'text-violet-300' },
  plan_upgrade: { label: 'Апгрейд', Icon: TrendingUp, unit: '', color: 'text-sky-300' },
};

const TARGET_META: Record<OfferTarget, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  all_masters: { label: 'Все мастера', Icon: Users },
  all_salons: { label: 'Все салоны', Icon: Building2 },
  specific: { label: 'Выбранные', Icon: UserSearch },
  segment: { label: 'Сегмент', Icon: Target },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type TabValue = 'all' | 'draft' | 'scheduled' | 'sent' | 'cancelled';

export function OffersClient({ rows }: { rows: OfferListRow[] }) {
  const [tab, setTab] = useState<TabValue>('all');
  const [wizardOpen, setWizardOpen] = useState(false);

  const buckets = useMemo(() => ({
    all: rows,
    draft: rows.filter((r) => r.status === 'draft'),
    scheduled: rows.filter((r) => r.status === 'scheduled'),
    sent: rows.filter((r) => r.status === 'sent'),
    cancelled: rows.filter((r) => r.status === 'cancelled'),
  }), [rows]);

  const items = [
    { value: 'all', label: 'Все', count: buckets.all.length },
    { value: 'draft', label: 'Черновики', count: buckets.draft.length },
    { value: 'scheduled', label: 'Запланированные', count: buckets.scheduled.length },
    { value: 'sent', label: 'Отправленные', count: buckets.sent.length },
    { value: 'cancelled', label: 'Отменённые', count: buckets.cancelled.length },
  ];

  const visible = buckets[tab];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PillTabs items={items} value={tab} onChange={(v) => setTab(v as TabValue)} />
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="flex h-9 items-center gap-2 rounded-md bg-violet-500 px-3.5 text-[13px] font-medium text-white hover:bg-violet-400"
        >
          <Plus className="size-4" />
          Создать предложение
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <Megaphone className="mx-auto mb-3 size-10 text-white/25" />
          <div className="text-[14px] text-white/60">{tab === 'all' ? 'Пока нет предложений' : 'В этом разделе пусто'}</div>
          {tab === 'all' && <div className="mt-1 text-[12px] text-white/40">Создайте первую рассылку через кнопку выше.</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visible.map((r) => <OfferCard key={r.id} offer={r} />)}
        </div>
      )}

      <OfferWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}

function StatusPill({ status }: { status: OfferListRow['status'] }) {
  const map = {
    draft: { label: 'Черновик', cls: 'bg-white/10 text-white/65' },
    scheduled: { label: 'Запланировано', cls: 'bg-violet-500/15 text-violet-200' },
    sent: { label: 'Отправлено', cls: 'bg-emerald-500/15 text-emerald-200' },
    cancelled: { label: 'Отменено', cls: 'bg-rose-500/15 text-rose-200' },
  } as const;
  const m = map[status];
  return <span className={['rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider', m.cls].join(' ')}>{m.label}</span>;
}

function OfferCard({ offer }: { offer: OfferListRow }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const tMeta = TYPE_META[offer.offerType];
  const targMeta = TARGET_META[offer.targetType];

  const copyPromo = async () => {
    if (!offer.promoCode) return;
    try { await navigator.clipboard.writeText(offer.promoCode); toast.success('Промокод скопирован'); } catch { /* noop */ }
  };

  const cancelOffer = async () => {
    const ok = await confirm({ title: 'Отменить предложение?', description: 'Черновик или расписание будут помечены как отменённые.', confirmLabel: 'Отменить', destructive: true });
    if (!ok) return;
    setBusy(true);
    const res = await fetch('/api/superadmin/offers', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: offer.id, action: 'cancel' }) });
    setBusy(false);
    if (res.ok) { toast.success('Отменено'); startTransition(() => router.refresh()); }
    else { const err = await res.json().catch(() => ({ error: 'unknown' })); toast.error(`Ошибка: ${err.error}`); }
  };

  const deleteOffer = async () => {
    const ok = await confirm({ title: 'Удалить предложение?', description: 'Удалится запись из БД. Отправленные нельзя удалить.', confirmLabel: 'Удалить', destructive: true });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/superadmin/offers?id=${encodeURIComponent(offer.id)}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { toast.success('Удалено'); startTransition(() => router.refresh()); }
    else { const err = await res.json().catch(() => ({ error: 'unknown' })); toast.error(`Ошибка: ${err.error}`); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
            <span className={['inline-flex items-center gap-1', tMeta.color].join(' ')}>
              <tMeta.Icon className="size-3.5" />
              {tMeta.label} · {offer.offerValue}{tMeta.unit ? ` ${tMeta.unit}` : ''}
            </span>
            <span className="text-white/25">·</span>
            <StatusPill status={offer.status} />
          </div>
          <div className="mt-1.5 text-[14px] font-medium text-white">{offer.title || '(без заголовка)'}</div>
          {offer.description && <div className="mt-1 line-clamp-2 text-[12px] text-white/55">{offer.description}</div>}
        </div>
        {offer.status !== 'sent' && (
          <div className="flex items-center gap-1">
            {(offer.status === 'draft' || offer.status === 'scheduled') && (
              <button type="button" onClick={cancelOffer} disabled={busy} className="grid size-7 place-items-center rounded text-white/55 hover:bg-white/10 hover:text-rose-300" title="Отменить" aria-label="Отменить">
                <X className="size-3.5" />
              </button>
            )}
            <button type="button" onClick={deleteOffer} disabled={busy} className="grid size-7 place-items-center rounded text-white/55 hover:bg-white/10 hover:text-rose-300" title="Удалить" aria-label="Удалить">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-white/55">
        <span className="inline-flex items-center gap-1.5"><targMeta.Icon className="size-3.5" /> {targMeta.label}</span>
        {offer.status === 'sent' && (
          <>
            <span>Получателей: <span className="text-white/80">{offer.recipientsCount}</span></span>
            <span>Конверсий: <span className="text-emerald-300">{offer.conversionsCount}</span></span>
          </>
        )}
        {offer.status === 'scheduled' && offer.scheduledAt && <span>Отправка: <span className="text-white/80">{fmtDate(offer.scheduledAt)}</span></span>}
        {offer.status === 'sent' && offer.sentAt && <span>Отправлено: <span className="text-white/80">{fmtDate(offer.sentAt)}</span></span>}
        {offer.status === 'draft' && <span>Создано: <span className="text-white/80">{fmtDate(offer.createdAt)}</span></span>}
        <div className="flex items-center gap-1">
          {offer.deliveryChannels.map((c) => (
            <span key={c} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/55">{c}</span>
          ))}
        </div>
      </div>

      {offer.promoCode && (
        <button
          type="button"
          onClick={copyPromo}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[12px] tracking-wide text-white/85 hover:bg-white/[0.08]"
          title="Скопировать промокод"
        >
          {offer.promoCode}
          <Copy className="size-3 text-white/55" />
        </button>
      )}
    </div>
  );
}
