/** --- YAML
 * name: Clients Page
 * description: Client card grid — VK/FB-style cards with avatar, age, stats, and smart filters (VIP/Overdue/Risk/New/Birthday). Click → rich client detail.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle, Users, Star, Heart, UserCheck, Search,
  Cake, Clock, ShieldAlert, Sparkles, Plus, Upload,
} from 'lucide-react';
import { FollowerCard } from '@/components/shared/follower-card';
import type { BehaviorIndicator } from '@/types';
import {
  usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer,
  type PageTheme,
} from '@/lib/dashboard-theme';
import {
  differenceInDays, differenceInYears, startOfDay, setYear, getYear,
} from 'date-fns';

const PAGE_SIZE = 40;

const AVATAR_GRADIENTS_LIGHT = [
  'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  'linear-gradient(135deg, #ef4444 0%, #fb7185 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #c4b5fd 100%)',
];

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  notes: string | null;
  total_visits: number;
  avg_check: number;
  last_visit_at: string | null;
  created_at: string;
  rating: number;
  has_health_alert: boolean;
  behavior_indicators: BehaviorIndicator[];
  tier: 'new' | 'regular' | 'vip';
  is_blacklisted: boolean;
  cancellation_count: number;
  no_show_count: number;
}

type FilterKey = 'all' | 'vip' | 'overdue' | 'risk' | 'new' | 'birthday';
type TabType = 'clients' | 'users' | 'subscribers';

interface FollowerRow {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  entityType: 'client' | 'master' | 'salon';
  entityMeta: { specialization?: string; salonName?: string; city?: string } | null;
  followedAt: string | null;
  mutual: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function getAvatarIdx(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % AVATAR_GRADIENTS_LIGHT.length;
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  return differenceInYears(new Date(), new Date(dob));
}

function daysUntilBirthday(dob: string | null): number | null {
  if (!dob) return null;
  const now = new Date();
  const birth = new Date(dob);
  let next = setYear(birth, getYear(now));
  if (next < startOfDay(now)) next = setYear(birth, getYear(now) + 1);
  return differenceInDays(startOfDay(next), startOfDay(now));
}

function daysSinceLastVisit(lastVisit: string | null): number | null {
  if (!lastVisit) return null;
  return Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
}

/* ─── Client Card ─── */
function ClientCard({ client, C, isDark, index }: {
  client: ClientRow;
  C: PageTheme;
  isDark: boolean;
  index: number;
}) {
  const age = computeAge(client.date_of_birth);
  const daysSince = daysSinceLastVisit(client.last_visit_at);
  const daysToBday = daysUntilBirthday(client.date_of_birth);
  const avatarBg = AVATAR_GRADIENTS_LIGHT[getAvatarIdx(client.full_name)];
  const totalSpent = client.avg_check * client.total_visits;

  // Determine primary badge (priority order)
  let badge: { label: string; color: string; bg: string; icon: typeof Star } | null = null;
  if (client.is_blacklisted) {
    badge = { label: 'Блок', color: '#fff', bg: C.danger, icon: ShieldAlert };
  } else if ((client.cancellation_count || 0) + (client.no_show_count || 0) >= 3) {
    badge = { label: 'Риск', color: '#fff', bg: C.warning, icon: AlertTriangle };
  } else if (daysToBday !== null && daysToBday <= 7) {
    badge = { label: daysToBday === 0 ? 'ДР сегодня!' : `ДР ${daysToBday}д`, color: '#fff', bg: C.warning, icon: Cake };
  } else if (client.tier === 'vip') {
    badge = { label: 'VIP', color: '#fff', bg: C.accent, icon: Star };
  } else if (daysSince !== null && daysSince > 60) {
    badge = { label: 'Просрочка', color: '#fff', bg: C.danger, icon: Clock };
  } else if (client.total_visits === 0) {
    badge = { label: 'Новый', color: C.accent, bg: C.accentSoft, icon: Sparkles };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.25 }}
    >
      <Link
        href={`/clients/${client.id}`}
        style={{
          display: 'block',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 18,
          textDecoration: 'none',
          color: 'inherit',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.borderStrong;
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 8px 24px rgba(0,0,0,0.3)'
            : '0 8px 24px rgba(124,58,237,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.border as string;
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Top row: avatar + badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: avatarBg, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 600, flexShrink: 0,
          }}>
            {getInitials(client.full_name)}
          </div>
          {badge && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 7,
              background: badge.bg, color: badge.color,
              fontSize: 10, fontWeight: 650, letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}>
              <badge.icon size={10} />
              {badge.label}
            </div>
          )}
        </div>

        {/* Name + age */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {client.full_name}
            {client.has_health_alert && <AlertTriangle size={13} style={{ color: C.danger, flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
            {age !== null ? `${age} лет` : 'возраст не указан'}
            {client.phone && <span style={{ margin: '0 6px' }}>·</span>}
            {client.phone}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8, paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 10, color: C.textTertiary, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
              Визитов
            </div>
            <div style={{ fontSize: 16, fontWeight: 650, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
              {client.total_visits}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: C.textTertiary, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
              Потрачено
            </div>
            <div style={{ fontSize: 16, fontWeight: 650, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
              {totalSpent > 0 ? `${totalSpent.toLocaleString()} ${CURRENCY}` : '—'}
            </div>
          </div>
        </div>

        {/* Last visit / rating / notes indicators */}
        {(daysSince !== null || client.rating > 0 || client.notes) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginTop: 10, paddingTop: 10,
            borderTop: `1px solid ${C.border}`,
            fontSize: 11, color: C.textSecondary,
          }}>
            {daysSince !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} style={{ opacity: 0.6 }} />
                {daysSince === 0 ? 'сегодня' : `${daysSince}д назад`}
              </span>
            )}
            {client.rating > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Star size={11} style={{ fill: C.warning, color: C.warning }} />
                {client.rating.toFixed(1)}
              </span>
            )}
            {client.notes && (
              <span style={{ color: C.textTertiary, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                «{client.notes.slice(0, 40)}{client.notes.length > 40 ? '…' : ''}»
              </span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const tf = useTranslations('followSystem');
  const { C, isDark, mounted } = usePageTheme();
  const { master, loading: masterLoading } = useMaster();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<TabType>('clients');
  const [followList, setFollowList] = useState<FollowerRow[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [clientProfileIds, setClientProfileIds] = useState<Set<string>>(new Set());

  const loadClients = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    let query = supabase
      .from('clients')
      .select('id, full_name, phone, email, date_of_birth, notes, total_visits, avg_check, last_visit_at, created_at, rating, has_health_alert, behavior_indicators, tier, is_blacklisted, cancellation_count, no_show_count')
      .eq('master_id', master.id)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE * 3);

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }

    const { data } = await query;
    if (data) setClients(data as ClientRow[]);
    setLoading(false);
  }, [master, search]);

  const loadFollowList = useCallback(async (listType: 'followers' | 'mutual') => {
    if (!master) return;
    setFollowListLoading(true);
    try {
      const res = await fetch(`/api/follow/list?profileId=${master.profile_id}&type=${listType}`);
      const json = await res.json();
      const list = json.list ?? [];
      setFollowList(list);

      if (list.length > 0) {
        const supabase = createClient();
        const profileIds = list.map((f: FollowerRow) => f.profileId);
        const { data: existingClients } = await supabase
          .from('clients')
          .select('profile_id')
          .eq('master_id', master.id)
          .in('profile_id', profileIds);
        setClientProfileIds(new Set((existingClients ?? []).map(c => c.profile_id).filter(Boolean)));
      }
    } catch {
      setFollowList([]);
    }
    setFollowListLoading(false);
  }, [master]);

  useEffect(() => {
    if (master) { setLoading(true); loadClients(); }
  }, [master, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`clients_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `master_id=eq.${master.id}` }, () => loadClients())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [master?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!master) return;
    if (tab === 'users') loadFollowList('followers');
    else if (tab === 'subscribers') loadFollowList('mutual');
  }, [master, tab, loadFollowList]);

  async function addClient(formData: { full_name: string; phone: string; email: string; date_of_birth: string; notes: string }) {
    if (!master) return;
    const supabase = createClient();
    const { error } = await supabase.from('clients').insert({
      master_id: master.id,
      full_name: formData.full_name,
      phone: formData.phone || null,
      email: formData.email || null,
      date_of_birth: formData.date_of_birth || null,
      notes: formData.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(tc('success'));
    setDialogOpen(false);
    loadClients();
  }

  /* ─── Counts for filter chips ─── */
  const counts = useMemo(() => {
    const now = Date.now();
    let vip = 0, overdue = 0, risk = 0, newC = 0, birthday = 0;
    for (const c of clients) {
      if (c.tier === 'vip') vip++;
      if (c.last_visit_at) {
        const days = (now - new Date(c.last_visit_at).getTime()) / 86400000;
        if (days > 60) overdue++;
      }
      if (c.is_blacklisted || (c.cancellation_count || 0) + (c.no_show_count || 0) >= 3) risk++;
      if (c.total_visits === 0) newC++;
      if (c.date_of_birth) {
        const days = daysUntilBirthday(c.date_of_birth);
        if (days !== null && days <= 14) birthday++;
      }
    }
    return { all: clients.length, vip, overdue, risk, new: newC, birthday };
  }, [clients]);

  /* ─── Apply filter ─── */
  const filteredClients = useMemo(() => {
    const now = Date.now();
    return clients.filter(c => {
      if (filter === 'all') return true;
      if (filter === 'vip') return c.tier === 'vip';
      if (filter === 'overdue') {
        if (!c.last_visit_at) return false;
        return (now - new Date(c.last_visit_at).getTime()) / 86400000 > 60;
      }
      if (filter === 'risk') return c.is_blacklisted || (c.cancellation_count || 0) + (c.no_show_count || 0) >= 3;
      if (filter === 'new') return c.total_visits === 0;
      if (filter === 'birthday') {
        if (!c.date_of_birth) return false;
        const d = daysUntilBirthday(c.date_of_birth);
        return d !== null && d <= 14;
      }
      return true;
    });
  }, [clients, filter]);

  const FILTERS: { key: FilterKey; label: string; icon?: typeof Star; count: number; color?: string }[] = [
    { key: 'all', label: 'Все', count: counts.all },
    { key: 'vip', label: 'VIP', icon: Star, count: counts.vip, color: C.accent },
    { key: 'overdue', label: 'Просрочки', icon: Clock, count: counts.overdue, color: C.danger },
    { key: 'risk', label: 'Риск', icon: AlertTriangle, count: counts.risk, color: C.warning },
    { key: 'new', label: 'Новые', icon: Sparkles, count: counts.new, color: C.success },
    { key: 'birthday', label: 'ДР скоро', icon: Cake, count: counts.birthday, color: C.warning },
  ];

  if (masterLoading || !mounted) {
    return (
      <div style={{ ...pageContainer, background: C.bg }}>
        <div style={{ height: 40, background: C.surfaceElevated, borderRadius: 10, marginBottom: 20, width: 300 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ height: 200, background: C.surfaceElevated, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...pageContainer,
      color: C.text, background: C.bg, minHeight: '100%',
    }}>
      {/* ═══ Header ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>
            Клиенты
          </h1>
          <p style={{ fontSize: 14, color: C.textTertiary, margin: '4px 0 0' }}>
            Всего {counts.all} · активных {counts.all - counts.overdue}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/clients/import"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.text, textDecoration: 'none',
              fontSize: 13, fontWeight: 550,
              transition: 'border-color 0.15s',
            }}
          >
            <Upload size={14} />
            Импорт
          </Link>
          <button
            onClick={() => setDialogOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 10,
              background: C.accent, border: 'none',
              color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>
      </div>

      {/* Add Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('addClient')}</DialogTitle></DialogHeader>
          <AddClientForm onSubmit={addClient} />
        </DialogContent>
      </Dialog>

      {/* ═══ Top tabs (Clients / Users / Subscribers) ═══ */}
      <div style={{
        display: 'inline-flex', gap: 2,
        background: C.surfaceElevated,
        borderRadius: 10, padding: 3, marginBottom: 18,
      }}>
        {([
          { key: 'clients' as TabType, label: tf('clients'), icon: Users, count: counts.all },
          { key: 'users' as TabType, label: tf('users'), icon: Heart },
          { key: 'subscribers' as TabType, label: tf('subscribers'), icon: UserCheck },
        ]).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 7, border: 'none',
              background: tab === key ? C.surface : 'transparent',
              color: tab === key ? C.text : C.textTertiary,
              fontSize: 13, fontWeight: 550,
              cursor: 'pointer',
              fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
              transition: 'all 0.15s',
              boxShadow: tab === key
                ? (isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)')
                : 'none',
            }}
          >
            <Icon size={13} />
            {label}
            {count !== undefined && count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: tab === key ? C.accentSoft : 'transparent',
                color: tab === key ? C.accent : C.textTertiary,
                padding: '0 6px', borderRadius: 5,
              }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ CLIENTS TAB ═══ */}
      {tab === 'clients' && (
        <>
          {/* Search */}
          <div style={{
            position: 'relative', marginBottom: 16,
          }}>
            <Search size={15} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: C.textTertiary, pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону, email..."
              style={{
                width: '100%',
                padding: '11px 14px 11px 38px',
                background: C.surface, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: 10,
                fontSize: 14, fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border as string; }}
            />
          </div>

          {/* Filter chips */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22,
          }}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 13px', borderRadius: 999,
                    background: active ? C.accent : C.surface,
                    color: active ? '#fff' : C.text,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    cursor: 'pointer',
                    fontSize: 13, fontWeight: 550,
                    fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                    transition: 'all 0.15s',
                  }}
                >
                  {Icon && <Icon size={12} style={{ color: active ? '#fff' : f.color || C.textSecondary }} />}
                  {f.label}
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: active ? 'rgba(255,255,255,0.22)' : C.surfaceElevated,
                    color: active ? '#fff' : C.textTertiary,
                    padding: '0 6px', borderRadius: 5,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Card grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 200, background: C.surfaceElevated, borderRadius: 16 }} />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: '72px 24px', textAlign: 'center',
            }}>
              <Users size={40} style={{ color: C.textTertiary, opacity: 0.4, margin: '0 auto 14px' }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
                {filter === 'all' ? 'Пока нет клиентов' : 'Ничего не нашлось'}
              </p>
              <p style={{ fontSize: 13, color: C.textSecondary, margin: '6px 0 0' }}>
                {filter === 'all' ? 'Добавьте первого клиента или импортируйте из другой системы' : 'Попробуйте другой фильтр'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 14,
            }}>
              {filteredClients.map((c, i) => (
                <ClientCard key={c.id} client={c} C={C} isDark={isDark} index={i} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ USERS / SUBSCRIBERS TAB ═══ */}
      {(tab === 'users' || tab === 'subscribers') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {followListLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 72, background: C.surfaceElevated, borderRadius: 12 }} />
            ))
          ) : followList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
                padding: '60px 24px', textAlign: 'center',
              }}
            >
              <Heart size={40} style={{ color: C.textTertiary, opacity: 0.4, margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>
                {tab === 'users' ? tf('noUsers') : tf('noFollowers')}
              </p>
            </motion.div>
          ) : (
            followList.map((f, i) => (
              <motion.div
                key={f.profileId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <FollowerCard
                  profileId={f.profileId}
                  fullName={f.fullName ?? '—'}
                  avatarUrl={f.avatarUrl}
                  phone={f.phone}
                  entityType={f.entityType}
                  entityMeta={f.entityMeta}
                  followedAt={f.followedAt}
                  mutual={f.mutual}
                  isClient={clientProfileIds.has(f.profileId)}
                  onFollow={async () => {
                    await fetch('/api/follow', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetId: f.profileId }),
                    });
                    loadFollowList(tab === 'users' ? 'followers' : 'mutual');
                  }}
                  onUnfollow={async () => {
                    await fetch('/api/follow', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetId: f.profileId }),
                    });
                    loadFollowList(tab === 'users' ? 'followers' : 'mutual');
                  }}
                  onAddToClients={async () => {
                    if (!master) return;
                    const supabase = createClient();
                    const { error } = await supabase.from('clients').insert({
                      master_id: master.id,
                      profile_id: f.profileId,
                      full_name: f.fullName ?? '—',
                      phone: f.phone || null,
                    });
                    if (error) { toast.error(error.message); return; }
                    toast.success(tc('success'));
                    setClientProfileIds(prev => new Set([...prev, f.profileId]));
                    loadClients();
                  }}
                />
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AddClientForm({ onSubmit }: { onSubmit: (data: { full_name: string; phone: string; email: string; date_of_birth: string; notes: string }) => void }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ full_name: fullName, phone, email, date_of_birth: dob, notes });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('name')}</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{t('phone')}</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('email')}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('dateOfBirth')}</Label>
        <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t('notes')}</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full">{tc('save')}</Button>
    </form>
  );
}
