/** --- YAML
 * name: Calendar Page
 * description: Fresha-exact calendar page — white toolbar with pill buttons, view/team/add dropdowns, day/week views
 * --- */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useMaster } from '@/hooks/use-master';
import { useAppointments } from '@/hooks/use-appointments';
import { useBlockedTimes } from '@/hooks/use-blocked-times';
import { DayView } from '@/components/calendar/day-view';
import { WeekView } from '@/components/calendar/week-view';
import { ThreeDayView } from '@/components/calendar/three-day-view';
import { MonthView } from '@/components/calendar/month-view';
import { NewAppointmentDialog } from '@/components/calendar/new-appointment-dialog';
import { AppointmentDetailDrawer } from '@/components/calendar/appointment-detail-drawer';
import { CalendarDrawer } from '@/components/calendar/calendar-drawer';
import { SettingsDrawerContent } from '@/components/calendar/settings-drawer';
import { WaitlistDrawerContent } from '@/components/calendar/waitlist-drawer';
import { FiltersDrawerContent } from '@/components/calendar/filters-drawer';
import { AnalyticsDrawerContent } from '@/components/calendar/analytics-drawer';
import { BlockTimeDrawerContent } from '@/components/calendar/block-time-drawer';
import { QuickSaleDrawer } from '@/components/calendar/quick-sale-drawer';
import { QuickPaymentModal } from '@/components/calendar/quick-payment-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  ListTodo,
  RotateCcw,
  SlidersHorizontal,
  CalendarDays,
  CalendarRange,
  Calendar as CalendarIcon,
  Grid3X3,
  CalendarPlus,
  Users,
  Lock,
  Search,
  Check,
  X,
  UserPlus,
  ShoppingBag,
  Banknote,
  BarChart3,
} from 'lucide-react';
import { FONT } from '@/lib/dashboard-theme';
import type { AppointmentData } from '@/hooks/use-appointments';

type ViewMode = 'day' | '3day' | 'week' | 'month';

/* ─── Toolbar constants (shared) ─── */
const TS = {
  toolbarPadding: '16px',
  btnHeight: 36,
  btnRadius: 999,
  btnFont: 14,
  btnFontWeight: 500,
  popoverRadius: 12,
  popoverItemH: 40,
  popoverItemPx: 12,
  popoverItemRadius: 8,
  fontFamily: FONT,
} as const;

/* ─── Theme palettes aligned with dashboard-theme.ts (purple accent, navy dark) ─── */
const TL = {
  toolbarBg: '#ffffff',
  toolbarBorder: 'rgba(124,58,237,0.07)',
  btnBorder: 'rgba(124,58,237,0.13)',
  btnBg: '#ffffff',
  btnHoverBg: '#f8f6fd',
  btnActiveBg: '#ede9f7',
  btnText: '#1a1530',
  addBg: '#7c3aed',
  addText: '#ffffff',
  addBorder: '#7c3aed',
  popoverBg: '#ffffff',
  popoverBorder: 'rgba(124,58,237,0.13)',
  popoverShadow: 'rgba(124,58,237,0.06) 0px 2px 8px 0px, rgba(124,58,237,0.10) 0px 4px 20px 0px',
  popoverItemActiveBg: 'rgba(124,58,237,0.08)',
  popoverItemHoverBg: '#f8f6fd',
  accent: '#7c3aed',
  accentSoft: 'rgba(124,58,237,0.08)',
  text: '#1a1530',
  textMuted: '#64607a',
};

const TD = {
  toolbarBg: '#111425',
  toolbarBorder: 'rgba(139,92,246,0.08)',
  btnBorder: 'rgba(139,92,246,0.16)',
  btnBg: '#111425',
  btnHoverBg: '#151830',
  btnActiveBg: '#1a1d30',
  btnText: '#eae8f4',
  addBg: '#8b5cf6',
  addText: '#ffffff',
  addBorder: '#8b5cf6',
  popoverBg: '#111425',
  popoverBorder: 'rgba(139,92,246,0.16)',
  popoverShadow: 'rgba(0,0,0,0.4) 0px 2px 8px 0px, rgba(0,0,0,0.5) 0px 4px 20px 0px',
  popoverItemActiveBg: 'rgba(139,92,246,0.12)',
  popoverItemHoverBg: '#151830',
  accent: '#8b5cf6',
  accentSoft: 'rgba(139,92,246,0.12)',
  text: '#eae8f4',
  textMuted: '#a8a3be',
};

type TTheme = typeof TL;

/* Shared pill button inline style (theme-aware) */
function pillBtn(F: TTheme, overrides?: React.CSSProperties): React.CSSProperties {
  return {
    height: TS.btnHeight,
    borderRadius: TS.btnRadius,
    borderWidth: '0.8px',
    borderStyle: 'solid',
    borderColor: F.btnBorder,
    backgroundColor: F.btnBg,
    color: F.btnText,
    fontSize: TS.btnFont,
    fontWeight: TS.btnFontWeight,
    fontFamily: TS.fontFamily,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms, border-color 150ms, scale 150ms',
    whiteSpace: 'nowrap' as const,
    ...overrides,
  };
}

