/** --- YAML
 * name: AppointmentDetailDrawer
 * description: Fresha-style appointment detail drawer — client info, status dropdown, services list, options menu, checkout
 * --- */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  Phone,
  Calendar,
  Plus,
  AlertTriangle,
  RefreshCw,
  Ban,
  Pencil,
  MessageSquare,
  Shield,
  MoreHorizontal,
  ArrowRightLeft,
  User,
  UserRound,
} from 'lucide-react';
import type { AppointmentData } from '@/hooks/use-appointments';
import type { AppointmentStatus } from '@/types';
import { useEscapeKey } from '@/hooks/use-keyboard-shortcuts';

type AppointmentDetailDrawerProps = {
  appointment: AppointmentData | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onRepeat: (appointment: AppointmentData) => void;
  theme: 'light' | 'dark';
};

const LIGHT = {
  bg: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  controlBg: '#f5f5f5',
  controlHover: '#ebebeb',
  accent: '#6950f3',
  accentSoft: '#f0f0ff',
  danger: '#d4163a',
  dangerSoft: '#fef2f4',
  btnBg: '#000000',
  btnText: '#ffffff',
  btnOutlineBorder: '#e5e5e5',
  cardBg: '#f9f9f9',
  link: '#0075a8',
  popoverBg: '#ffffff',
  popoverShadow: 'rgba(19,19,19,0.08) 0px 2px 8px, rgba(19,19,19,0.12) 0px 4px 20px',
  popoverBorder: '#e5e5e5',
  statusBooked: '#e5e5e5',
  statusConfirmed: '#dbeafe',
  statusArrived: '#dcfce7',
  statusStarted: '#fef3c7',
  statusNoShow: '#fecaca',
  statusCancelled: '#fecaca',
};

const DARK = {
  bg: '#111425',
  border: 'rgba(139,92,246,0.16)',
  text: '#eae8f4',
  textMuted: '#a8a3be',
  controlBg: '#1a1d30',
  controlHover: '#1f2240',
  accent: '#8b5cf6',
  accentSoft: 'rgba(139,92,246,0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  btnBg: '#8b5cf6',
  btnText: '#ffffff',
  btnOutlineBorder: 'rgba(139,92,246,0.2)',
  cardBg: '#1a1d30',
  link: '#a78bfa',
  popoverBg: '#1a1d30',
  popoverShadow: 'rgba(0,0,0,0.4) 0px 2px 8px, rgba(0,0,0,0.5) 0px 4px 20px',
  popoverBorder: 'rgba(139,92,246,0.22)',
  statusBooked: 'rgba(139,92,246,0.18)',
  statusConfirmed: 'rgba(34,103,232,0.25)',
  statusArrived: 'rgba(34,197,94,0.22)',
  statusStarted: 'rgba(245,158,11,0.22)',
  statusNoShow: 'rgba(239,68,68,0.22)',
  statusCancelled: 'rgba(239,68,68,0.22)',
};

