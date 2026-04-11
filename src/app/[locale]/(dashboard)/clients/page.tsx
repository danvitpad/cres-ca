/** --- YAML
 * name: Clients Page
 * description: Fresha-style client list — avatars, search, filters, clean table, import banner
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BehaviorIndicators } from '@/components/shared/behavior-indicators';
import {
  Plus,
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  Users,
  Star,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubSidebar } from '@/components/shared/sub-sidebar';
import { PageHeader } from '@/components/shared/page-header';
import type { BehaviorIndicator } from '@/types';

const PAGE_SIZE = 20;

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
}

type FilterType = 'all' | 'recent' | 'frequent' | 'inactive';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ACCENT_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const { master, loading: masterLoading } = useMaster();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadClients = useCallback(async (append = false) => {
    if (!master) return;
    const supabase = createClient();
    let query = supabase
      .from('clients')
      .select('id, full_name, phone, email, total_visits, avg_check, last_visit_at, rating, has_health_alert, behavior_indicators')
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

  useEffect(() => {
    if (master) { setLoading(true); loadClients(); }
  }, [master, search]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const clientsSidebarGroups = [
    {
      items: [
        { label: 'Список клиентов', href: '/clients' },
        { label: 'Сегменты клиентов', href: '/clients/segments' },
        { label: 'Лояльность клиентов', href: '/clients/loyalty' },
      ],
    },
  ];

  if (masterLoading) {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <SubSidebar title="Клиенты" groups={clientsSidebarGroups} />
        <div className="flex-1 p-6 space-y-4">
          <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-28" /></div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SubSidebar title="Клиенты" groups={clientsSidebarGroups} />
      <div style={{ flex: 1, overflow: 'auto' }}>
      <PageHeader
        title={t('clientCard')}
        count={clients.length}
        onAdd={() => setDialogOpen(true)}
        addLabel={t('addClient')}
        onOptions={() => {}}
      />

      <div className="px-6 space-y-5">
      {/* Add Client Dialog (hidden trigger — opened via PageHeader onAdd) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('addClient')}</DialogTitle></DialogHeader>
          <AddClientForm onSubmit={addClient} />
        </DialogContent>
      </Dialog>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tc('search')}
            className="pl-9 rounded-xl border-border/60"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
          {(['all', 'recent', 'frequent', 'inactive'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                filter === f
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'all' ? tc('all') : f === 'recent' ? t('recent') : f === 'frequent' ? t('frequent') : t('inactive')}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <Users className="size-12 text-muted-foreground/30 mb-3" />
          <h4 className="font-medium">{t('noClients')}</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {t('noClientsDesc') || t('noClients')}
          </p>
        </motion.div>
      ) : (
        <>
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t('name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">{t('phone')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">{t('totalVisits')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">{t('lastVisit')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">{t('rating')}</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c, i) => {
                  const lastVisitLabel = c.last_visit_at
                    ? new Date(c.last_visit_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—';
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold',
                            getAvatarColor(c.full_name),
                          )}>
                            {getInitials(c.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {c.has_health_alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              <span className="font-medium truncate">{c.full_name}</span>
                            </div>
                            {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                            <BehaviorIndicators indicators={c.behavior_indicators} />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="font-medium">{c.total_visits}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground text-xs">
                        {lastVisitLabel}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {c.rating > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {c.rating.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredClients.length} {t('clientCard').toLowerCase()}</span>
            {hasMore && (
              <Button variant="outline" size="sm" onClick={() => loadClients(true)} className="h-7 text-xs rounded-lg">
                {tc('next')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
    </div>
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
