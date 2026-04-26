/** --- YAML
 * name: Mini App Salon Clients Page
 * description: Admin/receptionist list of salon clients. Search by name/phone.
 *              Admin (unified) sees visits + spent; receptionist sees just contacts.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, User } from 'lucide-react';
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
      .then((j: ClientsData) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, salonId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.clients;
    return data.clients.filter(
      (c) =>
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full rounded-full bg-neutral-50 border border-neutral-200 pl-9 pr-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
        </div>
      ) : error || !data ? (
        <div className="text-sm text-neutral-600 text-center p-4">Нет доступа или ошибка загрузки</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-400">
          {query ? 'Нет совпадений' : 'Пока нет клиентов'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id} className="rounded-xl border border-neutral-200 bg-white border-neutral-200 p-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {c.avatar_url ? (
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
      )}
    </div>
  );
}
