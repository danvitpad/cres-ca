/** --- YAML
 * name: AppointmentsListPage
 * description: Fresha-exact appointments list — filterable table with status badges, search, date range, sorting
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Download, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import { format, subMonths, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

type StatusFilter = 'all' | 'booked' | 'completed' | 'cancelled' | 'no_show';
type SortOrder = 'newest' | 'oldest' | 'created';

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  tip_amount: number;
  created_at: string;
  service?: { name: string } | null;
  client?: { full_name: string } | null;
  master?: { profile?: { full_name: string } | null } | null;
}

export default function AppointmentsListPage() {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;
  const { C } = usePageTheme();

  const { master } = useMaster();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const monthAgo = subMonths(new Date(), 1).toISOString();

    let query = supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, price, tip_amount, created_at, service:services(name), client:clients(full_name)')
      .eq('master_id', master.id)
      .gte('starts_at', monthAgo);

    if (sortOrder === 'oldest') {
      query = query.order('starts_at', { ascending: true });
    } else if (sortOrder === 'created') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('starts_at', { ascending: false });
    }

    const { data } = await query;
    setAppointments((data as unknown as AppointmentRow[]) || []);
    setLoading(false);
  }, [master?.id, sortOrder]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const filtered = useMemo(() => {
    let list = appointments;
    if (statusFilter !== 'all') {
      list = list.filter(a => {
        if (statusFilter === 'cancelled') {
          return a.status === 'cancelled' || a.status === 'cancelled_by_client' || a.status === 'cancelled_by_master';
        }
        return a.status === statusFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.client?.full_name || '').toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.service?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointments, statusFilter, search]);

  function getStatusStyle(status: string) {
    switch (status) {
      case 'booked': case 'confirmed': return { bg: C.badgeBg, text: C.badgeText, label: t('booked') };
      case 'completed': return { bg: C.successSoft, text: C.success, label: t('completed') };
      case 'cancelled': return { bg: C.dangerSoft, text: C.danger, label: t('cancelled') };
      case 'in_progress': return { bg: C.warningSoft, text: C.warning, label: t('inProgress') };
      case 'no_show': return { bg: C.dangerSoft, text: C.danger, label: t('noShow') };
      default: return { bg: C.badgeBg, text: C.badgeText, label: status };
    }
  }

  // Inline tip editing
  const [editingTip, setEditingTip] = useState<string | null>(null);
  const [tipValue, setTipValue] = useState('');

  async function saveTip(aptId: string) {
    const supabase = createClient();
    const amount = Number(tipValue) || 0;
    const { error } = await supabase.from('appointments').update({ tip_amount: amount }).eq('id', aptId);
    if (error) { toast.error(error.message); return; }
    setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, tip_amount: amount } : a));
    setEditingTip(null);
    toast.success('Чаевые сохранены');
  }

  const sortLabels: Record<SortOrder, string> = {
    newest: t('scheduledDateNewest'),
    oldest: t('scheduledDateOldest'),
    created: t('createdNewest'),
  };

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'booked', label: t('booked') },
    { key: 'completed', label: t('completed') },
    { key: 'cancelled', label: t('cancelled') },
    { key: 'no_show', label: t('noShow') },
  ];

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text, background: C.bg, padding: '32px 40px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('appointments')}</h1>
        <button
          style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Download size={14} />
          {t('export')}
        </button>
      </div>
      <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>{t('appointmentsDesc')}</p>

      {/* Search + filters row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchAppointments')}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface, color: C.text,
              fontSize: 13, outline: 'none', fontFamily: FONT,
            }}
          />
        </div>
        <button
          style={{
            padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textSecondary, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
          }}
        >
          {t('monthToDate')}
        </button>
        <button
          style={{
            padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.textSecondary, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
          }}
        >
          <SlidersHorizontal size={14} />
          {t('filters')}
        </button>
        {/* Sort */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={() => setShowSortMenu(v => !v)}
            style={{
              padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.surface, color: C.textSecondary, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT,
            }}
          >
            {sortLabels[sortOrder]}
            <ChevronDown size={14} />
          </button>
          {showSortMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 50, minWidth: 240,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}>
              {(Object.keys(sortLabels) as SortOrder[]).map(key => (
                <button
                  key={key}
                  onClick={() => { setSortOrder(key); setShowSortMenu(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px', border: 'none',
                    background: sortOrder === key ? C.rowHover : 'transparent',
                    color: C.text, fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: FONT,
                  }}
                >
                  {sortLabels[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {statusPills.map(pill => (
          <button
            key={pill.key}
            onClick={() => setStatusFilter(pill.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: FONT,
              background: statusFilter === pill.key ? C.accent : C.surfaceElevated,
              color: statusFilter === pill.key ? '#ffffff' : C.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('noAppointmentId')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('service')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('created')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('scheduledDate')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('teamMember')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('price')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>Tips</th>
              <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 14, borderRadius: 4, background: C.rowHover, animation: 'pulse 1.5s infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t('nothingFound')}</p>
                  <p style={{ fontSize: 13, color: C.textTertiary }}>{t('nothingFoundDesc')}</p>
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {filtered.map((appt, i) => {
                  const st = getStatusStyle(appt.status);
                  const dur = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000);
                  return (
                    <motion.tr
                      key={appt.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>#{appt.id.slice(0, 7).toUpperCase()}</span>
                        <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>{appt.client?.full_name || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{appt.service?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.textTertiary }}>
                        {format(new Date(appt.created_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, color: C.text }}>
                          {format(new Date(appt.starts_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                        </div>
                        <div style={{ fontSize: 11, color: C.textTertiary }}>{dur} {t('duration').toLowerCase()}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>—</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>
                        {(appt.price || 0).toLocaleString()} ${CURRENCY}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {editingTip === appt.id ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                              autoFocus
                              type="number"
                              value={tipValue}
                              onChange={e => setTipValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveTip(appt.id); if (e.key === 'Escape') setEditingTip(null); }}
                              style={{
                                width: 60, padding: '4px 6px', borderRadius: 4, textAlign: 'right',
                                border: `1px solid ${C.accent}`, background: C.rowHover, color: C.text,
                                fontSize: 12, fontFamily: FONT, outline: 'none',
                              }}
                            />
                            <button
                              onClick={() => saveTip(appt.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, padding: 2 }}
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingTip(appt.id); setTipValue(String(appt.tip_amount || 0)); }}
                            style={{
                              fontSize: 13, color: appt.tip_amount ? '#34d399' : C.textTertiary,
                              fontWeight: appt.tip_amount ? 600 : 400, cursor: 'pointer',
                              padding: '2px 6px', borderRadius: 4,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            title="Нажмите для редактирования"
                          >
                            {appt.tip_amount ? `${appt.tip_amount}` : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                          fontSize: 12, fontWeight: 500, background: st.bg, color: st.text,
                        }}>
                          {st.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, textAlign: 'center', fontSize: 12, color: C.textTertiary }}>
            {t('showing', { count: filtered.length, total: appointments.length })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
