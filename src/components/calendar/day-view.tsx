/** --- YAML
 * name: DayView
 * description: Fresha-exact day calendar — dark/light theme support, 10-min intervals, Fresha-style time labels with period-of-day suffix.
 * --- */

'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, X, CalendarPlus, Users, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppointmentData } from '@/hooks/use-appointments';
import { FONT } from '@/lib/dashboard-theme';

/* ─── Layout constants ─── */
const HOUR_HEIGHT = 96;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 2304px
const HEADER_HEIGHT = 110;
const AVATAR_SIZE = 56;
const DEFAULT_SLOT_MINUTES = 10;
const TIME_COL_WIDTH = 60; // 24-hour labels "12:00"
const DRAG_SNAP_MINUTES = 15; // snap to 15-min intervals during drag

/* ─── Fresha theme palettes (extracted from Playwright) ─── */
const LIGHT = {
  pageBg: '#ffffff',
  nonWorkingBg: '#f8f6fd',
  gridBorder: 'rgba(124,58,237,0.08)',
  gridBorderSub: 'rgba(124,58,237,0.04)',
  text: '#1a1530',
  timeText: '#64607a',
  timeLabelSuffix: '#9994ad',
  currentTime: '#ef4444',
  currentTimeBg: '#ffffff',
  avatarBg: '#ede9f7',
  avatarBorder: 'rgba(124,58,237,0.13)',
  avatarText: '#1a1530',
  cardBg: '#c4b5fd',
  cardText: '#1a1530',
  headerShadow: 'rgba(124,58,237,0.06) 0px 6px 4px 0px',
  popupBg: '#ffffff',
  popupBorder: 'rgba(124,58,237,0.13)',
  popupShadow: 'rgba(124,58,237,0.06) 0px 2px 8px 0px, rgba(124,58,237,0.10) 0px 4px 20px 0px',
  textMuted: '#64607a',
  accent: '#7c3aed',
  hoverSlot: 'rgba(124,58,237,0.06)',
  hoverPopupItem: '#f8f6fd',
  newBlockBg: 'rgba(124,58,237,0.12)',
  newBlockBorder: '#7c3aed',
  newBlockTimeText: '#7c3aed',
  stripe: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.02) 4px, rgba(0,0,0,0.02) 5px)`,
  emptyText: 'rgba(26,21,48,0.3)',
};

const DARK = {
  pageBg: '#0b0d17',
  nonWorkingBg: '#0f1120',
  gridBorder: 'rgba(139,92,246,0.1)',
  gridBorderSub: 'rgba(139,92,246,0.05)',
  text: '#eae8f4',
  timeText: '#a8a3be',
  timeLabelSuffix: '#706c87',
  currentTime: '#f87171',
  currentTimeBg: '#0b0d17',
  avatarBg: '#1a1d30',
  avatarBorder: 'rgba(139,92,246,0.16)',
  avatarText: '#c4b5fd',
  cardBg: '#8b5cf6',
  cardText: '#ffffff',
  headerShadow: 'rgba(0, 0, 0, 0.4) 0px 6px 4px 0px',
  popupBg: '#111425',
  popupBorder: 'rgba(139,92,246,0.16)',
  popupShadow: 'rgba(0,0,0,0.4) 0px 2px 8px 0px, rgba(0,0,0,0.5) 0px 4px 20px 0px',
  textMuted: '#a8a3be',
  accent: '#8b5cf6',
  hoverSlot: 'rgba(139,92,246,0.12)',
  hoverPopupItem: '#151830',
  newBlockBg: 'rgba(139,92,246,0.2)',
  newBlockBorder: '#8b5cf6',
  newBlockTimeText: '#a78bfa',
  stripe: `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.015) 4px, rgba(255,255,255,0.015) 5px)`,
  emptyText: 'rgba(234,232,244,0.25)',
};

/* ─── 24-hour time label (European format) ─── */
function freshaTimeLabel(hour: number): { time: string; suffix: string } {
  return { time: `${String(hour).padStart(2, '0')}:00`, suffix: '' };
}

function freshaTimeLabelMin(hour: number, min: number): string {
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface BlockedTime {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

interface DayViewProps {
  date: Date;
  appointments: AppointmentData[];
  blockedTimes?: BlockedTime[];
  workStart: number;
  workEnd: number;
  masterName?: string;
  masterAvatar?: string | null;
  masterId?: string;
  /** Show the master avatar header above the grid. Defaults to true. For solo mode pass false to hide. */
  showMasterHeader?: boolean;
  /** Slot interval in minutes (5/10/15/30/60). Controls grid granularity. Default 10. */
  slotMinutes?: number;
  /** When false, clicking a slot opens side panel directly instead of popup. Default true. */
  showQuickActions?: boolean;
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: AppointmentData) => void;
  onRefetch: () => void;
  onOpenBlockDrawer?: (time: string) => void;
  onEditBlock?: (block: { id: string; starts_at: string; ends_at: string; reason: string | null }) => void;
  /** When true, clears the preview block on the calendar */
  clearSelection?: boolean;
}

interface SlotPopup {
  slotIndex: number;
  x: number;
  y: number;
  time: string;
}

/* Default new-appointment preview block: ~30min worth of slots (computed dynamically) */

export function DayView({
  date,
  appointments,
  blockedTimes = [],
  workStart,
  workEnd,
  masterName,
  masterAvatar,
  masterId,
  showMasterHeader = true,
  slotMinutes: slotMinutesProp,
  showQuickActions = true,
  onSlotClick,
  onAppointmentClick,
  onRefetch,
  onOpenBlockDrawer,
  onEditBlock,
  clearSelection,
}: DayViewProps) {
  const t = useTranslations('calendar');
  const { resolvedTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGhostY, setDragGhostY] = useState<number | null>(null);
  const [dragGhostH, setDragGhostH] = useState<number>(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [slotPopup, setSlotPopup] = useState<SlotPopup | null>(null);
  const [mounted, setMounted] = useState(false);

  /* ─── Derived from slotMinutes prop ─── */
  const SLOT_MINUTES = slotMinutesProp ?? DEFAULT_SLOT_MINUTES;
  const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
  const SLOT_HEIGHT = HOUR_HEIGHT / SLOTS_PER_HOUR;
  const INTERVALS_PER_HOUR = SLOTS_PER_HOUR;
  const INTERVAL_HEIGHT = SLOT_HEIGHT;

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (clearSelection) setSlotPopup(null); }, [clearSelection]);

  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
  const isToday = date.toDateString() === new Date().toDateString();

  /* ── Current time ── */
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Scroll to work start ── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, workStart * HOUR_HEIGHT - HOUR_HEIGHT);
    }
  }, [workStart, date]);

  /* ── Helpers ── */
  const currentTimeY = (currentMinute / 60) * HOUR_HEIGHT;
  const curH = Math.floor(currentMinute / 60);
  const curM = currentMinute % 60;
  const currentTimeLabel = `${freshaTimeLabelMin(curH, curM)}`;

  function timeToY(dateStr: string): number {
    const d = new Date(dateStr);
    return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
  }

  function durationToH(startStr: string, endStr: string): number {
    const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
    return (ms / 3_600_000) * HOUR_HEIGHT;
  }

  function yToMinutes(y: number): number {
    return (y / TOTAL_HEIGHT) * TOTAL_HOURS * 60;
  }

  function snapMinutes(min: number, snap: number = DRAG_SNAP_MINUTES): number {
    return Math.round(min / snap) * snap;
  }

  function yToTime(y: number): string {
    const snapped = snapMinutes(yToMinutes(y), SLOT_MINUTES);
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Convert Y position to snapped Y (15-min grid) for drag preview */
  function snapY(y: number): number {
    const min = snapMinutes(yToMinutes(y), DRAG_SNAP_MINUTES);
    return (min / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT;
  }

  function slotToTime(i: number): string {
    const m = i * SLOT_MINUTES;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  function isSlotWorking(i: number) {
    const h = (i * SLOT_MINUTES) / 60;
    return h >= workStart && h < workEnd;
  }

  function isSlotOccupied(i: number) {
    const s0 = i * SLOT_MINUTES, s1 = s0 + SLOT_MINUTES;
    const occupiedByAppt = appointments.some((a) => {
      const as = new Date(a.starts_at), ae = new Date(a.ends_at);
      const am0 = as.getHours() * 60 + as.getMinutes();
      const am1 = ae.getHours() * 60 + ae.getMinutes();
      return s0 < am1 && s1 > am0;
    });
    if (occupiedByAppt) return true;
    return blockedTimes.some((bt) => {
      const bs = new Date(bt.starts_at), be = new Date(bt.ends_at);
      const bm0 = bs.getHours() * 60 + bs.getMinutes();
      const bm1 = be.getHours() * 60 + be.getMinutes();
      return s0 < bm1 && s1 > bm0;
    });
  }

  function handleSlotClick(i: number, e: React.MouseEvent) {
    if (!isSlotWorking(i) || isSlotOccupied(i)) return;
    const time = slotToTime(i);
    // Quick actions disabled → open side panel directly
    if (!showQuickActions) {
      onSlotClick(time);
      return;
    }
    // Get click position relative to grid for popup positioning
    const rect = gridRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const y = rect ? e.clientY - rect.top + (scrollRef.current?.scrollTop || 0) : 0;
    setSlotPopup({ slotIndex: i, x, y, time });
  }

  function handlePopupAction(action: string) {
    if (!slotPopup) return;
    if (action === 'appointment') {
      onSlotClick(slotPopup.time);
      setSlotPopup(null);
    } else if (action === 'group') {
      onSlotClick(slotPopup.time);
      setSlotPopup(null);
      toast.info(t('groupBookingHint') || 'Выберите групповую услугу в диалоге записи');
    } else if (action === 'block') {
      setSlotPopup(null);
      onOpenBlockDrawer?.(slotPopup.time);
    }
  }

  function isDraggable(appt: AppointmentData): boolean {
    return appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!gridRef.current || !dragId) return;
    const rect = gridRef.current.getBoundingClientRect();
    const rawY = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const appt = appointments.find((a) => a.id === dragId);
    if (!appt) return;
    const dur = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
    const durH = (dur / 3_600_000) * HOUR_HEIGHT;
    setDragGhostY(snapY(rawY));
    setDragGhostH(durH);
  }

  function handleDragLeave() {
    setDragGhostY(null);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragGhostY(null);
    if (!gridRef.current || !dragId) { setDragId(null); return; }

    const rect = gridRef.current.getBoundingClientRect();
    const rawY = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const snappedMin = snapMinutes(yToMinutes(rawY), DRAG_SNAP_MINUTES);
    const h = Math.floor(snappedMin / 60);
    const m = snappedMin % 60;

    const appt = appointments.find((a) => a.id === dragId);
    if (!appt) { setDragId(null); return; }

    const ns = new Date(date); ns.setHours(h, m, 0, 0);
    const dur = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
    const ne = new Date(ns.getTime() + dur);

    // Check for overlaps with other appointments
    const overlap = appointments.some((a) => {
      if (a.id === dragId) return false;
      return ns.getTime() < new Date(a.ends_at).getTime() && ne.getTime() > new Date(a.starts_at).getTime();
    });
    if (overlap) { toast.error(t('slotOccupied')); setDragId(null); return; }

    // Check for overlaps with blocked times
    const blockedOverlap = blockedTimes.some((bt) => {
      return ns.getTime() < new Date(bt.ends_at).getTime() && ne.getTime() > new Date(bt.starts_at).getTime();
    });
    if (blockedOverlap) { toast.error(t('slotOccupied')); setDragId(null); return; }

    const supabase = createClient();
    const { error } = await supabase.from('appointments')
      .update({ starts_at: ns.toISOString(), ends_at: ne.toISOString() }).eq('id', appt.id);
    if (error) toast.error(error.message); else onRefetch();
    setDragId(null);
  }

  const initials = masterName
    ? masterName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const workHighlightTop = workStart * HOUR_HEIGHT;
  const workHighlightHeight = (workEnd - workStart) * HOUR_HEIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', backgroundColor: C.pageBg }}>

        {/* ═══ Avatar header — shown only in team/salon mode ═══ */}
        {showMasterHeader && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            height: HEADER_HEIGHT,
            backgroundColor: C.pageBg,
            borderBottom: `0.8px solid ${C.gridBorder}`,
            boxShadow: C.headerShadow,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 6,
              paddingLeft: TIME_COL_WIDTH,
            }}
          >
            <div style={{ position: 'relative' }}>
              {masterAvatar ? (
                <img
                  src={masterAvatar}
                  alt={masterName || ''}
                  style={{
                    width: AVATAR_SIZE, height: AVATAR_SIZE,
                    borderRadius: 999, objectFit: 'cover',
                    border: `1px solid ${C.avatarBorder}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: 999,
                    backgroundColor: C.avatarBg,
                    border: `1px solid ${C.avatarBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: C.avatarText,
                      fontFamily: FONT,
                    }}
                  >
                    {initials}
                  </span>
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                fontFamily: FONT,
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {masterName || '\u2014'}
            </span>
          </div>
        </div>
        )}

        {/* ═══ Grid container ═══ */}
        <div
          ref={gridRef}
          style={{ position: 'relative', height: TOTAL_HEIGHT }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >

          {/* Non-working background */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: TIME_COL_WIDTH,
              right: 0,
              backgroundColor: C.nonWorkingBg,
              backgroundImage: C.stripe,
            }}
          />

          {/* Time column background */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: TIME_COL_WIDTH,
              backgroundColor: C.pageBg,
            }}
          />

          {/* Working hours overlay */}
          <div
            style={{
              position: 'absolute',
              top: workHighlightTop,
              left: TIME_COL_WIDTH,
              right: 0,
              height: workHighlightHeight,
              backgroundColor: C.pageBg,
            }}
          />

          {/* ── Grid lines — 10-min intervals, labels at :00 with suffix, sub-labels at :30 ── */}
          {Array.from({ length: TOTAL_HOURS * INTERVALS_PER_HOUR }, (_, i) => {
            const hour = Math.floor(i / INTERVALS_PER_HOUR);
            const minInHour = (i % INTERVALS_PER_HOUR) * SLOT_MINUTES;
            const isHourStart = minInHour === 0;
            const isHalfHour = minInHour === 30;
            const isTenMin = !isHourStart && !isHalfHour;

            const borderColor = isHourStart
              ? C.gridBorder
              : isHalfHour
                ? C.gridBorderSub
                : 'transparent';

            const label = freshaTimeLabel(hour);

            return (
              <div
                key={`int-${i}`}
                style={{
                  position: 'absolute',
                  left: TIME_COL_WIDTH,
                  right: 0,
                  top: i * INTERVAL_HEIGHT,
                  height: INTERVAL_HEIGHT,
                  borderTop: isTenMin ? 'none' : `0.8px solid ${borderColor}`,
                }}
              >
                {/* Hour label — Fresha style: "5:00\nвечера" */}
                {isHourStart && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '100%',
                      top: 0,
                      width: TIME_COL_WIDTH - 8,
                      marginRight: 8,
                      textAlign: 'right',
                      transform: 'translateY(-50%)',
                      fontFamily: FONT,
                      userSelect: 'none',
                      lineHeight: 1.2,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.timeText, display: 'block' }}>
                      {label.time}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 400, color: C.timeLabelSuffix, display: 'block' }}>
                      {label.suffix}
                    </span>
                  </div>
                )}
                {/* Half-hour sub-label — "5:30" smaller */}
                {isHalfHour && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '100%',
                      top: 0,
                      width: TIME_COL_WIDTH - 8,
                      marginRight: 8,
                      textAlign: 'right',
                      fontSize: 11,
                      fontWeight: 500,
                      lineHeight: '11px',
                      color: C.timeLabelSuffix,
                      transform: 'translateY(-50%)',
                      fontFamily: FONT,
                      userSelect: 'none',
                    }}
                  >
                    {freshaTimeLabelMin(hour, 30)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Vertical separator */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: TIME_COL_WIDTH,
              borderRight: `0.8px solid ${C.gridBorder}`,
            }}
          />

          {/* ── 10-min hover slots ── */}
          {Array.from({ length: TOTAL_HOURS * SLOTS_PER_HOUR }, (_, i) => {
            const working = isSlotWorking(i);
            const occupied = isSlotOccupied(i);
            const hovered = hoveredSlot === i;
            const isClickable = working && !occupied;
            const slotMin = i * SLOT_MINUTES;
            const h = Math.floor(slotMin / 60);
            const m = slotMin % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            return (
              <div
                key={`s-${i}`}
                style={{
                  position: 'absolute',
                  left: TIME_COL_WIDTH,
                  right: 0,
                  top: i * SLOT_HEIGHT,
                  height: SLOT_HEIGHT,
                  zIndex: 5,
                  backgroundColor: isClickable && hovered ? C.hoverSlot : undefined,
                  transition: 'background-color 100ms',
                  cursor: isClickable ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                }}
                onMouseEnter={() => isClickable && setHoveredSlot(i)}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={(e) => handleSlotClick(i, e)}
              >
                {/* Time label ON the hover strip */}
                {isClickable && hovered && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.newBlockTimeText,
                      fontFamily: FONT,
                      pointerEvents: 'none',
                    }}
                  >
                    {timeStr}
                  </span>
                )}
              </div>
            );
          })}

          {/* ── New appointment preview block + Fresha popup menu ── */}
          {slotPopup && (() => {
            const blockTop = slotPopup.slotIndex * SLOT_HEIGHT;
            const newBlockSlots = Math.max(1, Math.round(30 / SLOT_MINUTES));
            const blockHeight = newBlockSlots * SLOT_HEIGHT;
            const slotMin = slotPopup.slotIndex * SLOT_MINUTES;
            const h = Math.floor(slotMin / 60);
            const m = slotMin % 60;
            const timeStr24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            /* Popup position: centered on click, clamped to grid bounds */
            const popupW = 280;
            const popupH = 220;
            const popupLeft = Math.max(TIME_COL_WIDTH + 8, Math.min(slotPopup.x - popupW / 2, (gridRef.current?.scrollWidth || 800) - popupW - 8));
            const popupTop = Math.max(8, blockTop - popupH - 8);
            return (
              <>
                {/* Time label on the left in accent color */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: blockTop,
                    width: TIME_COL_WIDTH - 8,
                    height: SLOT_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 8,
                    zIndex: 42,
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.newBlockTimeText,
                      fontFamily: FONT,
                    }}
                  >
                    {timeStr}
                  </span>
                </div>
                {/* Colored block on the calendar grid */}
                <div
                  style={{
                    position: 'absolute',
                    left: TIME_COL_WIDTH + 1,
                    right: 1,
                    top: blockTop,
                    height: blockHeight,
                    zIndex: 38,
                    backgroundColor: C.newBlockBg,
                    border: `1.5px dashed ${C.newBlockBorder}`,
                    borderRadius: 4,
                    pointerEvents: 'none',
                    transition: 'all 150ms',
                  }}
                />
                {/* ── Fresha-style popup menu ── */}
                <div
                  style={{
                    position: 'absolute',
                    left: popupLeft,
                    top: popupTop < blockTop ? popupTop : blockTop + blockHeight + 8,
                    width: popupW,
                    zIndex: 100,
                    backgroundColor: C.popupBg,
                    border: `0.8px solid ${C.popupBorder}`,
                    borderRadius: 12,
                    boxShadow: C.popupShadow,
                    fontFamily: FONT,
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header: time + close X */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{timeStr24}</span>
                    <button
                      onClick={() => setSlotPopup(null)}
                      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.timeText }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                  {/* Actions list */}
                  <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { key: 'appointment', icon: CalendarPlus, label: t('addAppointment') },
                      { key: 'group', icon: Users, label: t('addGroupAppointment') },
                      { key: 'block', icon: Lock, label: t('blockTime') },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => handlePopupAction(item.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '10px 8px', border: 'none', borderRadius: 8,
                          backgroundColor: 'transparent', cursor: 'pointer',
                          fontSize: 14, fontWeight: 400, color: C.text, textAlign: 'left',
                          transition: 'background-color 100ms',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.hoverPopupItem)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <item.icon style={{ width: 18, height: 18, color: C.timeText, flexShrink: 0 }} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── Current time indicator ── */}
          {isToday && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: currentTimeY,
                  zIndex: 30,
                  width: TIME_COL_WIDTH,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: 4,
                    transform: 'translateY(-50%)',
                    border: `1.6px solid ${C.currentTime}`,
                    borderRadius: 10,
                    backgroundColor: C.currentTimeBg,
                    padding: '1px 4px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.currentTime,
                    lineHeight: '11px',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT,
                  }}
                >
                  {currentTimeLabel}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: currentTimeY,
                  left: TIME_COL_WIDTH - 4,
                  right: 0,
                  height: 0,
                  borderBottom: `1.6px solid ${C.currentTime}`,
                  zIndex: 25,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: C.currentTime,
                    top: -3,
                    left: 0,
                  }}
                />
              </div>
            </>
          )}

          {/* ── Appointment cards ── */}
          {/* ── Drag ghost preview ── */}
          {dragId && dragGhostY !== null && (() => {
            const appt = appointments.find((a) => a.id === dragId);
            if (!appt) return null;
            const color = appt.service?.color || C.cardBg;
            const ghostMin = snapMinutes(yToMinutes(dragGhostY), DRAG_SNAP_MINUTES);
            const ghostH = Math.floor(ghostMin / 60);
            const ghostM = ghostMin % 60;
            const ghostLabel = fmtTime(ghostH, ghostM);
            return (
              <div
                style={{
                  position: 'absolute',
                  left: TIME_COL_WIDTH + 1,
                  right: 1,
                  top: dragGhostY,
                  height: Math.max(INTERVAL_HEIGHT, dragGhostH),
                  zIndex: 45,
                  backgroundColor: color,
                  opacity: 0.45,
                  borderRadius: 4,
                  border: `2px dashed ${C.accent}`,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontFamily: FONT,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ghostLabel}</span>
              </div>
            );
          })()}

          {/* ── Appointment cards ── */}
          {appointments.map((appt) => {
            const top = timeToY(appt.starts_at);
            const height = durationToH(appt.starts_at, appt.ends_at);
            const color = appt.service?.color || C.cardBg;
            const st = new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const et = new Date(appt.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const cancelled = appt.status === 'cancelled' || appt.status === 'no_show';
            const canDrag = isDraggable(appt);

            return (
              <div
                key={appt.id}
                className={cn(
                  dragId === appt.id && 'opacity-40',
                  cancelled && 'opacity-40',
                )}
                style={{
                  position: 'absolute',
                  left: TIME_COL_WIDTH + 1,
                  right: 1,
                  top: Math.max(0, top),
                  height: Math.max(INTERVAL_HEIGHT, height),
                  zIndex: 40,
                  backgroundColor: color,
                  borderRadius: 4,
                  padding: '3px 4px 3px 8px',
                  overflow: 'hidden',
                  cursor: canDrag ? 'grab' : 'pointer',
                  transition: 'box-shadow 150ms',
                  fontFamily: FONT,
                }}
                onClick={() => onAppointmentClick(appt)}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                draggable={canDrag}
                onDragStart={(e) => {
                  if (!canDrag) { e.preventDefault(); return; }
                  setDragId(appt.id);
                  // Set drag image to semi-transparent clone
                  if (e.currentTarget) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', appt.id);
                  }
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragGhostY(null);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flexWrap: 'wrap' }}>
                  {appt.client?.has_health_alert && (
                    <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0, color: C.currentTime }} />
                  )}
                  <span style={{ fontSize: 13, color: C.cardText, whiteSpace: 'nowrap', lineHeight: '18.57px' }}>
                    {st} - {et}
                  </span>
                  <strong style={{ fontSize: 13, color: C.cardText, fontWeight: 700, lineHeight: '18.57px' }}>
                    {appt.client?.full_name ?? '\u2014'}
                  </strong>
                </div>
                {height > 40 && (
                  <div style={{ fontSize: 13, color: C.cardText, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '18.57px' }}>
                    {appt.service?.name}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Blocked time blocks ── */}
          {blockedTimes.map((bt) => {
            const top = timeToY(bt.starts_at);
            const height = durationToH(bt.starts_at, bt.ends_at);
            const st = new Date(bt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const et = new Date(bt.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={bt.id}
                onClick={() => onEditBlock?.({ id: bt.id, starts_at: bt.starts_at, ends_at: bt.ends_at, reason: bt.reason })}
                style={{
                  position: 'absolute',
                  left: TIME_COL_WIDTH + 1,
                  right: 1,
                  top: Math.max(0, top),
                  height: Math.max(INTERVAL_HEIGHT, height),
                  zIndex: 35,
                  backgroundColor: C.nonWorkingBg,
                  backgroundImage: C.stripe,
                  borderRadius: 4,
                  borderLeft: `3px solid ${C.accent}`,
                  padding: '4px 8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock style={{ width: 12, height: 12, color: C.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>{st} - {et}</span>
                </div>
                {bt.reason && height > 30 && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {bt.reason === 'lunch' ? '🍽️ Обід' : bt.reason}
                  </div>
                )}
              </div>
            );
          })}

          {/* (no empty state — clean grid like Fresha) */}
        </div>

        {/* Side panel is rendered by parent CalendarPage */}
      </div>
    </div>
  );
}