/* Popover container style */
function popoverStyleFn(F: TTheme): React.CSSProperties {
  return {
    position: 'absolute',
    zIndex: 100000,
    backgroundColor: F.popoverBg,
    border: `0.8px solid ${F.popoverBorder}`,
    borderRadius: TS.popoverRadius,
    boxShadow: F.popoverShadow,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: TS.fontFamily,
    fontSize: 14,
    color: F.text,
  };
}

/* Popover item style */
function popoverItemStyle(F: TTheme, active?: boolean, hover?: boolean): React.CSSProperties {
  return {
    height: TS.popoverItemH,
    padding: `8px ${TS.popoverItemPx}px`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: TS.popoverItemRadius,
    backgroundColor: active ? F.popoverItemActiveBg : hover ? F.popoverItemHoverBg : 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    color: F.text,
    transition: 'background-color 150ms',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
  };
}

export default function CalendarPage() {
  const t = useTranslations('calendar');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const F: TTheme = mounted && resolvedTheme === 'dark' ? TD : TL;
  const { master, loading: masterLoading } = useMaster();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newDialogDefaults, setNewDialogDefaults] = useState<{
    date?: string;
    time?: string;
    clientId?: string;
    serviceId?: string;
  }>({});
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  /* ── Calendar settings (persisted in localStorage) ── */
  const SCALE_VALUES = [5, 10, 15, 30, 60];
  const [calendarScaleIdx, setCalendarScaleIdx] = useState(1); // default 10 min
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(true);
  useEffect(() => {
    try {
      const savedScale = localStorage.getItem('calendar_scale');
      if (savedScale) setCalendarScaleIdx(Number(savedScale));
      const savedQA = localStorage.getItem('calendar_quick_actions');
      if (savedQA !== null) setQuickActionsEnabled(savedQA !== 'false');
    } catch { /* noop */ }
  }, []);
  const slotMinutes = SCALE_VALUES[calendarScaleIdx] ?? 10;

  /* ── Side panel state (Fresha-style new appointment) ── */
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTime, setSidePanelTime] = useState('');
  const [sidePanelServices, setSidePanelServices] = useState<{ id: string; name: string; duration_minutes: number; price: number; currency: string; category_name?: string }[]>([]);
  const [sidePanelClients, setSidePanelClients] = useState<{ id: string; full_name: string }[]>([]);
  const [sidePanelSelectedClient, setSidePanelSelectedClient] = useState<string | null>(null);
  const [sidePanelServiceSearch, setSidePanelServiceSearch] = useState('');
  const [sidePanelClientSearch, setSidePanelClientSearch] = useState('');
  const [sidePanelSaving, setSidePanelSaving] = useState(false);
  const [sidePanelLoading, setSidePanelLoading] = useState(false);

  /* Dropdown states */
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  /* Quick sale / quick payment state */
  const [saleOpen, setSaleOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  /* Right-side drawer state */
  type DrawerType = 'settings' | 'waitlist' | 'filters' | 'analytics' | 'blockTime' | null;
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [blockTimeDefault, setBlockTimeDefault] = useState<string | undefined>(undefined);
  const [editingBlock, setEditingBlock] = useState<{ id: string; starts_at: string; ends_at: string; reason: string | null } | undefined>(undefined);

  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) setViewDropdownOpen(false);
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) setTeamDropdownOpen(false);
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) setAddDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Repeat-booking deep link from client card: /calendar?repeat=<apptId>&client=<id>&service=<id> */
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const repeat = searchParams.get('repeat');
    if (!repeat) return;
    const clientId = searchParams.get('client') ?? undefined;
    const serviceId = searchParams.get('service') ?? undefined;
    setNewDialogDefaults({ clientId, serviceId });
    setNewDialogOpen(true);
    router.replace('/calendar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { startDate, endDate } = useMemo(() => {
    if (view === 'day') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (view === '3day') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      // Go back to previous Monday for grid
      const startDow = start.getDay() - 1;
      if (startDow < 0) start.setDate(start.getDate() - 6);
      else if (startDow > 0) start.setDate(start.getDate() - startDow);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      // Go forward to next Sunday for grid
      const endDow = end.getDay();
      if (endDow > 0) end.setDate(end.getDate() + (7 - endDow));
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    const day = currentDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(currentDate);
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }, [view, currentDate]);

  const { appointments, isLoading, refetch } = useAppointments(
    master?.id,
    startDate,
    endDate,
  );

  const { blockedTimes, refetch: refetchBlocked } = useBlockedTimes(
    master?.id,
    startDate,
    endDate,
  );

  function refetchAll() { refetch(); refetchBlocked(); }

  const dayKey = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ][currentDate.getDay()];
  const dayHours = master?.working_hours?.[dayKey];
  const workStart = dayHours ? parseInt(dayHours.start.split(':')[0]) : 9;
  const workEnd = dayHours ? parseInt(dayHours.end.split(':')[0]) : 18;

  function navigate(delta: number) {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + delta);
    else if (view === '3day') d.setDate(d.getDate() + delta * 3);
    else if (view === 'month') d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleSlotClick(time: string) {
    setSidePanelTime(time);
    setSidePanelSelectedClient(null);
    setSidePanelServiceSearch('');
    setSidePanelOpen(true);
    setSidePanelLoading(true);
    // Load services and clients for side panel
    if (master?.id) {
      const supabase = createClient();
      Promise.all([
        supabase.from('services')
          .select('id, name, duration_minutes, price, currency, category_id')
          .eq('master_id', master.id).eq('is_active', true).order('name'),
        supabase.from('service_categories')
          .select('id, name')
          .eq('master_id', master.id),
        supabase.from('clients')
          .select('id, full_name')
          .eq('master_id', master.id).order('full_name').limit(200),
      ]).then(([servicesRes, catsRes, clientsRes]) => {
        const catMap = new Map<string, string>();
        if (catsRes.data) catsRes.data.forEach((c: any) => catMap.set(c.id, c.name));
        if (servicesRes.data) {
          setSidePanelServices(servicesRes.data.map((s: any) => ({
            id: s.id, name: s.name, duration_minutes: s.duration_minutes,
            price: s.price, currency: s.currency,
            category_name: s.category_id ? catMap.get(s.category_id) : undefined,
          })));
        }
        if (clientsRes.data) setSidePanelClients(clientsRes.data);
        setSidePanelLoading(false);
      });
    }
  }

  function closeSidePanel() {
    setSidePanelOpen(false);
    setSidePanelTime('');
  }

  async function handleSidePanelBookService(serviceId: string) {
    if (!master?.id) return;
    const service = sidePanelServices.find(s => s.id === serviceId);
    if (!service) return;

    const dateStr = currentDate.toISOString().split('T')[0];
    const startsAt = new Date(`${dateStr}T${sidePanelTime}:00`);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    if (!sidePanelSelectedClient || sidePanelSelectedClient === 'walk-in') {
      // Walk-in or no client: open dialog with pre-filled data (client can be added there)
      setNewDialogDefaults({ date: dateStr, time: sidePanelTime, serviceId });
      setNewDialogOpen(true);
      closeSidePanel();
      return;
    }

    setSidePanelSaving(true);
    const supabase = createClient();
    const { data: inserted, error } = await supabase.from('appointments').insert({
      client_id: sidePanelSelectedClient,
      master_id: master.id,
      service_id: serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
      currency: service.currency,
      status: 'booked',
      booked_via: 'manual',
    }).select('id').single();
    setSidePanelSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('appointmentCreated'));

    // Notify client if they have a profile
    if (inserted?.id) {
      const { data: client } = await supabase
        .from('clients')
        .select('profile_id')
        .eq('id', sidePanelSelectedClient)
        .single();
      if (client?.profile_id) {
        const timeStr = startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr2 = startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        await supabase.from('notifications').insert({
          profile_id: client.profile_id,
          title: 'Новая запись',
          body: `${masterName || 'Мастер'} записал вас на "${service.name}" — ${dateStr2}, ${timeStr}`,
          channel: 'push',
          data: { type: 'new_appointment', appointment_id: inserted.id },
        });
      }
    }

    closeSidePanel();
    refetch();
  }

  function handleAppointmentClick(appt: AppointmentData) {
    setSelectedAppointment(appt);
    setActiveDrawer(null); // close other drawers
    setActionsOpen(true);
  }

  function handleRepeat(appt: AppointmentData) {
    setNewDialogDefaults({
      clientId: appt.client_id,
      serviceId: appt.service_id,
    });
    setNewDialogOpen(true);
  }

  if (masterLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[calc(100vh-10rem)] w-full" />
      </div>
    );
  }

  if (!master) return null;

  const isToday = currentDate.toDateString() === new Date().toDateString();

  /* Fresha format: "птн 10 апр." — custom short weekday, no comma */
  const freshaWeekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'птн', 'сб'];
  const freshaMonths = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  const fmtDate = (d: Date) => `${d.getDate()} ${freshaMonths[d.getMonth()]}`;
  const dateLabel =
    view === 'day'
      ? `${freshaWeekdays[currentDate.getDay()]} ${fmtDate(currentDate)}`
      : `${fmtDate(startDate)} \u2014 ${fmtDate(endDate)}`;

  const viewLabels: Record<ViewMode, string> = {
    day: t('dayView'),
    '3day': t('threeDayView'),
    week: t('weekView'),
    month: t('monthView'),
  };

  const viewIcons: Record<ViewMode, React.ReactNode> = {
    day: <CalendarDays style={{ width: 20, height: 20 }} />,
    '3day': <CalendarRange style={{ width: 20, height: 20 }} />,
    week: <Grid3X3 style={{ width: 20, height: 20 }} />,
    month: <CalendarIcon style={{ width: 20, height: 20 }} />,
  };

  const masterName = master.profile?.full_name || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ═══ Toolbar — Fresha: white bg, 52px content, border-bottom ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: TS.toolbarPadding,
          backgroundColor: F.toolbarBg,
          borderBottom: `0.8px solid ${F.toolbarBorder}`,
          flexShrink: 0,
          position: 'relative',
          zIndex: 52,
          gap: 8,
        }}
      >
        {/* Left: Today + nav group + Team + filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* "Сегодня" pill button */}
          <button
            onClick={goToToday}
            style={pillBtn(F, { paddingLeft: 16, paddingRight: 16 })}
            onMouseDown={(e) => (e.currentTarget.style.scale = '0.96')}
            onMouseUp={(e) => (e.currentTarget.style.scale = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.scale = '1')}
          >
            {t('today')}
          </button>

          {/* Connected nav group: ◀ | date | ▶ */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => navigate(-1)}
              style={pillBtn(F, {
                width: 36, minWidth: 36, paddingLeft: 0, paddingRight: 0,
                borderRadius: '999px 0 0 999px',
              })}
              aria-label={t('previousDay')}
            >
              <ChevronLeft style={{ width: 20, height: 20 }} />
            </button>
            <button
              style={pillBtn(F, {
                minWidth: 175, maxWidth: 175,
                paddingLeft: 12, paddingRight: 12,
                borderRadius: 0,
                marginLeft: -1,
              })}
            >
              <span>{dateLabel}</span>
            </button>
            <button
              onClick={() => navigate(1)}
              style={pillBtn(F, {
                width: 36, minWidth: 36, paddingLeft: 0, paddingRight: 0,
                borderRadius: '0 999px 999px 0',
                marginLeft: -1,
              })}
              aria-label={t('nextDay')}
            >
              <ChevronRight style={{ width: 20, height: 20 }} />
            </button>
          </div>

          {/* "Команда смены" dropdown */}
          <div ref={teamDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setTeamDropdownOpen(!teamDropdownOpen); setViewDropdownOpen(false); setAddDropdownOpen(false); }}
              style={pillBtn(F, { paddingLeft: 16, paddingRight: 12, gap: 8, minWidth: 100, maxWidth: 320 })}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {masterName || t('teamShift') || 'Команда смены'}
              </span>
              {teamDropdownOpen
                ? <ChevronUp style={{ width: 20, height: 20, flexShrink: 0 }} />
                : <ChevronDown style={{ width: 20, height: 20, flexShrink: 0 }} />
              }
            </button>

            {/* Team Dropdown Popover */}
            {teamDropdownOpen && (
              <div style={{ ...popoverStyleFn(F), top: TS.btnHeight + 4, left: 0, width: 338 }}>
                {/* Search */}
                <div style={{ padding: '12px 12px 8px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: `0.8px solid ${F.toolbarBorder}`, borderRadius: 8, padding: '0 12px',
                    height: 40,
                  }}>
                    <Search style={{ width: 20, height: 20, color: F.textMuted, flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder={t('searchPlaceholder') || 'Поиск'}
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      style={{
                        flex: 1, border: 'none', outline: 'none', fontSize: 15,
                        fontFamily: TS.fontFamily, color: F.text, backgroundColor: 'transparent',
                      }}
                    />
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Shift team item (active) */}
                  <button
                    style={popoverItemStyle(F,true)}
                    onMouseEnter={() => setHoveredItem('shift')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <CalendarDays style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('teamShift') || 'Команда смены'}</span>
                  </button>

                  <div style={{ height: 1, backgroundColor: F.toolbarBorder, margin: '4px 0' }} />

                  {/* All team */}
                  <button
                    style={popoverItemStyle(F,false, hoveredItem === 'all')}
                    onMouseEnter={() => setHoveredItem('all')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Users style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('allTeam') || 'Вся команда'}</span>
                  </button>

                  {/* Current master */}
                  <button
                    style={popoverItemStyle(F,false, hoveredItem === 'me')}
                    onMouseEnter={() => setHoveredItem('me')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 999,
                      backgroundColor: '#ebf8fe', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, color: F.text, flexShrink: 0,
                    }}>
                      {masterName ? masterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                    </div>
                    <span>{masterName} ({t('you') || 'Вы'})</span>
                  </button>

                  <div style={{ height: 1, backgroundColor: F.toolbarBorder, margin: '4px 0' }} />

                  {/* Checkboxes section */}
                  <button
                    style={popoverItemStyle(F,false, hoveredItem === 'checkAll')}
                    onMouseEnter={() => setHoveredItem('checkAll')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      backgroundColor: F.accent, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Check style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <span style={{ fontWeight: 600 }}>{t('allTeamMembers') || 'Все участники команды'}</span>
                  </button>

                  <button
                    style={popoverItemStyle(F,false, hoveredItem === 'checkMe')}
                    onMouseEnter={() => setHoveredItem('checkMe')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      backgroundColor: F.accent, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Check style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 999,
                      backgroundColor: '#ebf8fe', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, color: F.text, flexShrink: 0,
                    }}>
                      {masterName ? masterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                    </div>
                    <span>{masterName}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filters visibility icon button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'filters' ? null : 'filters')}
            style={pillBtn(F, {
              width: 40, minWidth: 36, paddingLeft: 0, paddingRight: 0,
              ...(activeDrawer === 'filters' ? { backgroundColor: F.popoverItemActiveBg, borderColor: F.accent } : {}),
            })}
            aria-label="Filters"
          >
            <SlidersHorizontal style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Right: settings + waitlist + reset|view group + Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Settings icon */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'settings' ? null : 'settings')}
            style={pillBtn(F, {
              width: 40, minWidth: 36, paddingLeft: 0, paddingRight: 0,
              ...(activeDrawer === 'settings' ? { backgroundColor: F.popoverItemActiveBg, borderColor: F.accent } : {}),
            })}
            aria-label="Calendar settings"
          >
            <Settings style={{ width: 20, height: 20 }} />
          </button>

          {/* Waitlist icon */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'waitlist' ? null : 'waitlist')}
            style={pillBtn(F, {
              width: 40, minWidth: 36, paddingLeft: 0, paddingRight: 0,
              ...(activeDrawer === 'waitlist' ? { backgroundColor: F.popoverItemActiveBg, borderColor: F.accent } : {}),
            })}
            aria-label="Waitlist"
          >
            <ListTodo style={{ width: 20, height: 20 }} />
          </button>

          {/* Analytics icon */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'analytics' ? null : 'analytics')}
            style={pillBtn(F, {
              width: 40, minWidth: 36, paddingLeft: 0, paddingRight: 0,
              ...(activeDrawer === 'analytics' ? { backgroundColor: F.popoverItemActiveBg, borderColor: F.accent } : {}),
            })}
            aria-label="Performance analytics"
          >
            <BarChart3 style={{ width: 20, height: 20 }} />
          </button>

          {/* Connected group: Reset + View selector */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => { setCurrentDate(new Date()); setView('day'); setActiveDrawer(null); closeSidePanel(); setActionsOpen(false); }}
              style={pillBtn(F, {
                width: 40, minWidth: 36, paddingLeft: 0, paddingRight: 0,
                borderRadius: '999px 0 0 999px',
              })}
              aria-label="Reset view"
            >
              <RotateCcw style={{ width: 20, height: 20 }} />
            </button>

            {/* View selector dropdown */}
            <div ref={viewDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setViewDropdownOpen(!viewDropdownOpen); setTeamDropdownOpen(false); setAddDropdownOpen(false); }}
                style={pillBtn(F, {
                  minWidth: 86, paddingLeft: 16, paddingRight: 12, gap: 8,
                  borderRadius: '0 999px 999px 0', marginLeft: -1,
                })}
              >
                <span>{viewLabels[view]}</span>
                {viewDropdownOpen
                  ? <ChevronUp style={{ width: 20, height: 20, flexShrink: 0 }} />
                  : <ChevronDown style={{ width: 20, height: 20, flexShrink: 0 }} />
                }
              </button>

              {/* View Dropdown Popover */}
              {viewDropdownOpen && (
                <div style={{ ...popoverStyleFn(F), top: TS.btnHeight + 4, right: 0, width: 242 }}>
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(['day', '3day', 'week', 'month'] as ViewMode[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => { setView(v); setViewDropdownOpen(false); }}
                        style={popoverItemStyle(F,view === v, hoveredItem === `view-${v}`)}
                        onMouseEnter={() => setHoveredItem(`view-${v}`)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {viewIcons[v]}
                        <span>{viewLabels[v]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* "Добавить" split button — Fresha: dark/inverted */}
          <div ref={addDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setAddDropdownOpen(!addDropdownOpen); setViewDropdownOpen(false); setTeamDropdownOpen(false); }}
              style={pillBtn(F, {
                paddingLeft: 16, paddingRight: 12, gap: 8,
                backgroundColor: F.addBg, color: F.addText,
                border: `0.8px solid ${F.addBorder}`,
              })}
            >
              <span>{t('addButton')}</span>
              {addDropdownOpen
                ? <ChevronUp style={{ width: 20, height: 20, flexShrink: 0 }} />
                : <ChevronDown style={{ width: 20, height: 20, flexShrink: 0 }} />
              }
            </button>

            {/* Add Dropdown Popover */}
            {addDropdownOpen && (
              <div style={{ ...popoverStyleFn(F), top: TS.btnHeight + 4, right: 0, width: 260 }}>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={() => { setAddDropdownOpen(false); setNewDialogDefaults({}); setNewDialogOpen(true); }}
                    style={popoverItemStyle(F,false, hoveredItem === 'add-appt')}
                    onMouseEnter={() => setHoveredItem('add-appt')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <CalendarPlus style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('addAppointment')}</span>
                  </button>
                  <button
                    onClick={() => { setAddDropdownOpen(false); setNewDialogDefaults({}); setNewDialogOpen(true); }}
                    style={popoverItemStyle(F,false, hoveredItem === 'add-group')}
                    onMouseEnter={() => setHoveredItem('add-group')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Users style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('addGroupAppointment')}</span>
                  </button>
                  <button
                    onClick={() => { setAddDropdownOpen(false); setBlockTimeDefault(undefined); setEditingBlock(undefined); setActiveDrawer('blockTime'); }}
                    style={popoverItemStyle(F,false, hoveredItem === 'add-block')}
                    onMouseEnter={() => setHoveredItem('add-block')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Lock style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('blockTime')}</span>
                  </button>

                  <div style={{ height: 1, backgroundColor: F.toolbarBorder, margin: '4px 0' }} />

                  <button
                    onClick={() => { setAddDropdownOpen(false); setSaleOpen(true); }}
                    style={popoverItemStyle(F,false, hoveredItem === 'add-sale')}
                    onMouseEnter={() => setHoveredItem('add-sale')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <ShoppingBag style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('sale') || 'Продажа'}</span>
                  </button>
                  <button
                    onClick={() => { setAddDropdownOpen(false); setPaymentOpen(true); }}
                    style={popoverItemStyle(F,false, hoveredItem === 'add-payment')}
                    onMouseEnter={() => setHoveredItem('add-payment')}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Banknote style={{ width: 20, height: 20, color: F.textMuted }} />
                    <span>{t('quickPayment') || 'Быстрая оплата'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar grid + side panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Calendar */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {isLoading ? (
            <Skeleton className="h-[calc(100vh-10rem)] w-full" />
          ) : view === 'day' ? (
            <DayView
              date={currentDate}
              appointments={appointments}
              blockedTimes={blockedTimes}
              workStart={workStart}
              workEnd={workEnd}
              masterName={master.profile?.full_name}
              masterAvatar={master.profile?.avatar_url}
              masterId={master.id}
              slotMinutes={slotMinutes}
              showQuickActions={quickActionsEnabled}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              onRefetch={refetchAll}
              onOpenBlockDrawer={(time) => {
                setBlockTimeDefault(time);
                setEditingBlock(undefined);
                setActiveDrawer('blockTime');
              }}
              onEditBlock={(block) => {
                setEditingBlock(block);
                setBlockTimeDefault(undefined);
                setActiveDrawer('blockTime');
              }}
              clearSelection={!sidePanelOpen}
            />
          ) : view === '3day' ? (
            <ThreeDayView
              startDate={startDate}
              appointments={appointments}
              workStart={workStart}
              workEnd={workEnd}
              slotMinutes={slotMinutes}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              onDayClick={(d) => { setCurrentDate(d); setView('day'); }}
            />
          ) : view === 'month' ? (
            <MonthView
              currentDate={currentDate}
              appointments={appointments}
              onDayClick={(d) => { setCurrentDate(d); setView('day'); }}
              onAppointmentClick={handleAppointmentClick}
            />
          ) : (
            <WeekView
              weekStart={startDate}
              appointments={appointments}
              onDayClick={(d) => {
                setCurrentDate(d);
                setView('day');
              }}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
        </div>

        {/* ═══ Fresha-style side panel — two columns: clients LEFT, services RIGHT ═══ */}
        {sidePanelOpen && (
          <div
            style={{
              width: 680,
              flexShrink: 0,
              borderLeft: `0.8px solid ${F.toolbarBorder}`,
              backgroundColor: F.toolbarBg,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: TS.fontFamily,
            }}
          >
            {/* Top bar: close + minimize + focus (Fresha-exact) */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 4 }}>
              <button
                onClick={closeSidePanel}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: F.text }}
                title={t('close') || 'Закрыть панель'}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Two-column body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

              {/* ── LEFT: Clients column (Fresha: "Выберите клиента" heading, search, list rows) ── */}
              <div style={{ width: '45%', flexShrink: 0, borderRight: `0.8px solid ${F.toolbarBorder}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* "Выберите клиента" heading */}
                <div style={{ padding: '0 20px 16px' }}>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: 0 }}>
                    {t('selectClient')}
                  </h3>
                </div>

                {/* Client search */}
                <div style={{ padding: '0 20px 12px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: F.textMuted }} />
                    <input
                      type="text"
                      value={sidePanelClientSearch}
                      onChange={(e) => setSidePanelClientSearch(e.target.value)}
                      placeholder={t('findClient') || 'Найдите клиента или про...'}
                      style={{ width: '100%', padding: '10px 14px 10px 36px', fontSize: 14, borderRadius: 10, border: `1px solid ${F.btnBorder}`, backgroundColor: F.btnBg, color: F.text, outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Client list: Add client + Walk-in + existing clients */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                  {/* "Добавить клиента" row */}
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      width: '100%', padding: '12px 8px', border: 'none', borderRadius: 8,
                      backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = F.popoverItemHoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 999,
                      border: `2px solid ${F.accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <UserPlus style={{ width: 22, height: 22, color: F.accent }} />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: F.text }}>{t('addClient')}</span>
                  </button>

                  {/* "Без записи" (walk-in) row */}
                  <button
                    onClick={() => setSidePanelSelectedClient('walk-in')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      width: '100%', padding: '12px 8px', border: 'none', borderRadius: 8,
                      backgroundColor: sidePanelSelectedClient === 'walk-in' ? F.accentSoft : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'background-color 150ms',
                    }}
                    onMouseEnter={(e) => { if (sidePanelSelectedClient !== 'walk-in') e.currentTarget.style.backgroundColor = F.popoverItemHoverBg; }}
                    onMouseLeave={(e) => { if (sidePanelSelectedClient !== 'walk-in') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 999,
                      border: `2px solid ${F.accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Users style={{ width: 22, height: 22, color: F.accent }} />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: F.text }}>{t('walkIn') || 'Без записи'}</span>
                  </button>

                  {/* Existing clients list — Fresha-style rows: avatar circle + name + email */}
                  {sidePanelClients
                    .filter(c => c.full_name.toLowerCase().includes(sidePanelClientSearch.toLowerCase()))
                    .map(c => {
                      const isSelected = sidePanelSelectedClient === c.id;
                      const initials = c.full_name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSidePanelSelectedClient(isSelected ? null : c.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            width: '100%', padding: '12px 8px', border: 'none', borderRadius: 8,
                            backgroundColor: isSelected ? F.accentSoft : 'transparent',
                            cursor: 'pointer', transition: 'background-color 150ms', textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = F.popoverItemHoverBg; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{
                            width: 48, height: 48, borderRadius: 999,
                            backgroundColor: isSelected ? F.accent : '#e8e0f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 150ms',
                          }}>
                            <span style={{ fontSize: 16, fontWeight: 600, color: isSelected ? '#ffffff' : F.accent }}>{initials}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, color: F.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.full_name}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  }
                  {sidePanelClients.length === 0 && !sidePanelLoading && (
                    <p style={{ fontSize: 13, color: F.textMuted, textAlign: 'center', padding: '20px 0' }}>{t('noClients')}</p>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Services column ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* "Выберите услугу" heading */}
                <div style={{ padding: '0 24px 0' }}>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: 0 }}>
                    {t('selectService')}
                  </h3>
                </div>

                {/* Search services */}
                <div style={{ padding: '16px 24px 12px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: F.textMuted }} />
                    <input
                      type="text"
                      value={sidePanelServiceSearch}
                      onChange={(e) => setSidePanelServiceSearch(e.target.value)}
                      placeholder={t('searchServices')}
                      style={{ width: '100%', padding: '10px 14px 10px 36px', fontSize: 14, borderRadius: 10, border: `1px solid ${F.btnBorder}`, backgroundColor: F.btnBg, color: F.text, outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Service list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
                  {sidePanelLoading ? (
                    <div style={{ padding: '20px 0', textAlign: 'center' }}>
                      <div style={{ width: 24, height: 24, border: `2px solid ${F.btnBorder}`, borderTopColor: F.accent, borderRadius: 999, margin: '0 auto', animation: 'spin 0.6s linear infinite' }} />
                      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                  ) : sidePanelServices.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, color: F.textMuted, margin: 0 }}>{t('noServices')}</p>
                      <Link href="/services" style={{ fontSize: 13, color: F.accent, marginTop: 8, display: 'inline-block' }}>{t('goToServices')}</Link>
                    </div>
                  ) : (() => {
                    const filtered = sidePanelServices.filter(s =>
                      s.name.toLowerCase().includes(sidePanelServiceSearch.toLowerCase())
                    );
                    const groups = new Map<string, typeof filtered>();
                    filtered.forEach(s => {
                      const cat = s.category_name || t('uncategorized');
                      if (!groups.has(cat)) groups.set(cat, []);
                      groups.get(cat)!.push(s);
                    });
                    return Array.from(groups.entries()).map(([cat, services]) => (
                      <div key={cat} style={{ marginBottom: 8 }}>
                        {/* Category header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 10px' }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: F.text }}>{cat}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: F.textMuted, backgroundColor: F.popoverItemHoverBg, borderRadius: 999, padding: '1px 8px' }}>{services.length}</span>
                        </div>
                        {/* Service items with left accent border */}
                        {services.map(s => {
                          const durH = Math.floor(s.duration_minutes / 60);
                          const durM = s.duration_minutes % 60;
                          const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}min` : `${durH}h`) : `${durM}min`;
                          return (
                            <button
                              key={s.id}
                              onClick={() => handleSidePanelBookService(s.id)}
                              disabled={sidePanelSaving}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', padding: '16px 12px 16px 16px',
                                borderRadius: 0, border: 'none',
                                borderLeft: `3px solid ${F.accent}`,
                                borderBottom: `0.8px solid ${F.toolbarBorder}`,
                                backgroundColor: 'transparent', cursor: 'pointer',
                                transition: 'background-color 150ms', textAlign: 'left',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = F.popoverItemHoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 500, color: F.text }}>{s.name}</div>
                                <div style={{ fontSize: 13, color: F.textMuted, marginTop: 3 }}>{durStr}</div>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: F.text, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                                {s.price} {s.currency}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Right-side drawers (settings, waitlist, filters, analytics) ═══ */}
        <CalendarDrawer
          open={activeDrawer === 'settings'}
          onClose={() => setActiveDrawer(null)}
          title="Настройки календаря"
          width={360}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <SettingsDrawerContent
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
            initialScale={calendarScaleIdx}
            initialQuickActions={quickActionsEnabled}
            onApply={(settings) => {
              setCalendarScaleIdx(settings.scale);
              setQuickActionsEnabled(settings.quickActions);
              try {
                localStorage.setItem('calendar_scale', String(settings.scale));
                localStorage.setItem('calendar_quick_actions', String(settings.quickActions));
              } catch { /* noop */ }
              setActiveDrawer(null);
            }}
          />
        </CalendarDrawer>

        <CalendarDrawer
          open={activeDrawer === 'waitlist'}
          onClose={() => setActiveDrawer(null)}
          title="Лист ожидания"
          width={380}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <WaitlistDrawerContent
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        </CalendarDrawer>

        <CalendarDrawer
          open={activeDrawer === 'filters'}
          onClose={() => setActiveDrawer(null)}
          title="Фильтры видимости"
          width={380}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <FiltersDrawerContent
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
            onApply={() => setActiveDrawer(null)}
          />
        </CalendarDrawer>

        <CalendarDrawer
          open={activeDrawer === 'analytics'}
          onClose={() => setActiveDrawer(null)}
          title="Аналитика"
          width={400}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <AnalyticsDrawerContent
            masterId={master.id}
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        </CalendarDrawer>

        <CalendarDrawer
          open={activeDrawer === 'blockTime'}
          onClose={() => { setActiveDrawer(null); setEditingBlock(undefined); }}
          title={editingBlock ? (t('editBlockTime') || 'Редактировать блокировку') : (t('blockTime') || 'Заблокировать время')}
          width={380}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <BlockTimeDrawerContent
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
            masterId={master.id}
            masterName={master.profile?.full_name}
            date={currentDate}
            defaultTime={blockTimeDefault}
            editBlock={editingBlock}
            onSaved={refetchAll}
            onClose={() => { setActiveDrawer(null); setEditingBlock(undefined); }}
          />
        </CalendarDrawer>

        {/* Appointment detail drawer (Fresha-style right panel) */}
        <AppointmentDetailDrawer
          appointment={selectedAppointment}
          open={actionsOpen}
          onClose={() => { setActionsOpen(false); setSelectedAppointment(null); }}
          onUpdated={() => { refetch(); }}
          onRepeat={handleRepeat}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        />
      </div>

      {/* Quick sale drawer */}
      <QuickSaleDrawer
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        services={sidePanelServices.map(s => ({ id: s.id, name: s.name, price: s.price, color: '#6950f3', currency: s.currency }))}
      />

      {/* Quick payment modal */}
      {paymentOpen && (
        <QuickPaymentModal
          onClose={() => setPaymentOpen(false)}
          theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        />
      )}

      {/* Dialogs (fallback for repeat / add-button actions) */}
      <NewAppointmentDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        masterId={master.id}
        defaultDate={newDialogDefaults.date}
        defaultTime={newDialogDefaults.time}
        defaultClientId={newDialogDefaults.clientId}
        defaultServiceId={newDialogDefaults.serviceId}
        onCreated={refetch}
      />
    </div>
  );
}
