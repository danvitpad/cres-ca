/** --- YAML
 * name: Salon Clients
 * description: Unified search for salon admin/receptionist:
 *              - filter existing salon clients (multi-word AND)
 *              - live system-wide search via /api/contacts/search
 *              - "+ Добавить" button on each system result
 *              - manual fallback for off-system contacts
 * created: 2026-04-19
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Search, Building2, Cake, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  master_id?: string | null;
  master_name?: string | null;
  visits?: number;
  spent?: number;
  source?: 'master' | 'salon_follow';
  created_at: string;
}

interface SalonClientsData {
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
  role: 'admin' | 'master' | 'receptionist';
  masters: Array<{ id: string; display_name: string | null }>;
  clients: ClientRow[];
}

interface SystemCard {
  id: string;
  type: 'client' | 'master' | 'salon';
  fullName: string;
  subtitle: string | null;
  avatarUrl: string | null;
  isLinked: boolean;
  payload: { profileId?: string };
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
  const [reloadKey, setReloadKey] = useState(0);

  // System search state
  const [systemResults, setSystemResults] = useState<SystemCard[]>([]);
  const [systemSearching, setSystemSearching] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [salonId, reloadKey]);

  const filtered = useMemo(() => {
    if (!data?.clients) return [];
    const q = search.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return data.clients.filter((c) => {
      if (masterFilter !== 'all' && c.master_id !== masterFilter) return false;
      if (tokens.length === 0) return true;
      const hay = `${c.full_name.toLowerCase()} ${(c.phone ?? '').toLowerCase()} ${(c.email ?? '').toLowerCase()}`;
      return tokens.every((t) => hay.includes(t));
    });
  }, [data, search, masterFilter]);

  const canAdd = data?.role === 'admin' || data?.role === 'receptionist';

  // Live system search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!canAdd || search.trim().length < 2) {
      setSystemResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSystemSearching(true);
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(search.trim())}&limit=20`);
        if (res.ok) {
          const j = (await res.json()) as { results: SystemCard[] };
          setSystemResults(j.results ?? []);
        }
      } finally {
        setSystemSearching(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, canAdd]);

  const existingNames = useMemo(() => new Set((data?.clients ?? []).map((c) => c.full_name.toLowerCase())), [data]);
  const systemFiltered = useMemo(() => systemResults.filter((c) => !existingNames.has(c.fullName.toLowerCase())), [systemResults, existingNames]);

  async function addContact(card: SystemCard) {
    if (!card.payload.profileId || adding.has(card.id) || card.isLinked) return;
    setAdding((s) => new Set(s).add(card.id));
    try {
      const res = await fetch(`/api/salon/${salonId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: card.payload.profileId }),
      });
      if (res.ok) {
        setSystemResults((rs) => rs.map((r) => r.id === card.id ? { ...r, isLinked: true } : r));
        toast.success(`${card.fullName} добавлен в контакты`);
        setReloadKey((k) => k + 1);
      } else {
        toast.error('Не удалось добавить');
      }
    } finally {
      setAdding((s) => { const n = new Set(s); n.delete(card.id); return n; });
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) return;
    setManualBusy(true);
    try {
      const res = await fetch(`/api/salon/${salonId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: manualName.trim(),
          phone: manualPhone.trim() || null,
          email: manualEmail.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success('Контакт добавлен');
        setManualName(''); setManualPhone(''); setManualEmail('');
        setShowManual(false);
        setSearch('');
        setReloadKey((k) => k + 1);
      } else {
        toast.error('Не удалось добавить');
      }
    } finally {
      setManualBusy(false);
    }
  }

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
        <div className="size-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-300">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={canAdd ? 'Имя, телефон, email или cres-id' : 'Поиск по имени, телефону, email'}
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-background text-sm"
          />
          {systemSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {showMasterFilter && (data.masters?.length ?? 0) > 0 && (
          <select
            value={masterFilter}
            onChange={(e) => setMasterFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
          >
            <option value="all">Все мастера</option>
            {(data.masters ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.display_name || 'Мастер'}</option>
            ))}
          </select>
        )}
      </div>

      {/* Existing clients */}
      {filtered.length > 0 && (
        <>
          {search.trim().length >= 2 && (
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mt-1 mb-2">
              Клиенты команды
            </p>
          )}
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
        </>
      )}

      {filtered.length === 0 && search.trim().length < 2 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Users className="size-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-base font-semibold">Пока нет клиентов команды</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Начни искать — найдём людей в CRES-CA, или запиши вручную.
          </p>
        </div>
      )}

      {/* System search results */}
      {canAdd && search.trim().length >= 2 && systemFiltered.length > 0 && (
        <div className="pt-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">В CRES-CA</p>
          <div className="space-y-2">
            {systemFiltered.map((c) => {
              const isAdding = adding.has(c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center font-bold overflow-hidden shrink-0">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt={c.fullName} className="size-full object-cover" />
                    ) : (
                      (c.fullName[0] || '?').toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.type === 'master' ? 'Мастер' : c.type === 'salon' ? 'Команда' : 'Клиент'}
                      {c.subtitle ? ` · ${c.subtitle}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addContact(c)}
                    disabled={c.isLinked || isAdding}
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                      c.isLinked
                        ? 'bg-muted text-muted-foreground cursor-default'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    } ${isAdding ? 'opacity-60' : ''}`}
                  >
                    {isAdding ? <Loader2 className="size-3 animate-spin" />
                      : c.isLinked ? '✓ В контактах'
                      : '+ Добавить'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results at all */}
      {canAdd && search.trim().length >= 2 && filtered.length === 0 && systemFiltered.length === 0 && !systemSearching && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">Никого не нашли</p>
          <p className="text-xs text-muted-foreground mt-1">Можно записать вручную ниже</p>
        </div>
      )}

      {/* Manual fallback */}
      {canAdd && search.trim().length >= 2 && (
        <div className="pt-1">
          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="w-full text-sm text-muted-foreground underline text-center py-2 hover:text-foreground"
            >
              Этого человека нет в CRES-CA → записать вручную
            </button>
          ) : (
            <form onSubmit={submitManual} className="space-y-2 p-4 rounded-xl border border-border bg-card">
              <p className="text-xs text-muted-foreground">Записать вручную (для тех, кто не в CRES-CA)</p>
              <input
                placeholder="Имя"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Телефон"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  inputMode="tel"
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={manualBusy || !manualName.trim()}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {manualBusy && <Loader2 className="size-4 animate-spin" />} Записать
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
