/** --- YAML
 * name: ClientAppointmentsPage
 * description: Мої записи — 3 вкладки (Майбутні / Минулі / Скасовані) у стилі
 *              web-client/appointments мокапа: дата-блок зліва, мета-рядки,
 *              статус-чип + кнопки дій (Перенести / X / Оцінити / Повторити).
 * created: 2026-04-19
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, MapPin, Coins, RotateCcw, X, Star, Repeat, Zap, XCircle, CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { humanizeError } from '@/lib/format/error';

type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null } | null;

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number | null;
  currency: string | null;
  client_id: string | null;
  service_id: string | null;
  master_id: string | null;
  cancelled_at: string | null;
  service: { name: string; duration_minutes: number | null } | null;
  master: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    cancellation_policy: { free_hours: number; partial_hours: number; partial_percent: number } | null;
    profile: { full_name: string | null } | null;
    salon: SalonEmbed;
  } | null;
}

const MONTH_SHORT_UK = ['СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР', 'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ'];

type Tab = 'future' | 'past' | 'cancelled';

function computeCancellationFee(a: AppointmentRow) {
  const now = Date.now();
  const start = new Date(a.starts_at).getTime();
  const hoursUntil = Math.max(0, (start - now) / 3_600_000);
  const price = Number(a.price ?? 0);
  const policy = a.master?.cancellation_policy ?? { free_hours: 24, partial_hours: 12, partial_percent: 50 };
  if (hoursUntil >= policy.free_hours) return { kind: 'free' as const, amount: 0, hoursUntil };
  if (hoursUntil >= policy.partial_hours) return { kind: 'partial' as const, amount: Math.round((price * policy.partial_percent) / 100), hoursUntil };
  return { kind: 'late' as const, amount: price, hoursUntil };
}

export default function AppointmentsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { userId } = useAuthStore();

  const initialTab: Tab = (() => {
    const q = sp?.get('tab');
    if (q === 'past') return 'past';
    if (q === 'cancelled') return 'cancelled';
    return 'future';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const [ratingFor, setRatingFor] = useState<AppointmentRow | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: clientsRows } = await supabase
      .from('clients').select('id').eq('profile_id', userId);
    const clientIds = (clientsRows ?? []).map((c) => c.id);
    if (clientIds.length === 0) {
      setRows([]); setLoading(false); return;
    }
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, starts_at, ends_at, status, price, currency, client_id, service_id, master_id, cancelled_at,
        service:services(name, duration_minutes),
        master:masters(
          id, display_name, avatar_url, cancellation_policy,
          profile:profiles!masters_profile_id_fkey(full_name),
          salon:salons(id, name, logo_url, city)
        )
      `)
      .in('client_id', clientIds)
      .order('starts_at', { ascending: false });
    const list = (data ?? []) as unknown as AppointmentRow[];
    setRows(list);

    if (list.length > 0) {
      const completedIds = list.filter((a) => a.status === 'completed').map((a) => a.id);
      if (completedIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews').select('appointment_id')
          .eq('reviewer_id', userId).in('appointment_id', completedIds);
        setReviewedIds(new Set((reviews ?? []).map((r) => (r as { appointment_id: string }).appointment_id)));
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);

  const { future, past, cancelled } = useMemo(() => {
    const f: AppointmentRow[] = [], p: AppointmentRow[] = [], c: AppointmentRow[] = [];
    const now = Date.now();
    for (const a of rows) {
      const isCancelled = ['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(a.status);
      if (isCancelled) c.push(a);
      else if (a.status === 'completed' || new Date(a.starts_at).getTime() < now - 60_000) p.push(a);
      else f.push(a);
    }
    f.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { future: f, past: p, cancelled: c };
  }, [rows]);

  const displayed = tab === 'future' ? future : tab === 'past' ? past : cancelled;

  async function submitCancel() {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    const supabase = createClient();
    const fee = computeCancellationFee(cancelTarget);
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled_by_client',
        cancellation_reason: cancelReason.trim() || null,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
      })
      .eq('id', cancelTarget.id);
    if (error) { toast.error(humanizeError(error)); setCancelBusy(false); return; }
    if (fee.amount > 0 && cancelTarget.client_id) {
      await supabase.from('payments').insert({
        appointment_id: cancelTarget.id,
        client_id: cancelTarget.client_id,
        master_id: cancelTarget.master?.id ?? null,
        amount: fee.amount,
        currency: cancelTarget.currency ?? 'UAH',
        type: 'cancellation_fee',
        status: 'pending',
      });
    }
    fetch(`/api/appointments/${cancelTarget.id}/notify`, { method: 'POST' }).catch(() => undefined);
    toast.success('Запис скасовано');
    setCancelTarget(null); setCancelReason(''); setCancelBusy(false);
    fetchAll();
  }

  async function submitRating() {
    if (!ratingFor || !userId || ratingBusy) return;
    setRatingBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from('reviews').insert({
      appointment_id: ratingFor.id,
      reviewer_id: userId,
      target_type: 'master',
      target_id: ratingFor.master_id,
      score: ratingScore,
      comment: ratingComment.trim() || null,
      is_published: true,
    });
    setRatingBusy(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success('Дякуємо за відгук');
    setReviewedIds((prev) => new Set(prev).add(ratingFor.id));
    setRatingFor(null); setRatingScore(5); setRatingComment('');
  }

  function repeat(a: AppointmentRow) {
    router.push(`/book?master=${a.master_id ?? ''}&service=${a.service_id ?? ''}`);
  }
  function reschedule(a: AppointmentRow) {
    router.push(`/book?master=${a.master_id ?? ''}&service=${a.service_id ?? ''}&reschedule=${a.id}`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-72 animate-pulse rounded-full bg-muted" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight">Мої записи</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Майбутні візити та історія</p>
      </header>

      {/* 3 tabs as segmented pill */}
      <div className="inline-flex rounded-full bg-muted p-1">
        {([
          ['future', 'Майбутні', future.length],
          ['past', 'Минулі', past.length],
          ['cancelled', 'Скасовані', cancelled.length],
        ] as const).map(([k, label, count]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k as Tab)}
              className={cn(
                'flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                active ? 'bg-[#2563eb] text-white' : 'bg-muted-foreground/30 text-muted-foreground',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <EmptyAppts tab={tab} />
      ) : (
        <div className="flex flex-col gap-3.5 max-w-[960px]">
          {displayed.map((a) => (
            <ApptCard
              key={a.id}
              row={a}
              isPastSlot={tab !== 'future'}
              reviewed={reviewedIds.has(a.id)}
              onCancel={() => { setCancelTarget(a); setCancelReason(''); }}
              onReschedule={() => reschedule(a)}
              onRepeat={() => repeat(a)}
              onRate={() => { setRatingFor(a); setRatingScore(5); setRatingComment(''); }}
            />
          ))}
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Скасувати запис?</DialogTitle></DialogHeader>
          {cancelTarget && (() => {
            const fee = computeCancellationFee(cancelTarget);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {cancelTarget.service?.name} · {new Date(cancelTarget.starts_at).toLocaleString('uk-UA')}
                </p>
                {fee.kind === 'free' && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600">
                    До запису ще {Math.round(fee.hoursUntil)} годин — скасування безкоштовне.
                  </div>
                )}
                {fee.kind === 'partial' && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                    До запису {Math.round(fee.hoursUntil)} годин — буде утримано {fee.amount} {cancelTarget.currency ?? 'UAH'}.
                  </div>
                )}
                {fee.kind === 'late' && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                    Пізнє скасування — утримується повна вартість: {fee.amount} {cancelTarget.currency ?? 'UAH'}.
                  </div>
                )}
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Причина скасування (опціонально)"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>Залишити</Button>
                  <Button variant="destructive" onClick={submitCancel} disabled={cancelBusy}>
                    {cancelBusy ? '…' : 'Скасувати'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Rate dialog */}
      <Dialog open={!!ratingFor} onOpenChange={(o) => !o && !ratingBusy && setRatingFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Оцінити візит</DialogTitle></DialogHeader>
          {ratingFor && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {ratingFor.service?.name} · {ratingFor.master?.display_name ?? ratingFor.master?.profile?.full_name ?? '—'}
              </p>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button key={v} type="button" onClick={() => setRatingScore(v)} className="p-1">
                      <Star className={cn('size-8 transition-colors', v <= ratingScore ? 'fill-amber-400 stroke-amber-400' : 'stroke-muted-foreground/40')} />
                    </button>
                  );
                })}
              </div>
              <Textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Що сподобалось? (опціонально)" rows={3} />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={ratingBusy} onClick={() => setRatingFor(null)}>Скасувати</Button>
                <Button className="flex-1" disabled={ratingBusy} onClick={submitRating}>{ratingBusy ? '…' : 'Надіслати'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApptCard({
  row, isPastSlot, reviewed, onCancel, onReschedule, onRepeat, onRate,
}: {
  row: AppointmentRow;
  isPastSlot: boolean;
  reviewed: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onRepeat: () => void;
  onRate: () => void;
}) {
  const start = new Date(row.starts_at);
  const day = start.getDate().toString().padStart(2, '0');
  const monShort = MONTH_SHORT_UK[start.getMonth()];

  const masterName = row.master?.display_name || row.master?.profile?.full_name || 'Майстер';
  const dur = row.service?.duration_minutes;
  const time = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
  const addr = row.master?.salon?.city || null;

  const status = row.status;
  const isToday = isSameDay(start, new Date());
  const isCompleted = status === 'completed';
  const isCancelled = ['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(status);
  const canRate = isCompleted && !reviewed;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/40 hover:shadow-md sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
      {/* Date block */}
      <div className={cn(
        'flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl py-3 font-extrabold tabular-nums',
        isPastSlot
          ? 'bg-muted text-muted-foreground'
          : 'bg-[#2563eb]/12 text-[#2563eb]',
      )}>
        <div className="text-[24px] leading-none">{day}</div>
        <div className="mt-1 text-[11px] font-semibold tracking-wider">{monShort}</div>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold text-foreground leading-tight">
          {row.service?.name ?? 'Запис'}
        </div>
        <div className="mt-1 text-[13px] text-muted-foreground">з {masterName}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground/80">
          {!isCancelled && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {time}{dur ? ` · ${dur} хв` : ''}
            </span>
          )}
          {isCancelled && row.cancelled_at && (
            <span className="inline-flex items-center gap-1">
              <XCircle className="size-3" /> Скасовано · {new Date(row.cancelled_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {addr && !isCancelled && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {addr}
            </span>
          )}
          {row.price != null && (
            <span className="inline-flex items-center gap-1">
              <Coins className="size-3" /> ₴{Math.round(Number(row.price))}
            </span>
          )}
        </div>
      </div>

      {/* Side: status + actions */}
      <div className="flex shrink-0 flex-col items-start justify-between gap-3 sm:items-end">
        <StatusChip
          status={status}
          isToday={isToday}
          canRate={canRate}
        />
        <div className="flex flex-wrap gap-1.5">
          {!isPastSlot && !isCancelled && (
            <>
              <ActionBtn onClick={onReschedule}>
                <RotateCcw className="size-3" /> Перенести
              </ActionBtn>
              <ActionBtn onClick={onCancel} danger>
                <X className="size-3" />
              </ActionBtn>
            </>
          )}
          {isPastSlot && !isCancelled && (
            <>
              {canRate && (
                <ActionBtn onClick={onRate} primary>
                  <Star className="size-3" /> Оцінити
                </ActionBtn>
              )}
              <ActionBtn onClick={onRepeat}>
                <Repeat className="size-3" /> Повторити
              </ActionBtn>
            </>
          )}
          {isCancelled && (
            <ActionBtn onClick={onRepeat}>
              <Repeat className="size-3" /> Записатись знову
            </ActionBtn>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status, isToday, canRate }: { status: string; isToday: boolean; canRate: boolean }) {
  if (canRate) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-600">
        <Star className="size-3" /> Залиш відгук
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
        <CheckCircle2 className="size-3" /> Виконано
      </span>
    );
  }
  if (['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <X className="size-3" /> Скасовано
      </span>
    );
  }
  // future
  if (isToday) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#2563eb]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#2563eb]">
        <Zap className="size-3" /> Сьогодні
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#2563eb]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#2563eb]">
      Майбутній
    </span>
  );
}

function ActionBtn({
  onClick, children, primary, danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
        primary && 'border-[#2563eb] bg-[#2563eb] text-white hover:bg-[#1d4ed8]',
        danger && !primary && 'border-border text-muted-foreground hover:border-red-500 hover:text-red-500',
        !primary && !danger && 'border-border text-muted-foreground hover:border-[#2563eb] hover:text-[#2563eb]',
      )}
    >
      {children}
    </button>
  );
}

function EmptyAppts({ tab }: { tab: Tab }) {
  const map = {
    future: { title: 'Немає майбутніх записів', cta: 'Знайти майстра', href: '/search' },
    past: { title: 'Поки немає минулих візитів', cta: 'Записатись', href: '/search' },
    cancelled: { title: 'Скасованих записів немає', cta: 'Подивитись майстрів', href: '/my-masters' },
  };
  const m = map[tab];
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-14 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#2563eb]">
        <CalendarDays className="size-7" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-foreground">{m.title}</p>
      <Link
        href={m.href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
      >
        {m.cta}
      </Link>
    </div>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
