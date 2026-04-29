/** --- YAML
 * name: Mini App Salon Clients Page
 * description: Унифицированный поиск: фильтр существующих клиентов команды +
 *              live-search в CRES-CA для добавления новых. Multi-word AND,
 *              ловит «имя фамилия» и «фамилия имя», телефон, email, cres-id.
 * created: 2026-04-19
 * updated: 2026-04-29
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, User, UserPlus, Loader2, Check } from 'lucide-react';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface ClientRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  master_name: string | null;
  visits: number | null;
  spent: number | null;
}

interface ClientsData {
  role: 'admin' | 'receptionist';
  salon: { id: string; name: string; team_mode: 'unified' | 'marketplace' };
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

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      if (parsed.initData) return parsed.initData;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

export default function MiniAppSalonClientsPage() {
  const params = useParams();
  const salonId = params.id as string;
  const { ready } = useTelegram();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ClientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [systemResults, setSystemResults] = useState<SystemCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const initData = getInitData();
    if (!initData) {
      setError('no_init_data');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/telegram/m/salon/${salonId}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ClientsData) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, salonId, reloadKey]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.clients;
    const tokens = q.split(/\s+/).filter(Boolean);
    return data.clients.filter((c) => {
      const hay = `${(c.full_name ?? '').toLowerCase()} ${(c.phone ?? '').toLowerCase()}`;
      return tokens.every((t) => hay.includes(t));
    });
  }, [data, query]);

  const canAdd = data?.role === 'admin' || data?.role === 'receptionist';

  // Live API search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!canAdd || query.trim().length < 2) {
      setSystemResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const initData = getInitData();
        const headers: HeadersInit = {};
        if (initData) headers['X-TG-Init-Data'] = initData;
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query.trim())}&limit=20`, { headers });
        if (res.ok) {
          const j = (await res.json()) as { results: SystemCard[] };
          setSystemResults(j.results ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, canAdd]);

  const existingNames = useMemo(() => new Set((data?.clients ?? []).map((c) => (c.full_name ?? '').toLowerCase())), [data]);
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
        setReloadKey((k) => k + 1);
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
        setManualName(''); setManualPhone(''); setManualEmail('');
        setShowManual(false);
        setQuery('');
        setReloadKey((k) => k + 1);
      }
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={canAdd ? 'Имя, телефон, email или cres-id' : 'Поиск по имени или телефону'}
          className="w-full h-10 rounded-full bg-neutral-50 border border-neutral-200 pl-9 pr-9 text-sm focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-neutral-400" />
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-14 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="h-14 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="h-14 rounded-xl bg-neutral-100 animate-pulse" />
        </div>
      ) : error || !data ? (
        <div className="text-sm text-neutral-600 text-center p-4">Нет доступа или ошибка загрузки</div>
      ) : (
        <>
          {/* Existing clients section */}
          {filtered.length > 0 && (
            <>
              {query.trim().length >= 2 && (
                <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mt-1 mb-1">Клиенты команды</p>
              )}
              <ul className="space-y-2">
                {filtered.map((c) => (
                  <li key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center gap-3">
                    <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        <User className="size-4 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.full_name ?? 'Без имени'}</div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {c.phone ?? '—'}
                        {c.master_name && <span className="ml-1 text-neutral-400">· {c.master_name}</span>}
                      </div>
                    </div>
                    {c.visits !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold">{c.visits}</div>
                        <div className="text-[10px] text-neutral-400">{formatCurrency(c.spent ?? 0)}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {filtered.length === 0 && query.trim().length < 2 && (
            <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-400">
              Пока нет клиентов команды
            </div>
          )}

          {/* System search results */}
          {canAdd && query.trim().length >= 2 && systemFiltered.length > 0 && (
            <div className="pt-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1">В CRES-CA</p>
              <ul className="space-y-2">
                {systemFiltered.map((c) => {
                  const isAdding = adding.has(c.id);
                  return (
                    <li key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center gap-3">
                      <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                        {c.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <User className="size-4 text-neutral-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.fullName}</div>
                        <div className="text-[11px] text-neutral-500 truncate">
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
                            ? 'bg-neutral-100 text-neutral-500 cursor-default'
                            : 'bg-neutral-900 text-white'
                        } ${isAdding ? 'opacity-60' : ''}`}
                      >
                        {isAdding ? <Loader2 className="size-3 animate-spin" />
                          : c.isLinked ? <><Check className="size-3" /> В контактах</>
                          : <><UserPlus className="size-3" /> Добавить</>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* No results */}
          {canAdd && query.trim().length >= 2 && filtered.length === 0 && systemFiltered.length === 0 && !searching && (
            <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-400">
              Никого не нашли. Можно записать вручную ниже.
            </div>
          )}

          {/* Manual fallback */}
          {canAdd && query.trim().length >= 2 && (
            <div className="pt-3">
              {!showManual ? (
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="w-full text-sm text-neutral-600 underline text-center py-2"
                >
                  Этого человека нет в CRES-CA → записать вручную
                </button>
              ) : (
                <form onSubmit={submitManual} className="space-y-2 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                  <p className="text-xs text-neutral-600">Записать вручную (для тех, кто не в CRES-CA)</p>
                  <input
                    placeholder="Имя"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm"
                  />
                  <input
                    placeholder="Телефон"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    inputMode="tel"
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm"
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManual(false)}
                      className="flex-1 h-10 rounded-full border border-neutral-200 text-sm font-semibold"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={manualBusy || !manualName.trim()}
                      className="flex-1 h-10 rounded-full bg-neutral-900 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                      {manualBusy && <Loader2 className="size-4 animate-spin" />} Записать
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
