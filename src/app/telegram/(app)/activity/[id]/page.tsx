/** --- YAML
 * name: MiniAppAppointmentDetail
 * description: Mini App — full appointment detail with cancel / reschedule / repeat / rate master actions. Dark theme, Telegram haptics.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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
  service: { name: string; color: string | null; description: string | null } | null;
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

const statusLabels: Record<string, { label: string; color: string }> = {
  booked: { label: 'Записан', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  confirmed: { label: 'Подтверждено', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  in_progress: { label: 'Идёт', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  completed: { label: 'Завершено', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  cancelled: { label: 'Отменено', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  cancelled_by_client: { label: 'Отменено', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  no_show: { label: 'Не пришёл', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

export default function MiniAppAppointmentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();

  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewExists, setReviewExists] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !params?.id) return;
    (async () => {
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
          'id, starts_at, ends_at, status, price, currency, master_id, service_id, notes, service:services(name, color, description), master:masters(id, display_name, specialization, avatar_url, address, city, latitude, longitude, cancellation_policy, profile:profiles(full_name, avatar_url, phone))',
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
    })();
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

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  async function doCancel() {
    if (!row || busy) return;
    setBusy(true);
    haptic('warning');
    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled_by_client',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: 'client_miniapp',
      })
      .eq('id', row.id);
    if (error) {
      toast('Ошибка: ' + error.message);
      setBusy(false);
      return;
    }
    // Notify master
    const { data: masterRow } = await supabase
      .from('masters')
      .select('profile_id')
      .eq('id', row.master_id)
      .single();
    if (masterRow?.profile_id) {
      await supabase.from('notifications').insert({
        profile_id: masterRow.profile_id,
        channel: 'telegram',
        title: '❌ Запись отменена',
        body: `${row.service?.name ?? 'Услуга'} — ${new Date(row.starts_at).toLocaleString('ru')}`,
        scheduled_for: new Date().toISOString(),
      });
    }
    haptic('success');
    toast('Запись отменена');
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
      toast('Ошибка: ' + error.message);
      return;
    }
    haptic('success');
    toast('Спасибо за отзыв!');
    setReviewExists(true);
    setRatingOpen(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <div className="h-8 w-32 animate-pulse rounded-full bg-white/5" />
        <div className="h-56 w-full animate-pulse rounded-3xl bg-white/5" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <AlertTriangle className="mb-4 size-12 text-white/40" />
        <p className="text-base font-semibold">Запись не найдена</p>
        <button
          onClick={() => router.push('/telegram/activity')}
          className="mt-6 rounded-full border border-white/10 px-4 py-2 text-sm"
        >
          Назад
        </button>
      </div>
    );
  }

  const masterName = row.master?.display_name || row.master?.profile?.full_name || '—';
  const masterAvatar = row.master?.avatar_url || row.master?.profile?.avatar_url || null;
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  const canCancel =
    row.status !== 'cancelled' &&
    row.status !== 'cancelled_by_client' &&
    row.status !== 'completed' &&
    row.status !== 'no_show' &&
    hoursUntilStart > 0;
  const canReschedule = canCancel;
  const isCompleted = row.status === 'completed';
  const statusInfo = statusLabels[row.status] ?? statusLabels.booked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 px-5 pt-5 pb-6"
    >
      <button
        onClick={() => {
          haptic('selection');
          router.back();
        }}
        className="inline-flex items-center gap-1.5 text-sm text-white/60 active:text-white"
      >
        <ArrowLeft className="size-4" /> Назад
      </button>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5">
        <div
          className="absolute -right-20 -top-20 size-60 rounded-full opacity-30 blur-3xl"
          style={{ background: row.service?.color ?? '#8b5cf6' }}
        />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Услуга</p>
              <h1 className="mt-1 text-xl font-bold">{row.service?.name ?? '—'}</h1>
              {row.service?.description && (
                <p className="mt-1 line-clamp-2 text-[12px] text-white/50">{row.service.description}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusInfo.color}`}>
              {isCompleted && <CheckCircle2 className="mr-1 inline size-2.5" />}
              {statusInfo.label}
            </span>
          </div>

          <button
            onClick={() => router.push(`/telegram/search/${row.master_id}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-sm font-bold">
              {masterAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={masterAvatar} alt="" className="size-full object-cover" />
              ) : (
                masterName.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{masterName}</p>
              {row.master?.specialization && (
                <p className="truncate text-[11px] text-white/50">{row.master.specialization}</p>
              )}
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40">
                <CalendarDays className="size-3" /> Дата
              </p>
              <p className="mt-1 text-[13px] font-semibold">
                {starts.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40">
                <Clock className="size-3" /> Время
              </p>
              <p className="mt-1 text-[13px] font-semibold">
                {starts.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} —{' '}
                {ends.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
            <span className="text-xs text-white/50">Итого</span>
            <span className="text-2xl font-bold tabular-nums">
              {Number(row.price).toFixed(0)} {row.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Address */}
      {row.master?.address && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <MapPin className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Место</p>
              <p className="mt-0.5 text-sm font-semibold">{row.master.address}</p>
              {row.master.city && <p className="text-[11px] text-white/50">{row.master.city}</p>}
            </div>
            {row.master.latitude && row.master.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${row.master.latitude},${row.master.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold"
              >
                Маршрут
              </a>
            )}
          </div>
        </div>
      )}

      {/* Contact */}
      {row.master?.profile?.phone && (
        <a
          href={`tel:${row.master.profile.phone}`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <Phone className="size-4" /> Позвонить мастеру
        </a>
      )}

      {/* Notes */}
      {row.notes && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Заметка</p>
          <p className="mt-1 text-sm">{row.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        {isCompleted && !reviewExists && (
          <button
            onClick={() => {
              haptic('light');
              setRatingOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-semibold text-black active:scale-[0.98] transition-transform"
          >
            <Star className="size-5" /> Оценить мастера
          </button>
        )}
        {isCompleted && (
          <button
            onClick={() => router.push(`/book?master_id=${row.master_id}&service_id=${row.service_id}`)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-4 text-[15px] font-semibold active:scale-[0.98] transition-transform"
          >
            <RefreshCw className="size-5" /> Повторить запись
          </button>
        )}
        {canReschedule && (
          <button
            onClick={() => router.push(`/book?master_id=${row.master_id}&service_id=${row.service_id}&reschedule=${row.id}`)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-4 text-[15px] font-semibold active:scale-[0.98] transition-transform"
          >
            <Sparkles className="size-5" /> Перенести
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => {
              haptic('warning');
              setCancelOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-4 text-[15px] font-semibold text-rose-300 active:scale-[0.98] transition-transform"
          >
            <XCircle className="size-5" /> Отменить запись
          </button>
        )}
      </div>

      {/* Cancel sheet */}
      <AnimatePresence>
        {cancelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"
            onClick={() => !busy && setCancelOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full space-y-4 rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-6"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Отменить запись?</h3>
                  <p className="mt-1 text-xs text-white/50">
                    Мастер получит уведомление об отмене
                  </p>
                </div>
                <button
                  onClick={() => setCancelOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              {cancelCost && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    cancelCost.kind === 'free'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : cancelCost.kind === 'partial'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {cancelCost.kind === 'free' && <p className="font-semibold">Отмена бесплатна</p>}
                  {cancelCost.kind === 'partial' && (
                    <p className="font-semibold">Частичная оплата: {cancelCost.amount} {row.currency}</p>
                  )}
                  {cancelCost.kind === 'full' && (
                    <p className="font-semibold">Полная стоимость: {cancelCost.amount} {row.currency}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={busy}
                  className="flex-1 rounded-2xl border border-white/15 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  Назад
                </button>
                <button
                  onClick={doCancel}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : 'Отменить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating sheet */}
      <AnimatePresence>
        {ratingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"
            onClick={() => !busy && setRatingOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full space-y-4 rounded-t-[32px] border-t border-white/10 bg-[#2f3437] p-6"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Оцените визит</h3>
                  <p className="mt-1 text-xs text-white/50">
                    {row.service?.name} · {masterName}
                  </p>
                </div>
                <button
                  onClick={() => setRatingOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-white/5"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex justify-center gap-1 py-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setRatingScore(v);
                        haptic('selection');
                      }}
                      className="p-1"
                    >
                      <Star
                        className={`size-9 transition-colors ${
                          v <= ratingScore ? 'fill-amber-400 stroke-amber-400' : 'stroke-white/30'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Расскажи о визите (необязательно)"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-white/20"
              />
              <button
                onClick={submitRating}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : 'Отправить отзыв'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/15 bg-[#2f3437] px-4 py-2 text-xs font-semibold shadow-2xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
