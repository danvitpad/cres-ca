/** --- YAML
 * name: Clients Page
 * description: Fresha-exact client list — avatars, search, filters, data table with Fresha inline theming
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
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
import { BehaviorIndicators } from '@/components/shared/behavior-indicators';
import {
  AlertTriangle,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Users,
  Star,
  Heart,
  UserCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { FollowerCard } from '@/components/shared/follower-card';
import type { BehaviorIndicator } from '@/types';

const PAGE_SIZE = 20;
const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  bg: '#ffffff', text: '#0d0d0d', textMuted: '#737373', textLight: '#a3a3a3',
  searchBg: '#f5f5f5', searchBorder: '#e5e5e5',
  tableBg: '#ffffff', tableBorder: '#f0f0f0', tableHeaderText: '#737373',
  rowHover: '#fafafa', btnBorder: '#e5e5e5',
  avatarColors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'],
};

const DARK = {
  bg: '#000000', text: '#f0f0f0', textMuted: '#b3b3b3', textLight: '#666666',
  searchBg: '#111111', searchBorder: '#2a2a2a',
  tableBg: '#000000', tableBorder: '#1a1a1a', tableHeaderText: '#666666',
  rowHover: '#0d0d0d', btnBorder: '#333333',
  avatarColors: ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#818cf8', '#f472b6'],
};

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  total_visits: number;
  avg_check: number;
  last_visit_at: string | null;
  rating: number;
  has_health_alert: boolean;
  behavior_indicators: BehaviorIndicator[];
  tier: 'new' | 'regular' | 'vip';
}

type FilterType = 'all' | 'recent' | 'frequent' | 'inactive';
type TabType = 'clients' | 'followers' | 'mutual';

interface FollowerRow {
  profileId: string;
  linkedAt: string;
  mutual: boolean;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColorIdx(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 8;
}

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const tf = useTranslations('followSystem');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { master, loading: masterLoading } = useMaster();
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<TabType>('clients');
  const [followers, setFollowers] = useState<FollowerRow[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadClients = useCallback(async (append = false) => {
    if (!master) return;
    const supabase = createClient();
    let query = supabase
      .from('clients')
      .select('id, full_name, phone, email, total_visits, avg_check, last_visit_at, rating, has_health_alert, behavior_indicators, tier')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
    }

    const offset = append ? clients.length : 0;
    query = query.range(offset, offset + PAGE_SIZE);

    const { data } = await query;
    if (data) {
      setClients(append ? [...clients, ...data] : data);
      setHasMore(data.length > PAGE_SIZE);
    }
    setLoading(false);
  }, [master, search, clients]);

  const loadFollowers = useCallback(async (type: 'followers' | 'mutual') => {
    if (!master) return;
    setFollowersLoading(true);
    try {
      const res = await fetch(`/api/follow/crm/list?masterId=${master.id}&type=${type}`);
      const json = await res.json();
      setFollowers(json.list ?? []);
    } catch {
      setFollowers([]);
    }
    setFollowersLoading(false);
  }, [master]);

  useEffect(() => {
    if (master) { setLoading(true); loadClients(); }
  }, [master, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (master && (tab === 'followers' || tab === 'mutual')) {
      loadFollowers(tab);
    }
  }, [master, tab, loadFollowers]);

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

  // Apply client-side filter
  const filteredClients = clients.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'frequent') return c.total_visits >= 5;
    if (filter === 'inactive') {
      if (!c.last_visit_at) return true;
      const daysSince = (Date.now() - new Date(c.last_visit_at).getTime()) / 86400000;
      return daysSince > 30;
    }
    if (filter === 'recent') {
      if (!c.last_visit_at) return false;
      const daysSince = (Date.now() - new Date(c.last_visit_at).getTime()) / 86400000;
      return daysSince <= 7;
    }
    return true;
  });

  if (masterLoading) {
    return (
      <div style={{ padding: '32px 40px', fontFamily: FONT }}>
        <div style={{ height: 28, width: 200, backgroundColor: C.searchBg, borderRadius: 8, marginBottom: 16 }} />
        <div style={{ height: 200, width: '100%', backgroundColor: C.searchBg, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', fontFamily: FONT }}>
      <PageHeader
        title={t('clientList') || t('clientCard')}
        count={clients.length}
        description={t('clientsDescription') || undefined}
        onAdd={() => setDialogOpen(true)}
        addLabel={t('addClient')}
        onOptions={() => {}}
      />

      {/* Add Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('addClient')}</DialogTitle></DialogHeader>
          <AddClientForm onSubmit={addClient} />
        </DialogContent>
      </Dialog>

      {/* ── Tab Switcher ── */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        borderBottom: `1px solid ${C.tableBorder}`,
      }}>
        {([
          { key: 'clients' as TabType, label: tf('allClients'), icon: Users },
          { key: 'followers' as TabType, label: tf('followers'), icon: Heart },
          { key: 'mutual' as TabType, label: tf('mutualClients'), icon: UserCheck },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', fontSize: 14, fontWeight: 500,
              color: tab === key ? C.text : C.textMuted,
              backgroundColor: 'transparent', border: 'none',
              borderBottom: tab === key ? '2px solid #5e6ad2' : '2px solid transparent',
              cursor: 'pointer', fontFamily: FONT,
              transition: 'all 150ms',
            }}
          >
            <Icon style={{ width: 15, height: 15 }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Followers / Mutual Tab ── */}
      {(tab === 'followers' || tab === 'mutual') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {followersLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 72, backgroundColor: C.searchBg, borderRadius: 12 }} />
            ))
          ) : followers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '60px 0', textAlign: 'center',
              }}
            >
              <Heart style={{ width: 40, height: 40, color: C.textLight, marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT }}>
                {tf('noFollowers')}
              </p>
            </motion.div>
          ) : (
            followers.map((f, i) => (
              <motion.div
                key={f.profileId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <FollowerCard
                  profileId={f.profileId}
                  fullName={f.profile?.full_name ?? '—'}
                  avatarUrl={f.profile?.avatar_url ?? null}
                  phone={f.profile?.phone ?? null}
                  linkedAt={f.linkedAt}
                  mutual={f.mutual}
                  onFollowBack={async () => {
                    await fetch('/api/follow/crm/back', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ clientProfileId: f.profileId }),
                    });
                    loadFollowers(tab);
                  }}
                  onUnfollowBack={async () => {
                    await fetch(`/api/follow/crm/back?clientProfileId=${f.profileId}`, {
                      method: 'DELETE',
                    });
                    loadFollowers(tab);
                  }}
                />
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Search + Filters (Fresha style) — only on clients tab ── */}
      {tab === 'clients' && (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 420,
          padding: '10px 14px', borderRadius: 999,
          backgroundColor: C.searchBg, border: `1px solid ${C.searchBorder}`,
        }}>
          <Search style={{ width: 16, height: 16, color: C.textLight, flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder') || 'Имя, эл. почта или телефон'}
            style={{
              border: 'none', outline: 'none', backgroundColor: 'transparent',
              fontSize: 14, color: C.text, width: '100%', fontFamily: FONT,
            }}
          />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 999,
          border: `1px solid ${C.btnBorder}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          <SlidersHorizontal style={{ width: 14, height: 14 }} />
          {t('filters') || 'Фильтры'}
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 999,
          border: `1px solid ${C.btnBorder}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          {t('sortByDate') || 'Дата создания (от новых к старым)'}
          <ChevronDown style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* ── Client table (Fresha style) ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 56, backgroundColor: C.searchBg, borderRadius: 8 }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 0', textAlign: 'center',
          }}
        >
          <Users style={{ width: 48, height: 48, color: C.textLight, marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: FONT }}>{t('noClients')}</p>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 4, fontFamily: FONT }}>
            {t('noClientsDesc') || t('noClients')}
          </p>
        </motion.div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '10px 16px', borderBottom: `1px solid ${C.tableBorder}`,
            fontSize: 13, fontWeight: 500, color: C.tableHeaderText, fontFamily: FONT,
          }}>
            <span>{t('clientName') || t('name')}</span>
            <span>{t('mobileNumber') || t('phone')}</span>
            <span style={{ textAlign: 'center' }}>{t('reviews') || 'Отзывы'}</span>
            <span style={{ textAlign: 'right' }}>{t('sales') || 'Продажи'}</span>
            <span style={{ textAlign: 'right' }}>{t('createdDate') || t('lastVisit')}</span>
          </div>

          {/* Table rows */}
          {filteredClients.map((c, i) => {
            const lastVisitLabel = c.last_visit_at
              ? new Date(c.last_visit_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
              : '—';
            const avatarColor = C.avatarColors[getAvatarColorIdx(c.full_name)];
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link
                  href={`/clients/${c.id}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                    alignItems: 'center', padding: '12px 16px',
                    borderBottom: `1px solid ${C.tableBorder}`,
                    textDecoration: 'none', color: 'inherit',
                    transition: 'background-color 100ms', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.rowHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Name + avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: avatarColor, color: '#ffffff',
                      fontSize: 13, fontWeight: 600, fontFamily: FONT,
                    }}>
                      {getInitials(c.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.has_health_alert && <AlertTriangle style={{ width: 14, height: 14, color: '#d4163a', flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.text, fontFamily: FONT }}>
                          {c.full_name}
                        </span>
                        {c.tier === 'vip' && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, backgroundColor: '#fef3c7', color: '#92400e', letterSpacing: 0.3 }}>
                            ★ VIP
                          </span>
                        )}
                        {c.tier === 'regular' && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                            REG
                          </span>
                        )}
                      </div>
                      {c.email && (
                        <span style={{ fontSize: 13, color: C.textMuted, fontFamily: FONT }}>
                          {c.email}
                        </span>
                      )}
                      <BehaviorIndicators indicators={c.behavior_indicators} />
                    </div>
                  </div>
                  {/* Phone */}
                  <span style={{ fontSize: 14, color: C.textMuted, fontFamily: FONT }}>{c.phone || '—'}</span>
                  {/* Reviews */}
                  <span style={{ fontSize: 14, color: C.textMuted, textAlign: 'center', fontFamily: FONT }}>
                    {c.rating > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Star style={{ width: 13, height: 13, fill: '#fbbf24', color: '#fbbf24' }} />
                        {c.rating.toFixed(1)}
                      </span>
                    ) : '—'}
                  </span>
                  {/* Sales */}
                  <span style={{ fontSize: 14, color: C.textMuted, textAlign: 'right', fontFamily: FONT }}>
                    {c.avg_check > 0 ? `${(c.avg_check * c.total_visits).toLocaleString()} UAH` : '0 UAH'}
                  </span>
                  {/* Date */}
                  <span style={{ fontSize: 13, color: C.textMuted, textAlign: 'right', fontFamily: FONT }}>
                    {lastVisitLabel}
                  </span>
                </Link>
              </motion.div>
            );
          })}

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 4px', fontSize: 13, color: C.textMuted, fontFamily: FONT,
          }}>
            <span>{t('showingResults') || `Просмотр результатов 1–${filteredClients.length} из ${filteredClients.length}`}</span>
            {hasMore && (
              <button
                onClick={() => loadClients(true)}
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  border: `1px solid ${C.btnBorder}`, backgroundColor: 'transparent',
                  color: C.text, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                {tc('next')}
              </button>
            )}
          </div>
        </>
      )}
      </>
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
