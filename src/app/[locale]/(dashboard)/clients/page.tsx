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
import { formatPhone } from '@/lib/phone';
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
  AlertTriangle, Users, Star, Heart, Search,
  Cake, Clock, Sparkles,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { DateWheelPicker, fromISODay, toISODay } from '@/components/ui/date-wheel-picker';
import type { BehaviorIndicator } from '@/types';
import {
  usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer,
  type PageTheme,
} from '@/lib/dashboard-theme';
import {
  differenceInDays, differenceInYears, startOfDay, setYear, getYear,
} from 'date-fns';
import { humanizeError } from '@/lib/format/error';

const PAGE_SIZE = 40;

const AVATAR_GRADIENTS_LIGHT = [
  'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-text) 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  'linear-gradient(135deg, #ef4444 0%, #fb7185 100%)',
  'linear-gradient(135deg, #2dd4bf 0%, var(--color-accent-text) 100%)',
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
  has_health_alert: boolean;
  behavior_indicators: BehaviorIndicator[];
  tier: 'new' | 'regular' | 'vip';
  manual_tier: 'new' | 'regular' | 'vip' | null;
  cancellation_count: number;
  no_show_count: number;
  // Аватар берём из профиля линкованного клиента (single source of truth).
  avatar_url: string | null;
}

type FilterKey = 'all' | 'vip' | 'overdue' | 'risk' | 'new' | 'birthday';
type TabType = 'clients' | 'audience' | 'users';

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

  // Determine primary badge (priority order). Manual tier overrides auto.
  const effectiveTier = client.manual_tier ?? client.tier;
  let badge: { label: string; color: string; bg: string; icon: typeof Star } | null = null;
  if ((client.cancellation_count || 0) + (client.no_show_count || 0) >= 3) {
    badge = { label: 'Риск', color: '#fff', bg: C.warning, icon: AlertTriangle };
  } else if (daysToBday !== null && daysToBday <= 7) {
    badge = { label: daysToBday === 0 ? 'ДР сегодня!' : `ДР ${daysToBday}д`, color: '#fff', bg: C.warning, icon: Cake };
  } else if (effectiveTier === 'vip') {
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
            : '0 8px 24px rgba(13,148,136,0.08)';
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
            overflow: 'hidden',
          }}>
            {client.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getInitials(client.full_name)
            )}
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
            {client.has_health_alert && (
              <span
                title="Есть аллергии или противопоказания — открой карточку, чтобы увидеть детали"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <AlertTriangle size={13} style={{ color: C.danger, flexShrink: 0 }} />
              </span>
            )}
          </div>
          {/* Возраст и телефон без технического «·» — раздельно, читаемо. */}
          <div style={{
            fontSize: 12, color: C.textTertiary, marginTop: 2,
            display: 'flex', flexWrap: 'wrap', columnGap: 10, rowGap: 2,
          }}>
            <span>{age !== null ? `${age} лет` : 'возраст не указан'}</span>
            {client.phone && <span>{formatPhone(client.phone)}</span>}
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

        {/* Last visit / notes indicators */}
        {(daysSince !== null || client.notes) && (
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
      .select('id, full_name, phone, email, date_of_birth, notes, total_visits, avg_check, last_visit_at, created_at, has_health_alert, behavior_indicators, tier, manual_tier, cancellation_count, no_show_count, profile:profiles!clients_profile_id_fkey(avatar_url)')
      .eq('master_id', master.id)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE * 3);

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }

    const { data } = await query;
    if (data) {
      // Plumb embedded profile.avatar_url onto the flat row.
      const flat = (data as unknown as Array<Record<string, unknown> & { profile?: { avatar_url: string | null } | { avatar_url: string | null }[] | null }>).map((r) => {
        const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return { ...r, avatar_url: prof?.avatar_url ?? null } as unknown as ClientRow;
      });
      setClients(flat);
    }
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
    if (tab === 'audience') loadFollowList('followers');
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
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success(tc('success'));
    setDialogOpen(false);
    loadClients();
  }

  /* ─── Counts for filter chips ─── */
  const counts = useMemo(() => {
    const now = Date.now();
    let vip = 0, overdue = 0, risk = 0, newC = 0, birthday = 0;
    for (const c of clients) {
      if ((c.manual_tier ?? c.tier) === 'vip') vip++;
      if (c.last_visit_at) {
        const days = (now - new Date(c.last_visit_at).getTime()) / 86400000;
        if (days > 60) overdue++;
      }
      if ((c.cancellation_count || 0) + (c.no_show_count || 0) >= 3) risk++;
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
      if (filter === 'vip') return (c.manual_tier ?? c.tier) === 'vip';
      if (filter === 'overdue') {
        if (!c.last_visit_at) return false;
        return (now - new Date(c.last_visit_at).getTime()) / 86400000 > 60;
      }
      if (filter === 'risk') return (c.cancellation_count || 0) + (c.no_show_count || 0) >= 3;
      if (filter === 'new') return c.total_visits === 0;
      if (filter === 'birthday') {
        if (!c.date_of_birth) return false;
        const d = daysUntilBirthday(c.date_of_birth);
        return d !== null && d <= 14;
      }
      return true;
    });
  }, [clients, filter]);

  /* Filter chip array removed — chips deleted from UI per product decision.
     Filter state still exists with default 'all'; filter logic kept for potential future segments. */

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
      color: C.text, background: C.bg, minHeight: '100%', paddingBottom: 96,
    }}>
      {/* ═══ Header ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>
            Контакты
          </h1>
          <p style={{ fontSize: 14, color: C.textTertiary, margin: '4px 0 0' }}>
            Всего {counts.all} · активных {counts.all - counts.overdue}
          </p>
        </div>
        {/* Import + manual "Добавить" removed — clients now come via Instagram-style follow/add
            from /clients subtab "Подписчики" or when a user books online. */}
      </div>

      {/* Add Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('addClient')}</DialogTitle></DialogHeader>
          <AddClientForm onSubmit={addClient} />
        </DialogContent>
      </Dialog>

      {/* ═══ Top tabs (Clients / Partners) — Аудитория removed per product decision ═══ */}
      <div style={{
        display: 'inline-flex', gap: 2,
        background: C.surfaceElevated,
        borderRadius: 10, padding: 3, marginBottom: 18,
      }}>
        {([
          { key: 'clients' as TabType, label: 'Клиенты', icon: Users },
          { key: 'users' as TabType, label: 'Партнёры', icon: Heart },
        ]).map(({ key, label, icon: Icon }) => (
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

          {/* Filter chips removed per product decision */}

          {/* Card grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 200, background: C.surfaceElevated, borderRadius: 16 }} />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title={filter === 'all' ? 'Пока нет клиентов' : 'Ничего не нашлось'}
              description={filter === 'all' ? 'Добавьте первого клиента или импортируйте из другой системы' : 'Попробуйте другой фильтр'}
            />
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

      {/* Audience/followers tab removed per product decision.
          The FollowerCard + followList logic is preserved in-file for potential reuse. */}

      {/* ═══ PARTNERS TAB — master↔master recommendation agreements ═══ */}
      {tab === 'users' && <PartnersSection C={C} />}
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
        <div className="rounded-lg border">
          <DateWheelPicker
            size="sm"
            locale="ru-RU"
            value={fromISODay(dob)}
            onChange={(d) => setDob(toISODay(d))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('notes')}</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full">{tc('save')}</Button>
    </form>
  );
}

/* ─── Partners (master↔master recommendation) ─── */

interface PartnerItem {
  id: string; // partnership row id
  status: 'active' | 'pending' | 'declined' | 'ended';
  note: string | null;
  initiated_at: string;
  accepted_at: string | null;
  youInitiated: boolean;
  partner: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    slug: string | null;
    specialization: string | null;
  };
}

