/** --- YAML
 * name: ClientAppointmentsPage
 * description: Unified Web /appointments — merges /my-calendar + /history. PillTabs upcoming/past, salon-aware display, cancel-only (client can't reschedule), rate past visits, before/after slider.
 * created: 2026-04-19
 * updated: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarDays,
  Clock,
  User,
  Building2,
  Star,
  RefreshCw,
  X,
  ImageIcon,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock3,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { BeforeAfterSlider } from '@/components/shared/before-after-slider';
import { resolveCardDisplay, type SalonRef } from '@/lib/client/display-mode';
import { humanizeError } from '@/lib/format/error';

type SalonEmbed = { id: string; name: string; logo_url: string | null; city: string | null; rating: number | null } | null;

function unwrapSalon(s: SalonEmbed | SalonEmbed[] | null | undefined): SalonRef | null {
  if (!s) return null;
  const obj = Array.isArray(s) ? s[0] ?? null : s;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, logo_url: obj.logo_url, city: obj.city, rating: obj.rating };
}

interface BeforeAfterPair {
  id: string;
  before_url: string;
  after_url: string;
  caption: string | null;
}

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
  service: { name: string; color: string | null; duration_minutes: number | null } | null;
  master: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    specialization: string | null;
    salon_id: string | null;
    cancellation_policy: { free_hours: number; partial_hours: number; partial_percent: number } | null;
    profile: { full_name: string | null; avatar_url: string | null } | null;
    salon: SalonEmbed;
  } | null;
  client: {
    family_link_id: string | null;
    family_link: { member_name: string | null } | null;
  } | null;
  beforeAfter: BeforeAfterPair | null;
}

function computeCancellationFee(
  appt: AppointmentRow,
): { kind: 'free' | 'partial' | 'late'; amount: number; hoursUntil: number } {
  const now = Date.now();
  const start = new Date(appt.starts_at).getTime();
  const hoursUntil = Math.max(0, (start - now) / 3_600_000);
  const price = Number(appt.price ?? 0);
  const policy = appt.master?.cancellation_policy ?? { free_hours: 24, partial_hours: 12, partial_percent: 50 };
  if (hoursUntil >= policy.free_hours) return { kind: 'free', amount: 0, hoursUntil };
  if (hoursUntil >= policy.partial_hours) {
    return { kind: 'partial', amount: Math.round((price * policy.partial_percent) / 100), hoursUntil };
  }
  return { kind: 'late', amount: price, hoursUntil };
}

function StatusChip({ status, label }: { status: string; label: string }) {
  const map: Record<string, { text: string; border: string; icon: React.ElementType; bg: string }> = {
    booked: { text: 'text-sky-600', border: 'border-sky-500/30', bg: 'bg-sky-500/10', icon: Clock3 },
    confirmed: { text: 'text-emerald-600', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    in_progress: { text: 'text-violet-600', border: 'border-violet-500/30', bg: 'bg-violet-500/10', icon: Clock3 },
    completed: { text: 'text-emerald-600', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    cancelled: { text: 'text-rose-600', border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: XCircle },
    cancelled_by_client: { text: 'text-rose-600', border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: XCircle },
    cancelled_by_master: { text: 'text-rose-600', border: 'border-rose-500/30', bg: 'bg-rose-500/10', icon: XCircle },
    no_show: { text: 'text-amber-600', border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: XCircle },
  };
  const info = map[status] ?? map.booked;
  const Icon = info.icon;
  return (
    <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', info.text, info.border, info.bg)}>
      <Icon className="size-3" /> {label}
    </span>
  );
}

export default function AppointmentsPage() {
  const t = useTranslations('clientAppointments');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const tCal = useTranslations('clientCalendar');
  const tr = useTranslations('clientReviews');
  const tCard = useTranslations('cardLabels');
  const router = useRouter();
  const sp = useSearchParams();
  const { userId } = useAuthStore();

  const initialTab = sp?.get('tab') === 'past' ? 'past' : 'upcoming';
  const [tab, setTab] = useState<'upcoming' | 'past'>(initialTab);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  // Rate dialog
  const [reviewedApptIds, setReviewedApptIds] = useState<Set<string>>(new Set());
  const [ratingFor, setRatingFor] = useState<AppointmentRow | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingAnonymous, setRatingAnonymous] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);

  // Before/after slider
  const [showSliderFor, setShowSliderFor] = useState<string | null>(null);

  const cardLabels = useMemo(
    () => ({
      masterPlaceholder: tCard('masterPlaceholder'),
      salonPlaceholder: tCard('salonPlaceholder'),
      managerAssigned: tCard('managerAssigned'),
    }),
    [tCard],
  );

  const fetchAppointments = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    const { data: clientsRows } = await supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId);

    const clientIds = (clientsRows ?? []).map((c) => c.id);
    if (clientIds.length === 0) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, starts_at, ends_at, status, price, currency, client_id, service_id, master_id,
        service:services(name, color, duration_minutes),
        master:masters(
          id, display_name, avatar_url, specialization, salon_id, cancellation_policy,
          profile:profiles!masters_profile_id_fkey(full_name, avatar_url),
          salon:salons(id, name, logo_url, city)
        ),
        client:clients(family_link_id, family_link:family_links(member_name))
      `)
      .in('client_id', clientIds)
      .order('starts_at', { ascending: false });

    const rows = (data ?? []) as unknown as AppointmentRow[];

    // Enrich with before/after photos (same strategy as legacy /history)
    const apptIds = rows.map((a) => a.id);
    const masterIds = Array.from(new Set(rows.map((a) => a.master_id).filter(Boolean) as string[]));
    const serviceIds = Array.from(new Set(rows.map((a) => a.service_id).filter(Boolean) as string[]));

    const byAppt = new Map<string, BeforeAfterPair>();
    const byMasterService = new Map<string, BeforeAfterPair>();

    if (apptIds.length) {
      const { data: exact } = await supabase
        .from('before_after_photos')
        .select('id, appointment_id, before_url, after_url, caption')
        .in('appointment_id', apptIds);
      (exact ?? []).forEach((p: { id: string; appointment_id: string; before_url: string; after_url: string; caption: string | null }) => {
        byAppt.set(p.appointment_id, { id: p.id, before_url: p.before_url, after_url: p.after_url, caption: p.caption });
      });
    }
    if (masterIds.length && serviceIds.length) {
      const { data: photos } = await supabase
        .from('before_after_photos')
        .select('id, master_id, service_id, before_url, after_url, caption, created_at')
        .in('master_id', masterIds)
        .in('service_id', serviceIds)
        .is('appointment_id', null)
        .order('created_at', { ascending: false });
      (photos ?? []).forEach((p: { id: string; master_id: string; service_id: string; before_url: string; after_url: string; caption: string | null }) => {
        const key = `${p.master_id}::${p.service_id}`;
        if (!byMasterService.has(key)) byMasterService.set(key, { id: p.id, before_url: p.before_url, after_url: p.after_url, caption: p.caption });
      });
    }

    const enriched: AppointmentRow[] = rows.map((a) => {
      const clientRaw = a.client as unknown;
      const clientObj = Array.isArray(clientRaw) ? (clientRaw[0] ?? null) : (clientRaw ?? null);
      let clientNorm: AppointmentRow['client'] = null;
      if (clientObj) {
        const c = clientObj as { family_link_id: string | null; family_link: unknown };
        const fl = Array.isArray(c.family_link) ? (c.family_link[0] ?? null) : (c.family_link ?? null);
        clientNorm = {
          family_link_id: c.family_link_id,
          family_link: fl as { member_name: string | null } | null,
        };
      }
      return {
        ...a,
        client: clientNorm,
        beforeAfter: byAppt.get(a.id) ?? (a.master_id && a.service_id ? byMasterService.get(`${a.master_id}::${a.service_id}`) ?? null : null),
      };
    });
    setAppointments(enriched);

    if (apptIds.length) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('appointment_id')
        .eq('reviewer_id', userId)
        .eq('target_type', 'master')
        .in('appointment_id', apptIds);
      setReviewedApptIds(new Set((existing ?? []).map((r: { appointment_id: string }) => r.appointment_id)));
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const { upcoming, past } = useMemo(() => {
    const nowMs = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const a of appointments) {
      const isDone = ['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(a.status);
      if (!isDone && new Date(a.starts_at).getTime() >= nowMs - 60_000) up.push(a);
      else pa.push(a);
    }
    up.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { upcoming: up, past: pa };
  }, [appointments]);

  const displayed = tab === 'upcoming' ? upcoming : past;

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

    if (error) {
      toast.error(humanizeError(error));
      setCancelBusy(false);
      return;
    }

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

    // DB trigger trg_appointments_booking_updated already created the master
    // notification (with proper currency/timezone/copy). Flush it to TG immediately.
    fetch(`/api/appointments/${cancelTarget.id}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => undefined);

    toast.success(tCal('cancelDone'));
    setCancelTarget(null);
    setCancelReason('');
    setCancelBusy(false);
    fetchAppointments();
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
      is_anonymous: ratingAnonymous,
    });
    setRatingBusy(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success(tr('thanks'));
    setReviewedApptIds((prev) => new Set(prev).add(ratingFor.id));
    setRatingFor(null);
    setRatingScore(5);
    setRatingComment('');
    setRatingAnonymous(false);
  }

  function handleRepeat(a: AppointmentRow) {
    router.push(`/book?master_id=${a.master_id}&service_id=${a.service_id}`);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function statusLabel(status: string) {
    const key: Record<string, string> = {
      booked: 'statusBooked',
      confirmed: 'statusConfirmed',
      in_progress: 'statusConfirmed',
      completed: 'statusCompleted',
      cancelled: 'statusCancelled',
      cancelled_by_client: 'statusCancelled',
      cancelled_by_master: 'statusCancelled',
      no_show: 'statusCancelled',
    };
    return tb(key[status] ?? 'statusBooked');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* PillTabs */}
      <div className="inline-flex rounded-full border border-border/60 bg-card p-1 shadow-sm">
        {(['upcoming', 'past'] as const).map((k) => {
          const active = tab === k;
          const count = k === 'upcoming' ? upcoming.length : past.length;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="appt-tab"
                  className="absolute inset-0 rounded-full bg-muted"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t(k === 'upcoming' ? 'tabUpcoming' : 'tabPast')}</span>
              <span className={cn('relative z-10 rounded-full px-2 py-0.5 text-[10px] font-bold', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarDays className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {tab === 'upcoming' ? t('emptyUpcoming') : t('emptyPast')}
              </p>
              {tab === 'upcoming' && (
                <Link
                  href="/search"
                  className={cn(buttonVariants({ size: 'sm' }), 'mt-2')}
                >
                  {t('ctaFindMaster')}
                </Link>
              )}
            </div>
          ) : (
            displayed.map((a) => {
              const masterForDisplay = a.master
                ? {
                    id: a.master.id,
                    display_name: a.master.display_name ?? a.master.profile?.full_name ?? null,
                    avatar_url: a.master.avatar_url ?? a.master.profile?.avatar_url ?? null,
                    specialization: a.master.specialization,
                    salon_id: a.master.salon_id,
                  }
                : null;
              const salon = unwrapSalon(a.master?.salon);
              const d = resolveCardDisplay(masterForDisplay, salon, cardLabels);
              const isUpcoming = tab === 'upcoming';
              const isCompleted = a.status === 'completed';
              const canRate = isCompleted && !reviewedApptIds.has(a.id);
              const serviceColor = a.service?.color ?? 'var(--ds-accent)';

              return (
                <Card
                  key={a.id}
                  size="sm"
                  className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
                >
                  <CardContent className="space-y-3 pt-3">
                    <div className="flex items-start gap-3">
                      <AvatarRing
                        src={d.avatarSrc}
                        name={d.avatarName}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {d.mode === 'solo' ? (
                            <User className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <p className="truncate text-sm font-semibold">{d.primary}</p>
                        </div>
                        {d.secondary && (
                          <p className="truncate text-xs text-muted-foreground">{d.secondary}</p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          <span
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: serviceColor }}
                          />
                          <span className="truncate text-muted-foreground">{a.service?.name ?? '—'}</span>
                          {a.client?.family_link_id && a.client.family_link?.member_name && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--ds-accent)]/30 bg-[var(--ds-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--ds-accent)]">
                              {t('forMember', { name: a.client.family_link.member_name })}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusChip status={a.status} label={statusLabel(a.status)} />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3.5" /> {formatDate(a.starts_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {formatTime(a.starts_at)}
                        </span>
                        {a.service?.duration_minutes ? (
                          <span className="text-muted-foreground">· {a.service.duration_minutes} {t('min')}</span>
                        ) : null}
                      </div>
                      {a.price != null && Number(a.price) > 0 && (
                        <span className="font-semibold tabular-nums">
                          {Number(a.price).toFixed(0)} {a.currency ?? 'UAH'}
                        </span>
                      )}
                    </div>

                    {/* Before/After slider toggle */}
                    {!isUpcoming && isCompleted && a.beforeAfter && showSliderFor === a.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <BeforeAfterSlider
                          beforeUrl={a.beforeAfter.before_url}
                          afterUrl={a.beforeAfter.after_url}
                          caption={a.beforeAfter.caption}
                        />
                      </motion.div>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-border/40 pt-2">
                      <Link
                        href={`/history/${a.id}`}
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'sm' }),
                          'flex-1 gap-1.5',
                        )}
                      >
                        {t('details')} <ChevronRight className="size-3.5" />
                      </Link>

                      {isUpcoming ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 gap-1.5 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                          onClick={() => {
                            setCancelTarget(a);
                            setCancelReason('');
                          }}
                        >
                          <X className="size-3.5" /> {t('cancel')}
                        </Button>
                      ) : (
                        <>
                          {a.beforeAfter && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => setShowSliderFor((cur) => (cur === a.id ? null : a.id))}
                            >
                              <ImageIcon className="size-3.5" />
                              {showSliderFor === a.id ? tc('hide') : tc('show')}
                            </Button>
                          )}
                          {isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => handleRepeat(a)}
                            >
                              <RefreshCw className="size-3.5" /> {t('repeat')}
                            </Button>
                          )}
                          {canRate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 gap-1.5 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                              onClick={() => {
                                setRatingFor(a);
                                setRatingScore(5);
                                setRatingComment('');
                              }}
                            >
                              <Star className="size-3.5" /> {tr('rateCta')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCal('cancelTitle')}</DialogTitle>
          </DialogHeader>
          {cancelTarget && (() => {
            const fee = computeCancellationFee(cancelTarget);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {cancelTarget.service?.name} — {new Date(cancelTarget.starts_at).toLocaleString()}
                </p>
                {fee.kind === 'free' && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300">
                    {t('feeFree', { hours: Math.round(fee.hoursUntil) })}
                  </div>
                )}
                {fee.kind === 'partial' && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
                    {t('feePartial', { hours: Math.round(fee.hoursUntil), amount: fee.amount, currency: cancelTarget.currency ?? 'UAH' })}
                  </div>
                )}
                {fee.kind === 'late' && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                    {t('feeLate', { hours: Math.round(fee.hoursUntil), amount: fee.amount, currency: cancelTarget.currency ?? 'UAH' })}
                  </div>
                )}
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={tCal('cancelReasonPlaceholder')}
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>
                    {tCal('cancelKeep')}
                  </Button>
                  <Button variant="destructive" onClick={submitCancel} disabled={cancelBusy}>
                    {cancelBusy ? '…' : tCal('cancelConfirm')}
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
          <DialogHeader>
            <DialogTitle>{tr('rateTitle')}</DialogTitle>
          </DialogHeader>
          {ratingFor && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {ratingFor.service?.name} · {ratingFor.master?.display_name ?? ratingFor.master?.profile?.full_name ?? '—'}
              </p>
              <div className="flex justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRatingScore(v)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          'size-8 transition-colors',
                          v <= ratingScore ? 'fill-amber-400 stroke-amber-400' : 'stroke-muted-foreground/40',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder={tr('commentPlaceholder')}
                rows={3}
              />
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-card/50 p-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={ratingAnonymous}
                  onChange={(e) => setRatingAnonymous(e.target.checked)}
                  className="mt-0.5 size-4 cursor-pointer accent-[var(--ds-accent)]"
                />
                <span className="flex-1 text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Анонимный отзыв</span>
                  <br />
                  Имя не будет показано публично. Мастер видит автора только в админке.
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={ratingBusy} onClick={() => setRatingFor(null)}>
                  {tc('cancel')}
                </Button>
                <Button className="flex-1" disabled={ratingBusy} onClick={submitRating}>
                  {ratingBusy ? '…' : tr('submit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
