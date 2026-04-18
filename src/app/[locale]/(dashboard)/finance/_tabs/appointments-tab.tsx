/** --- YAML
 * name: AppointmentsTab
 * description: Appointments tab — filterable table with status badges, search, date range, sorting, tip editing. Extracted from appointments page for use inside finance tabs layout.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Search, ChevronDown, Check, AlertTriangle, CircleDashed, CircleCheck, CircleX, CircleDotDashed, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { FONT, CURRENCY, type PageTheme } from '@/lib/dashboard-theme';
import { Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  Filters,
  FilterAddButton,
  matchFilter,
  type Filter,
  type FilterConfig,
} from '@/components/ui/filters';

const PAGE_SIZE = 20;
import { format, subMonths, type Locale } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { uk } from 'date-fns/locale/uk';
import { enUS } from 'date-fns/locale/en-US';

const dateFnsLocales: Record<string, Locale> = { ru, uk, en: enUS };

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

export function AppointmentsTab({ C }: { C: PageTheme }) {
  const t = useTranslations('sales');
  const locale = useLocale();
  const dfLocale = dateFnsLocales[locale] || ru;

  const { master } = useMaster();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);

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

    for (const f of filters) {
      if (f.value.length === 0) continue;
      if (f.type === 'status') {
        const matcher = matchFilter<AppointmentRow>(f, a => {
          if (a.status.startsWith('cancelled')) return 'cancelled';
          return a.status;
        });
        list = list.filter(matcher);
      } else if (f.type === 'service') {
        const matcher = matchFilter<AppointmentRow>(f, a => a.service?.name ?? '');
        list = list.filter(matcher);
      }
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
  }, [appointments, filters, search]);

  useEffect(() => { setPage(1); }, [search, filters, sortOrder]);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

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

  // AI-banner: detect no-show pattern in last 30 days
  const noShowCount = useMemo(
    () => appointments.filter(a => a.status === 'no_show').length,
    [appointments]
  );
  const cancelledCount = useMemo(
    () => appointments.filter(a =>
      a.status === 'cancelled' || a.status === 'cancelled_by_client' || a.status === 'cancelled_by_master'
    ).length,
    [appointments]
  );

  const sortLabels: Record<SortOrder, string> = {
    newest: t('scheduledDateNewest'),
    oldest: t('scheduledDateOldest'),
    created: t('createdNewest'),
  };

  // Stable per-master sequence number derived from creation order.
  // Same appointment keeps the same # regardless of current sort/filter.
  const seqMap = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...appointments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    sorted.forEach((a, i) => map.set(a.id, i + 1));
    return map;
  }, [appointments]);

  const uniqueServices = useMemo(() => {
    const names = new Set<string>();
    for (const a of appointments) {
      if (a.service?.name) names.add(a.service.name);
    }
    return Array.from(names).sort();
  }, [appointments]);

  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      type: 'status',
      label: t('status'),
      kind: 'enum',
      icon: <CircleDashed className="size-3.5" />,
      options: [
        { value: 'booked', label: t('booked'), icon: <CircleDashed className="size-3.5 text-blue-400" /> },
        { value: 'completed', label: t('completed'), icon: <CircleCheck className="size-3.5 text-emerald-400" /> },
        { value: 'cancelled', label: t('cancelled'), icon: <CircleX className="size-3.5 text-rose-400" /> },
        { value: 'no_show', label: t('noShow'), icon: <CircleDotDashed className="size-3.5 text-amber-400" /> },
      ],
    },
    {
      type: 'service',
      label: t('service'),
      kind: 'multi-enum',
      icon: <Tag className="size-3.5" />,
      options: uniqueServices.map(name => ({ value: name, label: name })),
    },
  ], [t, uniqueServices]);

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C.text }}>{t('appointments')}</h1>
        {/* Export button removed until CSV export is finalised */}
      </div>
      <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>{t('appointmentsDesc')}</p>

      {/* AI-banner: no-show / cancellation warning */}
      {(noShowCount >= 3 || cancelledCount >= 5) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 18px',
            background: C.warningSoft,
            border: `1px solid ${C.warning}`,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(245,158,11,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={16} style={{ color: C.warning }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4,
            }}>
              {noShowCount >= 3
                ? `${noShowCount} неявки за месяц`
                : `${cancelledCount} отмен за месяц`}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              {noShowCount >= 3
                ? 'Рекомендуем включить предоплату или депозит для новых клиентов — это снизит потери от неявок.'
                : 'Высокий уровень отмен. Попробуйте автоматические напоминания за 24 часа до записи.'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Search + filter-bar + sort row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
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

        <Filters configs={filterConfigs} filters={filters} setFilters={setFilters} />
        <FilterAddButton configs={filterConfigs} filters={filters} setFilters={setFilters} label={t('filters')} />
        {filters.length > 0 && (
          <button
            onClick={() => setFilters([])}
            style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textSecondary, fontSize: 12, cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            Clear
          </button>
        )}

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

      {/* Table */}
      {loading ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 40, borderRadius: 4, background: C.rowHover, marginBottom: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t('nothingFound')}</p>
          <p style={{ fontSize: 13, color: C.textTertiary }}>{t('nothingFoundDesc')}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Table C={C}>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t('noAppointmentId')}</Table.Head>
                <Table.Head>{t('service')}</Table.Head>
                <Table.Head>{t('created')}</Table.Head>
                <Table.Head>{t('scheduledDate')}</Table.Head>
                <Table.Head align="right">{t('price')}</Table.Head>
                <Table.Head align="right">Чаевые</Table.Head>
                <Table.Head align="right">{t('status')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body interactive>
              {pageRows.map((appt) => {
                const st = getStatusStyle(appt.status);
                const dur = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000);
                return (
                  <Table.Row key={appt.id}>
                    <Table.Cell>
                      <span style={{ color: C.accent, fontWeight: 500 }}>#{seqMap.get(appt.id) ?? '—'}</span>
                      <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>{appt.client?.full_name || '—'}</div>
                    </Table.Cell>
                    <Table.Cell style={{ color: C.text }}>{appt.service?.name || '—'}</Table.Cell>
                    <Table.Cell style={{ color: C.textTertiary }}>
                      {format(new Date(appt.created_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                    </Table.Cell>
                    <Table.Cell>
                      <div style={{ color: C.text }}>
                        {format(new Date(appt.starts_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                      </div>
                      <div style={{ fontSize: 11, color: C.textTertiary }}>{dur} {t('duration').toLowerCase()}</div>
                    </Table.Cell>
                    <Table.Cell align="right" style={{ fontWeight: 600, color: C.text }}>
                      {(appt.price || 0).toLocaleString()} {CURRENCY}
                    </Table.Cell>
                    <Table.Cell align="right">
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
                            color: appt.tip_amount ? '#34d399' : C.textTertiary,
                            fontWeight: appt.tip_amount ? 600 : 400, cursor: 'pointer',
                            padding: '2px 6px', borderRadius: 4,
                          }}
                          title="Нажмите для редактирования"
                        >
                          {appt.tip_amount ? `${appt.tip_amount}` : '—'}
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell align="right">
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500, background: st.bg, color: st.text,
                      }}>
                        {st.label}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
          <TablePagination
            C={C}
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
          <div style={{ textAlign: 'center', fontSize: 12, color: C.textTertiary, marginTop: 12 }}>
            {t('showing', { count: filtered.length, total: appointments.length })}
          </div>
        </motion.div>
      )}
    </>
  );
}
