/** --- YAML
 * name: Superadmin users filters
 * description: Client-side search/filter bar for /superadmin/users — syncs q / type / sub into URL params.
 * created: 2026-04-19
 * --- */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Search, X } from 'lucide-react';

const TYPES = [
  { v: 'all', l: 'Все типы' },
  { v: 'client', l: 'Клиенты' },
  { v: 'master', l: 'Мастера' },
  { v: 'salon', l: 'Салоны' },
];

const SUBS = [
  { v: 'all', l: 'Любая подписка' },
  { v: 'none', l: 'Без подписки' },
  { v: 'trial', l: 'Trial' },
  { v: 'starter', l: 'Starter' },
  { v: 'pro', l: 'Pro' },
  { v: 'business', l: 'Business' },
  { v: 'whitelist', l: 'Whitelist' },
];

export function UsersFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setQ(sp.get('q') ?? '');
  }, [sp]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '' || v === 'all') next.delete(k);
      else next.set(k, v);
    });
    startTransition(() => router.replace(`?${next.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Поиск по имени, email, телефону…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update({ q: q.trim() || null });
          }}
          className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-9 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); update({ q: null }); }}
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Очистить"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <select
        value={sp.get('type') ?? 'all'}
        onChange={(e) => update({ type: e.target.value })}
        className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50"
      >
        {TYPES.map((t) => (
          <option key={t.v} value={t.v} className="bg-[#1a1b1e]">
            {t.l}
          </option>
        ))}
      </select>

      <select
        value={sp.get('sub') ?? 'all'}
        onChange={(e) => update({ sub: e.target.value })}
        className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50"
      >
        {SUBS.map((s) => (
          <option key={s.v} value={s.v} className="bg-[#1a1b1e]">
            {s.l}
          </option>
        ))}
      </select>
    </div>
  );
}
