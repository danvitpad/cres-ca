/** --- YAML
 * name: ClientAppointmentDetailPage
 * description: Full-screen detail view of a single client appointment with cancel/reschedule/repeat/rate actions
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  RefreshCw,
  Star,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DetailRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  currency: string;
  master_id: string;
  service_id: string;
  notes: string | null;
  service: { name: string; color: string | null; duration_minutes: number; description: string | null } | null;
  master: {
    id: string;
    display_name: string | null;
    specialization: string | null;
    avatar_url: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    cancellation_policy: { free_hours?: number; partial_hours?: number; partial_percent?: number } | null;
    profile: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  } | null;
}

function statusLabelKey(status: string) {
  const map: Record<string, string> = {
    booked: 'statusBooked',
    confirmed: 'statusConfirmed',
    in_progress: 'statusConfirmed',
    completed: 'statusCompleted',
    cancelled: 'statusCancelled',
    cancelled_by_client: 'statusCancelled',
    no_show: 'statusCancelled',
  };
  return map[status] ?? 'statusBooked';
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  booked: 'outline',
  confirmed: 'default',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  cancelled_by_client: 'destructive',
  no_show: 'destructive',
};

export default function AppointmentDetailPage() {
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const td = useTranslations('apptDetail');
  const tr = useTranslations('clientReviews');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();

  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewExists, setReviewExists] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (!userId || !params?.id) return;
    async function load() {
      const supabase = createClient();
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);
      const clientIds = (clientRows ?? []).map((c: { id: string }) => c.id);
      if (clientIds.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('appointments')
        .select(
          'id, starts_at, ends_at, status, price, currency, master_id, service_id, notes, service:services(name, color, duration_minutes, description), master:masters(id, display_name, specialization, avatar_url, address, city, latitude, longitude, cancellation_policy, profile:profiles(full_name, avatar_url, phone))',
        )
        .eq('id', params.id)
        .in('client_id', clientIds)
        .maybeSingle();

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRow(data as unknown as DetailRow);

      const { data: rev } = await supabase
        .from('reviews')
        .select('id')
        .eq('appointment_id', params.id)
        .eq('reviewer_id', userId)
        .eq('target_type', 'master')
        .maybeSingle();
      setReviewExists(!!rev);
      setLoading(false);
    }
    load();
  }, [userId, params?.id]);

  const hoursUntilStart = useMemo(() => {
    if (!row) return Infinity;
    return (new Date(row.starts_at).getTime() - Date.now()) / 3_600_000;
  }, [row]);

  const cancelCost = useMemo(() => {
    if (!row || !row.master) return null;
    const policy = row.master.cancellation_policy ?? { free_hours: 24, partial_hours: 12, partial_percent: 50 };
    const freeH = policy.free_hours ?? 24;
    const partialH = policy.partial_hours ?? 12;
    const partialP = policy.partial_percent ?? 50;
    if (hoursUntilStart >= freeH) return { kind: 'free' as const, amount: 0 };
    if (hoursUntilStart >= partialH) {
      return { kind: 'partial' as const, amount: Math.round((Number(row.price) * partialP) / 100) };
    }
    return { kind: 'full' as const, amount: Number(row.price) };
  }, [row, hoursUntilStart]);

  async function doCancel() {
    if (!row || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled_by_client' })
      .eq('id', row.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    toast.success(td('cancelDone'));
    setRow({ ...row, status: 'cancelled_by_client' });
    setCancelOpen(false);
    setBusy(false);
  }

  async function submitRating() {
    if (!row || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from('reviews').insert({
      appointment_id: row.id,
      reviewer_id: userId,
      target_type: 'master',
      target_id: row.master_id,
      score: ratingScore,
      comment: ratingComment.trim() || null,
      is_published: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr('thanks'));
    setReviewExists(true);
    setRatingOpen(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="mb-4 size-12 text-muted-foreground" />
        <p className="text-base font-semibold">{td('notFound')}</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push('/history')}>
          {tc('back')}
        </Button>
      </div>
    );
  }

  const masterName = row.master?.display_name || row.master?.profile?.full_name || '—';
  const masterAvatar = row.master?.avatar_url || row.master?.profile?.avatar_url || null;
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  const canCancel = row.status !== 'cancelled' && row.status !== 'cancelled_by_client' && row.status !== 'completed' && row.status !== 'no_show' && hoursUntilStart > 0;
  const canReschedule = canCancel;
  const isCompleted = row.status === 'completed';

  const mapSrc = row.master?.latitude && row.master?.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${row.master.longitude - 0.01}%2C${row.master.latitude - 0.005}%2C${row.master.longitude + 0.01}%2C${row.master.latitude + 0.005}&layer=mapnik&marker=${row.master.latitude}%2C${row.master.longitude}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24"
    >
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc('back')}
      </button>

      {/* Hero card — master + service */}
      <div className="relative overflow-hidden rounded-[28px] border bg-card p-6 shadow-[var(--shadow-card)]">
        <div
          className="absolute -right-20 -top-20 size-72 rounded-full opacity-20 blur-3xl"
          style={{ background: row.service?.color ?? 'var(--ds-accent)' }}
        />
        <div className="relative space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {row.service?.color && (
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.service.color }} />
                )}
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {td('serviceLabel')}
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{row.service?.name ?? '—'}</h1>
              {row.service?.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{row.service.description}</p>
              )}
            </div>
            <Badge variant={statusVariant[row.status] ?? 'outline'}>
              {isCompleted && <CheckCircle2 className="mr-1 size-3" />}
              {t(statusLabelKey(row.status))}
            </Badge>
          </div>

          <Link
            href={`/masters/${row.master_id}`}
            className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 transition-colors hover:bg-muted/60"
          >
            <div className="size-12 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
              {masterAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={masterAvatar} alt={masterName} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {masterName.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{masterName}</p>
              {row.master?.specialization && (
                <p className="truncate text-[11px] text-muted-foreground">{row.master.specialization}</p>
              )}
            </div>
            <ArrowLeft className="size-4 rotate-180 text-muted-foreground" />
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-background/50 p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="size-3.5" /> {td('date')}
              </p>
              <p className="mt-1.5 text-sm font-semibold">
                {starts.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/50 p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3.5" /> {td('time')}
              </p>
              <p className="mt-1.5 text-sm font-semibold">
                {starts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} —{' '}
                {ends.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">{td('total')}</span>
            <span className="text-2xl font-bold tabular-nums">
              {Number(row.price).toFixed(0)} {row.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Address + map */}
      {(row.master?.address || mapSrc) && (
        <div className="overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{td('location')}</p>
              <p className="mt-0.5 text-sm font-semibold">{row.master?.address || row.master?.city || '—'}</p>
              {row.master?.city && row.master?.address && (
                <p className="text-xs text-muted-foreground">{row.master.city}</p>
              )}
            </div>
            {row.master?.latitude && row.master?.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${row.master.latitude},${row.master.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                {td('route')}
              </a>
            )}
          </div>
          {mapSrc && (
            <iframe
              src={mapSrc}
              className="h-48 w-full border-0"
              loading="lazy"
              title="map"
            />
          )}
        </div>
      )}

      {/* Contact row */}
      {(row.master?.profile?.phone) && (
        <div className="flex gap-2">
          <a
            href={`tel:${row.master.profile.phone}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            <Phone className="size-4" /> {td('call')}
          </a>
          <Link
            href={`/masters/${row.master_id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            <MessageCircle className="size-4" /> {td('profile')}
          </Link>
        </div>
      )}

      {/* Notes */}
      {row.notes && (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{td('notes')}</p>
          <p className="mt-1.5 text-sm">{row.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {isCompleted && !reviewExists && (
          <Button
            className="h-12 w-full gap-2 rounded-2xl text-base"
            onClick={() => setRatingOpen(true)}
          >
            <Star className="size-5" />
            {tr('rateCta')}
          </Button>
        )}
        {isCompleted && (
          <Button
            variant="outline"
            className="h-12 w-full gap-2 rounded-2xl text-base"
            onClick={() => router.push(`/book?master_id=${row.master_id}&service_id=${row.service_id}`)}
          >
            <RefreshCw className="size-5" />
            {t('repeatBooking')}
          </Button>
        )}
        {canReschedule && (
          <Button
            variant="outline"
            className="h-12 w-full gap-2 rounded-2xl text-base"
            onClick={() => router.push(`/book?master_id=${row.master_id}&service_id=${row.service_id}&reschedule=${row.id}`)}
          >
            <Sparkles className="size-5" />
            {td('reschedule')}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="ghost"
            className="h-12 w-full gap-2 rounded-2xl text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="size-5" />
            {td('cancelCta')}
          </Button>
        )}
      </div>

      {/* Cancel confirm sheet */}
      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !busy && setCancelOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-lg font-semibold">{td('cancelTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{td('cancelDesc')}</p>
            </div>
            {cancelCost && (
              <div
                className={cn(
                  'rounded-2xl border p-4 text-sm',
                  cancelCost.kind === 'free'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                    : cancelCost.kind === 'partial'
                      ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                      : 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
                )}
              >
                <p className="font-semibold">
                  {cancelCost.kind === 'free' && td('policyFree')}
                  {cancelCost.kind === 'partial' && td('policyPartial', { amount: cancelCost.amount, currency: row.currency })}
                  {cancelCost.kind === 'full' && td('policyFull', { amount: cancelCost.amount, currency: row.currency })}
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => setCancelOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busy}
                onClick={doCancel}
              >
                {busy ? '…' : td('cancelConfirm')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rating sheet */}
      {ratingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !busy && setRatingOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-lg font-semibold">{tr('rateTitle')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.service?.name} · {masterName}
              </p>
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const v = i + 1;
                return (
                  <button key={v} type="button" onClick={() => setRatingScore(v)} className="p-1">
                    <Star
                      className={cn(
                        'size-9 transition-colors',
                        v <= ratingScore ? 'fill-amber-400 stroke-amber-400' : 'stroke-muted-foreground/40',
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder={tr('commentPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => setRatingOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button className="flex-1" disabled={busy} onClick={submitRating}>
                {tr('submit')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
