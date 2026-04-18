/** --- YAML
 * name: Salon Clients
 * description: Salon-wide clients list for admin + receptionist (and filtered own-clients for master).
 *              Unified: full finance for admin, mapped to masters. Marketplace admin: aggregate only.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Search, Building2, Cake } from 'lucide-react';
import Link from 'next/link';

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  master_id?: string;
  master_name?: string | null;
  visits?: number;
  spent?: number;
  created_at: string;
}

interface SalonClientsData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  role: 'admin' | 'master' | 'receptionist';
  masters: Array<{ id: string; display_name: string | null }>;
  clients: ClientRow[];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

export default function SalonClientsPage() {
  const params = useParams();
  const salonId = params.id as string;
  const locale = params.locale as string;

  const [data, setData] = useState<SalonClientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [masterFilter, setMasterFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/salon/${salonId}/clients`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((j: SalonClientsData) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.clients.filter((c) => {
      if (masterFilter !== 'all' && c.master_id !== masterFilter) return false;
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, masterFilter]);

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <Users className="size-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Нет доступа к клиентам салона</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Доступ имеют владелец, администратор, ресепшн и мастера (свои клиенты).
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-muted-foreground">Не удалось загрузить</div>;
  }

  const isUnified = data.salon.team_mode === 'unified';
  const showFinance = data.role === 'admin';
  const showMasterFilter = data.role !== 'master' && (isUnified || data.role === 'receptionist');
  const showMasterColumn = isUnified || data.role === 'master';

  return (
    <div className="p-4 md:p-6 space-y-5 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white">
          <Building2 className="size-5" />
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground tracking-wider">
            {isUnified ? 'Единый бизнес' : 'Коворкинг'} · клиенты
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{data.salon.name}</h1>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm"
          />
        </div>
        {showMasterFilter && data.masters.length > 0 && (
          <select
            value={masterFilter}
            onChange={(e) => setMasterFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
          >
            <option value="all">Все мастера</option>
            {data.masters.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name || 'Мастер'}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Users className="size-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-base font-semibold">Пока нет клиентов</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Клиенты появляются сюда при первой записи или через импорт.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const bday = c.date_of_birth
              ? new Date(c.date_of_birth).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
              : null;
            return (
              <Link
                key={c.id}
                href={`/${locale}/clients/${c.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                    {c.full_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                      {c.phone && <span>{c.phone}</span>}
                      {bday && (
                        <span className="inline-flex items-center gap-0.5">
                          <Cake className="size-3" /> {bday}
                        </span>
                      )}
                      {showMasterColumn && c.master_name && (
                        <span className="truncate">· {c.master_name}</span>
                      )}
                    </div>
                  </div>
                  {showFinance && (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">
                        {c.visits ?? 0} визит{(c.visits ?? 0) === 1 ? '' : 'ов'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(c.spent ?? 0)}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
