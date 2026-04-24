/** --- YAML
 * name: Superadmin blacklist client
 * description: List + inline ban form with profile search for /superadmin/blacklist. Uses /api/superadmin/blacklist endpoints.
 * created: 2026-04-21
 * --- */

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, X, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';
import type { BlacklistListRow } from '@/lib/superadmin/blacklist-data';

const TYPE_LABEL: Record<string, string> = { client: 'Клиент', master: 'Мастер', salon: 'Салон', other: '—' };

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function BlacklistClient({ rows }: { rows: BlacklistListRow[] }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-white/50">Заблокированные пользователи не могут войти в систему. Активная сессия принудительно завершается при следующем запросе.</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-md bg-rose-500/20 px-3 text-[13px] font-medium text-rose-200 transition-colors hover:bg-rose-500/30"
        >
          <Plus className="size-4" />
          Заблокировать пользователя
        </button>
      </div>

      {showForm && <AddForm onDone={() => setShowForm(false)} />}

      <BlacklistTable rows={rows} />
    </>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
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
    if (!selected) {
      toast.error('Выберите пользователя');
      return;
    }
    if (!reason.trim()) {
      toast.error('Укажите причину блокировки');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/blacklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile_id: selected.id,
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        toast.success(`${selected.name} заблокирован`);
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
    <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-500/[0.04] p-5">
      <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-rose-200">Блокировка пользователя</h3>

      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Пользователь</label>
          {selected ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px]">
              <div className="min-w-0">
                <div className="truncate text-white/90">{selected.name}</div>
                <div className="truncate text-[11px] text-white/45">{selected.email ?? selected.phone ?? '—'}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid size-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Очистить"
              >
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
                className="h-10 w-full rounded-md border border-white/15 bg-white/[0.04] pl-9 pr-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-rose-400/50"
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-white/10 bg-[#1f2023] shadow-2xl">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setResults([]);
                        setQuery('');
                      }}
                      className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-white/[0.08]"
                    >
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
          <label className="block text-[11px] uppercase tracking-wider text-white/50">Причина блокировки</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: спам, оскорбления"
            className="mt-1.5 h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 text-[13px] text-white placeholder-white/35 outline-none focus:border-rose-400/50"
          />
          <div className="mt-1 text-[10px] text-white/35">видна только суперадмину</div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.08]"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!selected || !reason.trim() || submitting}
          className="h-9 rounded-md bg-rose-500/80 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Блокирую…' : 'Заблокировать'}
        </button>
      </div>
    </div>
  );
}

function BlacklistTable({ rows }: { rows: BlacklistListRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const unban = async (row: BlacklistListRow) => {
    const ok = await confirm({
      title: 'Разблокировать пользователя?',
      description: `${row.profileName} снова сможет входить в систему.`,
      confirmLabel: 'Разблокировать',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/superadmin/blacklist?id=${row.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Разблокирован');
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        toast.error(`Ошибка: ${err.error}`);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
              <th className="w-[28%] px-3 py-2.5 text-left font-medium">Имя</th>
              <th className="w-[10%] px-3 py-2.5 text-left font-medium">Тип</th>
              <th className="w-[20%] px-3 py-2.5 text-left font-medium">Email</th>
              <th className="w-[26%] px-3 py-2.5 text-left font-medium">Причина</th>
              <th className="w-[12%] px-3 py-2.5 text-left font-medium">Заблокирован</th>
              <th className="w-[4%]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-white/40">
                  Чёрный список пуст
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
                  <td className="truncate px-3 py-2.5">
                    <Link href={`/superadmin/users/${r.profileId}`} className="text-white/90 hover:text-rose-300">
                      {r.profileName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex h-5 items-center rounded border border-white/10 bg-white/[0.04] px-1.5 text-[10px] font-medium uppercase tracking-wider text-white/70">
                      {TYPE_LABEL[r.profileType]}
                    </span>
                  </td>
                  <td className="truncate px-3 py-2.5 text-white/70">{r.profileEmail ?? '—'}</td>
                  <td className="truncate px-3 py-2.5 text-white/75">{r.reason ?? '—'}</td>
                  <td className="truncate px-3 py-2.5 text-white/55">{fmtDate(r.bannedAt)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => unban(r)}
                      className="h-7 rounded border border-white/10 bg-white/[0.04] px-2 text-[11px] text-white/65 transition-colors hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
                      title="Разблокировать"
                    >
                      <Ban className="inline size-3" /> Снять
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