export function AppointmentDetailDrawer({
  appointment,
  open,
  onClose,
  onUpdated,
  onRepeat,
  theme,
}: AppointmentDetailDrawerProps) {
  const t = useTranslations('calendar');
  const tc = useTranslations('common');
  const router = useRouter();
  const C = theme === 'dark' ? DARK : LIGHT;

  const [actionsOpen, setActionsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const actionsRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEscapeKey(actionsOpen || optionsOpen, () => {
    setActionsOpen(false);
    setOptionsOpen(false);
  });

  useEffect(() => {
    setActionsOpen(false);
    setOptionsOpen(false);
  }, [appointment?.id]);

  // Минус к рейтингу клиента, если он сам отменил/перенёс позже допустимого
  // окна по политике мастера (cancellation_policy.free_hours, по умолчанию 24ч).
  async function applyClientLatePenalty(reason: 'late_cancel' | 'late_reschedule') {
    if (!appointment) return;
    const supabase = createClient();
    const { data: m } = await supabase
      .from('masters')
      .select('cancellation_policy')
      .eq('id', appointment.master_id)
      .single();
    const policy = (m?.cancellation_policy ?? {}) as { free_hours?: number };
    const freeHours = typeof policy.free_hours === 'number' ? policy.free_hours : 24;
    const hoursBefore = (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;
    if (hoursBefore >= freeHours) return; // уложился — без штрафа

    const { data: cl } = await supabase
      .from('clients')
      .select('rating, cancellation_count, behavior_indicators')
      .eq('id', appointment.client_id)
      .single();
    const newRating = Math.max(0, Number(cl?.rating ?? 5) - 0.5);
    const newCount = (cl?.cancellation_count ?? 0) + 1;
    const indicators: string[] = Array.isArray(cl?.behavior_indicators) ? [...cl.behavior_indicators] : [];
    if (newCount >= 2 && !indicators.includes('frequent_canceller')) indicators.push('frequent_canceller');

    await supabase
      .from('clients')
      .update({ rating: newRating, cancellation_count: newCount, behavior_indicators: indicators })
      .eq('id', appointment.client_id);

    toast.warning(
      reason === 'late_cancel'
        ? `Клиент вышел за лимит отмены (${freeHours}ч). Рейтинг −0.5`
        : `Клиент вышел за лимит переноса (${freeHours}ч). Рейтинг −0.5`,
    );
  }

  async function notifyWaitlistOnFreedSlot() {
    if (!appointment) return;
    const supabase = createClient();
    const aptDate = new Date(appointment.starts_at).toISOString().split('T')[0];
    const slotTime = new Date(appointment.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const { data: waitlistEntries } = await supabase
      .from('waitlist')
      .select('id, client_id, clients(profile_id)')
      .eq('master_id', appointment.master_id)
      .eq('desired_date', aptDate)
      .order('created_at', { ascending: true });

    if (!waitlistEntries?.length) return;
    const notifyRows = waitlistEntries
      .map((w) => {
        const c = w.clients as unknown as { profile_id: string | null } | null;
        if (!c?.profile_id) return null;
        return {
          profile_id: c.profile_id,
          channel: 'telegram',
          title: '🎉 Слот освободился!',
          body: `Появилось время ${aptDate} в ${slotTime}. Забронируйте прямо сейчас! [waitlist:${appointment.id}]`,
          scheduled_for: new Date().toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (notifyRows.length) await supabase.from('notifications').insert(notifyRows);
    await supabase.from('waitlist').delete().in('id', waitlistEntries.map((w) => w.id));
  }

  async function updateStatus(newStatus: AppointmentStatus) {
    if (!appointment) return;
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointment.id);

    if (error) { toast.error(error.message); setUpdating(false); return; }

    if (newStatus === 'cancelled') await notifyWaitlistOnFreedSlot();

    if (newStatus === 'no_show') {
      const { data: cl } = await supabase.from('clients').select('no_show_count, behavior_indicators').eq('id', appointment.client_id).single();
      const newCount = (cl?.no_show_count || 0) + 1;
      const indicators: string[] = Array.isArray(cl?.behavior_indicators) ? [...cl.behavior_indicators] : [];
      if (newCount >= 2 && !indicators.includes('frequent_canceller')) {
        indicators.push('frequent_canceller');
      }
      await supabase.from('clients').update({
        no_show_count: newCount,
        behavior_indicators: indicators,
      }).eq('id', appointment.client_id);

      await supabase.from('appointments').update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'no_show',
      }).eq('id', appointment.id);
    }

    setUpdating(false);
    toast.success(tc('success'));
    onUpdated();
  }

  // Отмена: master = status='cancelled' (счётчик мастера), client = 'cancelled_by_client' (счётчик клиента + штраф если поздно)
  async function cancelByInitiator(initiator: 'master' | 'client') {
    if (!appointment) return;
    setUpdating(true);
    const supabase = createClient();
    const newStatus: AppointmentStatus = initiator === 'client' ? 'cancelled_by_client' : 'cancelled';
    const reasonLabel = initiator === 'client' ? 'cancelled_by_client' : 'cancelled_by_master';
    const { error } = await supabase
      .from('appointments')
      .update({
        status: newStatus,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reasonLabel,
      })
      .eq('id', appointment.id);

    if (error) { toast.error(error.message); setUpdating(false); return; }

    if (initiator === 'client') await applyClientLatePenalty('late_cancel');
    await notifyWaitlistOnFreedSlot();

    setUpdating(false);
    setOptionsOpen(false);
    toast.success(initiator === 'client' ? 'Отменено клиентом' : 'Отменено мастером');
    onUpdated();
  }

  // Перенос: маркируем текущую как cancelled+reason='rescheduled_*', открываем drawer повтора (мастер выберет новое время)
  async function rescheduleByInitiator(initiator: 'master' | 'client') {
    if (!appointment) return;
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: initiator === 'client' ? 'rescheduled_by_client' : 'rescheduled_by_master',
      })
      .eq('id', appointment.id);

    if (error) { toast.error(error.message); setUpdating(false); return; }

    if (initiator === 'client') await applyClientLatePenalty('late_reschedule');

    setUpdating(false);
    setOptionsOpen(false);
    toast.success('Выберите новое время');
    onRepeat(appointment); // открываем drawer новой записи с тем же клиентом/услугой
    onClose();
  }

  if (!appointment) return null;

  const startDate = new Date(appointment.starts_at);
  const endDate = new Date(appointment.ends_at);
  const timeStart = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeEnd = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateLabel = startDate.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  const clientInitials = (appointment.client?.full_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const width = 420;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            flexShrink: 0,
            borderLeft: `0.8px solid ${C.border}`,
            backgroundColor: C.bg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* ─── Header: row1 (date + close), row2 (status + time) ─── */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: `0.8px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}>
            {/* Row 1: date + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.text,
                padding: '4px 10px',
                borderRadius: 999,
                border: `0.8px solid ${C.border}`,
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'center',
              }}>
                {dateLabel}
              </span>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.text,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Row 2: time only (status pill removed) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.text,
                padding: '4px 10px',
                borderRadius: 999,
                border: `0.8px solid ${C.border}`,
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'center',
              }}>
                {timeStart} – {timeEnd}
              </span>
            </div>
          </div>

          {/* ─── Scrollable content ─── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Client section */}
            <div style={{ padding: '16px', borderBottom: `0.8px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Client avatar */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: '#a5dff8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#000000',
                  flexShrink: 0,
                }}>
                  {clientInitials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => { onClose(); router.push(`/clients/${appointment.client_id}`); }}
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: C.text,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {appointment.client?.full_name || '—'}
                    </button>
                    {appointment.client?.has_health_alert && (
                      <AlertTriangle style={{ width: 14, height: 14, color: '#d4163a' }} />
                    )}
                  </div>
                  {appointment.client?.email && (
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                      {appointment.client.email}
                    </div>
                  )}
                </div>

                {/* Actions menu (icon-only — экономим ширину) */}
                <div ref={actionsRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setActionsOpen(!actionsOpen)}
                    aria-label="Действия с клиентом"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      border: `0.8px solid ${C.btnOutlineBorder}`,
                      backgroundColor: 'transparent',
                      color: C.text,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <MoreHorizontal style={{ width: 18, height: 18 }} />
                  </button>

                  {actionsOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 4,
                      zIndex: 100,
                      backgroundColor: C.popoverBg,
                      border: `0.8px solid ${C.popoverBorder}`,
                      borderRadius: 12,
                      boxShadow: C.popoverShadow,
                      padding: 4,
                      minWidth: 220,
                    }}>
                      <button
                        type="button"
                        onClick={() => { setActionsOpen(false); onClose(); router.push(`/clients/${appointment.client_id}`); }}
                        style={{
                          width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                          borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: C.text,
                          fontSize: 14, cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <UserRound style={{ width: 16, height: 16, color: C.textMuted }} />
                        Карточка клиента
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActionsOpen(false); onClose(); router.push(`/clients/${appointment.client_id}?edit=1`); }}
                        style={{
                          width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                          borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: C.text,
                          fontSize: 14, cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Pencil style={{ width: 16, height: 16, color: C.textMuted }} />
                        Изменить данные клиента
                      </button>
                      <div style={{ height: 1, backgroundColor: C.border, margin: '4px 0' }} />
                      {[
                        { icon: MessageSquare, label: 'Добавить оповещение' },
                        { icon: Shield, label: 'Добавить аллергию' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setActionsOpen(false)}
                          style={{
                            width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                            borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: C.text,
                            fontSize: 14, cursor: 'pointer', textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <item.icon style={{ width: 16, height: 16, color: C.textMuted }} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Client quick fields */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {appointment.client?.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted }}>
                    <Phone style={{ width: 14, height: 14 }} />
                    <a href={`tel:${appointment.client.phone}`} style={{ color: C.link, textDecoration: 'none' }}>
                      {appointment.client.phone}
                    </a>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted }}>
                  <Calendar style={{ width: 14, height: 14 }} />
                  Создано {startDate.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* ─── Services section ─── */}
            <div style={{ padding: '16px', borderBottom: `0.8px solid ${C.border}` }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: C.cardBg,
                border: `0.8px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                    {appointment.service?.name || '—'}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                    {durationMin} мин
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {appointment.price} {appointment.currency}
                </div>
              </div>

              {/* Add service button */}
              <button
                type="button"
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px dashed ${C.border}`,
                  backgroundColor: 'transparent',
                  color: C.textMuted,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Добавить услугу
              </button>
            </div>
          </div>

          {/* ─── Footer: Total + Options + Checkout ─── */}
          <div style={{
            borderTop: `0.8px solid ${C.border}`,
            padding: '12px 16px',
            flexShrink: 0,
          }}>
            {/* Total */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.textMuted }}>
                Всего к оплате
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                {appointment.price} {appointment.currency}
              </span>
            </div>

            {/* Action buttons row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Options menu */}
              <div ref={optionsRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(!optionsOpen)}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    border: `0.8px solid ${C.btnOutlineBorder}`,
                    backgroundColor: 'transparent',
                    color: C.text,
                    fontSize: 14,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Варианты
                  <ChevronDown style={{ width: 14, height: 14 }} />
                </button>

                {optionsOpen && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    zIndex: 100,
                    backgroundColor: C.popoverBg,
                    border: `0.8px solid ${C.popoverBorder}`,
                    borderRadius: 12,
                    boxShadow: C.popoverShadow,
                    padding: 6,
                    minWidth: 280,
                  }}>
                    <button
                      type="button"
                      onClick={() => { setOptionsOpen(false); onRepeat(appointment); onClose(); }}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.text, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <RefreshCw style={{ width: 16, height: 16, color: C.textMuted }} />
                      Повторить бронь
                    </button>

                    <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Перенести
                    </div>
                    <button
                      type="button"
                      onClick={() => rescheduleByInitiator('master')}
                      disabled={updating}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.text, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <ArrowRightLeft style={{ width: 16, height: 16, color: C.textMuted }} />
                      По моей инициативе
                    </button>
                    <button
                      type="button"
                      onClick={() => rescheduleByInitiator('client')}
                      disabled={updating}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.text, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.controlBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <User style={{ width: 16, height: 16, color: C.textMuted }} />
                      По инициативе клиента
                    </button>

                    <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Отменить
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelByInitiator('master')}
                      disabled={updating}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.danger, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.dangerSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                      По моей инициативе
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelByInitiator('client')}
                      disabled={updating}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.danger, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.dangerSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <User style={{ width: 16, height: 16 }} />
                      По инициативе клиента
                    </button>

                    <div style={{ height: 1, backgroundColor: C.border, margin: '6px 0' }} />
                    <button
                      type="button"
                      onClick={() => { setOptionsOpen(false); updateStatus('no_show'); }}
                      style={{
                        width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                        borderRadius: 8, border: 'none', backgroundColor: 'transparent',
                        color: C.danger, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.dangerSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <Ban style={{ width: 16, height: 16 }} />
                      Не пришёл (no-show)
                    </button>
                  </div>
                )}
              </div>

              {/* Checkout button */}
              <button
                type="button"
                onClick={() => updateStatus('completed')}
                disabled={updating || appointment.status === 'completed'}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 999,
                  border: `0.8px solid ${C.btnBg}`,
                  backgroundColor: C.btnBg,
                  color: C.btnText,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: appointment.status === 'completed' ? 'default' : 'pointer',
                  opacity: appointment.status === 'completed' ? 0.5 : 1,
                }}
              >
                {appointment.status === 'completed' ? 'Оформлено' : 'Оформить'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
