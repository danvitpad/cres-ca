/** --- YAML
 * name: AddContactDialog (Web)
 * description: Веб-версия search-and-add для контактов.
 *              Поиск по /api/contacts/search → карточки с «+» / «В контактах».
 *              Внизу — раскрытие «Записать вручную» для off-system контактов.
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface SearchCard {
  id: string;
  type: 'client' | 'master' | 'salon';
  fullName: string;
  subtitle: string | null;
  avatarUrl: string | null;
  isLinked: boolean;
  payload: { profileId?: string; masterId?: string; salonId?: string };
}

interface Props {
  scope: 'client' | 'partners' | 'salon' | 'all';
  title: string;
  addEndpoint: string;
  addExtraFields?: Record<string, unknown>;
  /** Дополнительные поля диалога ручного режима (например, master selector для салона) */
  manualExtraSlot?: React.ReactNode;
  /** Доп. поля передаваемые в body POST для manual mode из manualExtraSlot */
  manualExtraValues?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddContactDialog({
  scope,
  title,
  addEndpoint,
  addExtraFields,
  manualExtraSlot,
  manualExtraValues,
  open,
  onClose,
  onAdded,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setShowManual(false);
      setManualName('');
      setManualPhone('');
      setManualEmail('');
    }
  }, [open]);

  // Live search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query.trim())}&scope=${scope}&limit=20`);
        if (res.ok) {
          const j = (await res.json()) as { results: SearchCard[] };
          setResults(j.results ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scope, open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function addCard(card: SearchCard) {
    if (card.isLinked || adding.has(card.id)) return;
    const profileId = card.payload.profileId;
    if (!profileId) return;
    setAdding((s) => new Set(s).add(card.id));
    try {
      const res = await fetch(addEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, ...(addExtraFields ?? {}) }),
      });
      if (res.ok) {
        setResults((rs) => rs.map((r) => r.id === card.id ? { ...r, isLinked: true } : r));
        toast.success(`${card.fullName} добавлен в контакты`);
        onAdded?.();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.detail || j?.error || 'Не удалось добавить');
      }
    } finally {
      setAdding((s) => { const n = new Set(s); n.delete(card.id); return n; });
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) {
      toast.error('Укажите имя');
      return;
    }
    setManualBusy(true);
    try {
      const res = await fetch(addEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: manualName.trim(),
          phone: manualPhone.trim() || null,
          email: manualEmail.trim() || null,
          ...(addExtraFields ?? {}),
          ...(manualExtraValues ?? {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.detail || j?.error || 'Не удалось добавить');
        return;
      }
      const j = (await res.json()) as { linked?: boolean };
      toast.success(j.linked ? 'Контакт привязан к существующему аккаунту' : 'Контакт добавлен');
      onAdded?.();
      onClose();
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-background md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя, телефон, email или cres-id"
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {query.trim().length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Начни вводить — найдём по имени, телефону, email или cres-id.
            </p>
          ) : loading && results.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ничего не нашли. Можно записать вручную ниже.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((r) => {
                const isAdding = adding.has(r.id);
                return (
                  <li
                    key={`${r.type}:${r.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-bold overflow-hidden">
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatarUrl} alt={r.fullName} className="size-full object-cover" />
                      ) : (
                        (r.fullName[0] || '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{r.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.type === 'master' ? 'Мастер' : r.type === 'salon' ? 'Команда' : 'Клиент'}
                        {r.subtitle ? ` · ${r.subtitle}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addCard(r)}
                      disabled={r.isLinked || isAdding}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                        r.isLinked
                          ? 'bg-muted text-muted-foreground cursor-default'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      } ${isAdding ? 'opacity-60' : ''}`}
                    >
                      {isAdding ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : r.isLinked ? (
                        <><Check className="size-3" /> В контактах</>
                      ) : (
                        <><UserPlus className="size-3" /> Добавить</>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Manual fallback */}
        <div className="border-t border-border px-5 pb-5 pt-3">
          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Этот человек не в CRES-CA → записать вручную
            </button>
          ) : (
            <form onSubmit={submitManual} className="space-y-2">
              <p className="text-xs text-muted-foreground">Записать вручную (для тех, кто не в CRES-CA)</p>
              <input
                autoFocus
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
              {manualExtraSlot}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={manualBusy}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {manualBusy && <Loader2 className="size-4 animate-spin" />} Добавить
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
