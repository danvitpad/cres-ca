/** --- YAML
 * name: Superadmin whitelist client
 * description: List + inline add form with profile search for /superadmin/whitelist. Uses /api/superadmin endpoints.
 * created: 2026-04-19
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';
import type { WhitelistListRow } from '@/lib/superadmin/whitelist-data';

const TYPE_LABEL: Record<string, string> = { client: 'Клиент', master: 'Мастер', salon: 'Салон', other: '—' };

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

function fmtDate(d: string | null) {
  if (!d) return 'Навсегда';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function WhitelistClient({ rows, preselectProfileId }: { rows: WhitelistListRow[]; preselectProfileId?: string }) {
  const [showForm, setShowForm] = useState(!!preselectProfileId);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-white/50">Пользователи с бесплатным доступом к платформе.</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-md bg-violet-500/20 px-3 text-[13px] font-medium text-violet-200 transition-colors hover:bg-violet-500/30"
        >
          <Plus className="size-4" />
          Добавить в whitelist
        </button>
      </div>

      {showForm && <AddForm preselectProfileId={preselectProfileId} onDone={() => setShowForm(false)} />}

      <WhitelistTable rows={rows} />
    </>
  );
}

function AddForm({ preselectProfileId, onDone }: { preselectProfileId?: string; onDone: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [plan, setPlan] = useState<'starter' | 'pro' | 'business'>('pro');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (preselectProfileId && !selected) {
      fetch(`/api/superadmin/users/search?q=${encodeURIComponent(preselectProfileId)}`)
        .then((r) => r.json())
        .then(() => { /* optional hydration; keep manual search for simplicity */ })
        .catch(() => {});
    }
  }, [preselectProfileId, selected]);

  useEffect(() => {
    if (!query.trim() || selected) { setResults([]); return; }
    abort.current?.abort();
    abort.current = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/superadmin/users/search?q=${encodeURIComponent(query)}`, { signal: abort.current?.signal })
        .then((r) => r.json())
        .then((data: { results: SearchResult[] }) => setResults(data.results ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  const submit = async () => {
    if (!selected) { toast.error('Выберите пользователя'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/whitelist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile_id: selected.id,
          granted_plan: plan,
          reason: reason.trim() || null,
          expires_at: expiresAt ? new Date(expiresAt + 'T23:59:59').toISOString() : null,
        }),
      });
      if (res.ok) {
        toast.success(`${selected.name} добавлен в whitelist`);
        onDone();
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-5">
      <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-violet-200">Добавление в whitelist</h3>

      <div className="grid grid-cols-[1fr_180px_180px] gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Пользователь</label>
          {selected ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px]">
              <div className="min-w-0">
                <div className="truncate text-white/90">{selected.name}</div>
                <div className="truncate text-[11px] text-white/45">{selected.email ?? selected.phone ?? '—'}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="grid size-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white" aria-label="Очистить">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени, email, телефону…"
                className="h-10 w-full rounded-md border border-white/15 bg-white/[0.04] pl-9 pr-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-white/10 bg-[#1f2023] shadow-2xl">
                  {results.map((r) => (
                    <button key={r.id} type="button" onClick={() => { setSelected(r); setResults([]); setQuery(''); }} className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-white/[0.08]">
                      <div className="text-[13px] text-white/90">{r.name}</div>
                      <div className="text-[11px] text-white/45">{r.email ?? r.phone ?? '—'} · {r.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-white/50">План</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value as 'starter' | 'pro' | 'business')} className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50">
            <option value="starter" className="bg-[#1a1b1e]">Starter</option>
            <option value="pro" className="bg-[#1a1b1e]">Pro</option>
            <option value="business" className="bg-[#1a1b1e]">Business</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Действует до</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none focus:border-violet-400/50" />
          <div className="mt-1 text-[10px] text-white/35">пусто = навсегда</div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[11px] uppercase tracking-wider text-white/50">Причина</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="beta tester, partner, founder, influencer…"
          className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-violet-400/50"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white/75 hover:bg-white/[0.08]">Отмена</button>
        <button type="button" onClick={submit} disabled={submitting || !selected} className="h-9 rounded-md bg-violet-500 px-4 text-[13px] font-medium text-white disabled:opacity-40 hover:bg-violet-400">
          {submitting ? 'Добавляем…' : 'Добавить в whitelist'}
        </button>
      </div>
    </div>
  );
}

function WhitelistTable({ rows }: { rows: WhitelistListRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-[13px] text-white/50">В whitelist пока никого нет.</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
            <th className="px-3 py-2.5 text-left font-medium">Имя</th>
            <th className="px-3 py-2.5 text-left font-medium">Тип</th>
            <th className="px-3 py-2.5 text-left font-medium">План</th>
            <th className="px-3 py-2.5 text-left font-medium">Причина</th>
            <th className="px-3 py-2.5 text-left font-medium">С</th>
            <th className="px-3 py-2.5 text-left font-medium">До</th>
            <th className="px-3 py-2.5 text-right font-medium">—</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Row key={r.id} row={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: WhitelistListRow }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const remove = async () => {
    const ok = await confirm({
      title: 'Убрать из whitelist?',
      description: `${row.profileName} потеряет бесплатный доступ. Если нет платной подписки — план будет понижен.`,
      confirmLabel: 'Убрать',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/superadmin/whitelist?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) {
      toast.success('Удалено из whitelist');
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      toast.error(`Ошибка: ${err.error}`);
    }
  };

  return (
    <tr className={['border-t border-white/5 hover:bg-white/[0.03]', row.isExpired ? 'opacity-60' : ''].join(' ')}>
      <td className="px-3 py-2.5">
        <Link href={`/superadmin/users/${row.profileId}`} className="text-white/90 hover:text-violet-300">
          {row.profileName}
        </Link>
        <div className="truncate text-[11px] text-white/40">{row.profileEmail ?? '—'}</div>
      </td>
      <td className="px-3 py-2.5 text-[11px] uppercase tracking-wider text-white/65">{TYPE_LABEL[row.profileType]}</td>
      <td className="px-3 py-2.5 uppercase text-[11px] tracking-wider text-emerald-300">{row.grantedPlan}</td>
      <td className="px-3 py-2.5 text-white/65">{row.reason ?? '—'}</td>
      <td className="px-3 py-2.5 text-white/65">{fmtDate(row.createdAt)}</td>
      <td className={['px-3 py-2.5', row.isExpired ? 'text-rose-300' : 'text-white/65'].join(' ')}>
        {fmtDate(row.expiresAt)}
        {row.isExpired && <span className="ml-1 text-[10px] uppercase tracking-wider">истёк</span>}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
        >
          {busy ? '…' : 'Убрать'}
        </button>
      </td>
    </tr>
  );
}