interface SearchResult {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  specialization: string | null;
  city: string | null;
}

function PartnersSection({ C }: { C: PageTheme }) {
  const [active, setActive] = useState<PartnerItem[]>([]);
  const [incoming, setIncoming] = useState<PartnerItem[]>([]);
  const [outgoing, setOutgoing] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/partners/list');
    if (res.ok) {
      const data = await res.json();
      setActive(data.active || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const h = setTimeout(async () => {
      const res = await fetch(`/api/partners/search?q=${encodeURIComponent(q)}`);
      if (res.ok) { const d = await res.json(); setResults(d.results || []); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(h);
  }, [q]);

  async function invite(partnerId: string) {
    const res = await fetch('/api/partners/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: partnerId }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success('Приглашение отправлено');
      setQ(''); setResults([]);
      load();
    } else {
      toast.error(data.error || 'Не удалось отправить');
    }
  }

  async function respond(id: string, action: 'accept' | 'decline' | 'end' | 'withdraw') {
    const res = await fetch('/api/partners/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      toast.success(
        action === 'accept' ? 'Партнёрство активно' :
        action === 'decline' ? 'Отклонено' :
        action === 'withdraw' ? 'Запрос отозван' : 'Партнёрство завершено',
      );
      load();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Ошибка');
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textSecondary }}>Загрузка...</div>;
  }

  const cardBase: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: 16,
  };
  const avatarCss = (name: string): React.CSSProperties => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const grads = [
      'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-text) 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    ];
    return {
      width: 44, height: 44, borderRadius: 999,
      background: grads[Math.abs(hash) % grads.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 600, fontSize: 14, flexShrink: 0,
    };
  };
  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Find new partner */}
      <div style={cardBase}>
        <h3 style={{ fontSize: 14, fontWeight: 650, color: C.text, margin: 0, marginBottom: 10 }}>
          Найти партнёра
        </h3>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 12px' }}>
          Договоритесь с другим мастером взаимно рекомендовать друг друга — расширьте аудиторию.
        </p>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Имя или @handle мастера"
          style={{
            width: '100%', padding: '10px 14px',
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
            color: C.text, fontSize: 14, outline: 'none', fontFamily: FONT,
          }}
        />
        {searching && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 8 }}>Поиск...</div>}
        {results.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
              }}>
                <div style={avatarCss(r.full_name || '?')}>{initials(r.full_name || '?')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 550, color: C.text }}>{r.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: C.textTertiary }}>
                    {[r.specialization, r.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button
                  onClick={() => invite(r.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Пригласить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 650, color: C.textSecondary, margin: 0, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Входящие приглашения ({incoming.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incoming.map(p => (
              <div key={p.id} style={{
                ...cardBase,
                display: 'flex', alignItems: 'center', gap: 12,
                borderColor: C.accent, background: C.accentSoft,
              }}>
                <div style={avatarCss(p.partner.full_name || '?')}>{initials(p.partner.full_name || '?')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 550 }}>{p.partner.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>
                    {p.partner.specialization || 'Хочет стать партнёром'}
                  </div>
                  {p.note && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 3, fontStyle: 'italic' }}>«{p.note}»</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => respond(p.id, 'accept')}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: C.success, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => respond(p.id, 'decline')}
                    style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active partners */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 650, color: C.textSecondary, margin: 0, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Мои партнёры ({active.length})
        </h3>
        {active.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-6 h-6" />}
            title="Пока нет партнёров"
            description="Найдите коллег-мастеров выше и отправьте приглашение."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {active.map(p => (
              <div key={p.id} style={cardBase}>
                <Link
                  href={`/partners/${p.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={avatarCss(p.partner.full_name || '?')}>{initials(p.partner.full_name || '?')}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.partner.full_name || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textTertiary }}>
                      {p.partner.specialization || 'Мастер'}
                    </div>
                  </div>
                </Link>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <Link
                    href={`/partners/${p.id}`}
                    style={{
                      flex: 1, textAlign: 'center',
                      padding: '6px 10px', borderRadius: 8,
                      background: C.accentSoft, color: C.accent,
                      fontSize: 12, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    Открыть
                  </Link>
                  <button
                    onClick={() => respond(p.id, 'end')}
                    style={{
                      padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.textTertiary,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Завершить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing (pending) */}
      {outgoing.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 650, color: C.textSecondary, margin: 0, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ожидают ответа ({outgoing.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outgoing.map(p => (
              <div key={p.id} style={{
                ...cardBase,
                display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7,
              }}>
                <div style={avatarCss(p.partner.full_name || '?')}>{initials(p.partner.full_name || '?')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 550 }}>{p.partner.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: C.textTertiary }}>Ожидает ответа</div>
                </div>
                <button
                  onClick={() => respond(p.id, 'withdraw')}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                >
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
