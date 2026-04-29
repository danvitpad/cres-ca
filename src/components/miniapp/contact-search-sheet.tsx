/** --- YAML
 * name: ContactSearchSheet (Mini App)
 * description: Bottom-sheet поиск + добавление контакта.
 *              Юзер вводит имя/телефон/email/cres-id → live results через
 *              /api/contacts/search → каждый результат с «+» / «В контактах».
 *              Внизу — fallback «Записать вручную» (для off-system контактов).
 * created: 2026-04-29
 * --- */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, UserPlus, Check, Phone } from 'lucide-react';
import { T, R, TYPE, SHADOW } from './design';
import { useTelegram } from './telegram-provider';

export interface SearchCard {
  id: string;
  type: 'client' | 'master' | 'salon';
  fullName: string;
  subtitle: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  isLinked: boolean;
  payload: {
    profileId?: string;
    masterId?: string;
    salonId?: string;
    inviteCode?: string | null;
  };
}

interface Props {
  /** "Кого ищем": client = искать клиентов; partners = мастеров; salon = команды; all = всё */
  scope: 'client' | 'partners' | 'salon' | 'all';
  /** Заголовок шторки */
  title: string;
  /**
   * Endpoint POST с body `{ profile_id }` — добавление существующего контакта.
   * Будет вызван при тапе «+» на карточке.
   * Например `/api/master/clients` или `/api/salon/<id>/clients`.
   */
  addEndpoint: string;
  /** Доп. поля в body POST (например для salon — master_id) */
  addExtraFields?: Record<string, unknown>;
  /** Подсказка в input */
  placeholder?: string;
  onClose: () => void;
  /** Вызывается после успешного добавления, чтобы обновить родительский список */
  onAdded?: (card: SearchCard) => void;
}

export function ContactSearchSheet({
  scope,
  title,
  addEndpoint,
  addExtraFields,
  placeholder,
  onClose,
  onAdded,
}: Props) {
  const { haptic } = useTelegram();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live search with 200ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/contacts/search?q=${encodeURIComponent(query.trim())}&scope=${scope}&limit=20`;
        const res = await fetch(url);
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
  }, [query, scope]);

  async function addCard(card: SearchCard) {
    if (card.isLinked || adding.has(card.id)) return;
    haptic('selection');
    setAdding((s) => new Set(s).add(card.id));
    try {
      const profileId = card.payload.profileId;
      if (!profileId) {
        setAdding((s) => { const n = new Set(s); n.delete(card.id); return n; });
        return;
      }
      const res = await fetch(addEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, ...(addExtraFields ?? {}) }),
      });
      if (res.ok) {
        setResults((rs) => rs.map((r) => r.id === card.id ? { ...r, isLinked: true } : r));
        onAdded?.(card);
      }
    } finally {
      setAdding((s) => { const n = new Set(s); n.delete(card.id); return n; });
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) {
      setManualErr('Укажите имя');
      return;
    }
    setManualBusy(true);
    setManualErr(null);
    try {
      const res = await fetch(addEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: manualName.trim(),
          phone: manualPhone.trim() || null,
          email: manualEmail.trim() || null,
          ...(addExtraFields ?? {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setManualErr(j?.detail || j?.error || 'Не удалось добавить');
        return;
      }
      setManualName('');
      setManualPhone('');
      setManualEmail('');
      setShowManual(false);
      onAdded?.({} as SearchCard);
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '90vh',
          background: T.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          paddingBottom: 32,
          boxShadow: SHADOW.elevated,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ ...TYPE.h3, color: T.text, margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: T.bgSubtle,
              border: 'none',
              width: 32,
              height: 32,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} color={T.text} />
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search
            size={18}
            color={T.textTertiary}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || 'Имя, телефон, email или cres-id'}
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              borderRadius: R.pill,
              border: `1px solid ${T.border}`,
              background: T.surfaceElevated,
              fontSize: 14,
              color: T.text,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 12 }}>
          {query.trim().length < 2 ? (
            <p style={{ ...TYPE.caption, color: T.textTertiary, textAlign: 'center', padding: '24px 0', margin: 0 }}>
              Начни вводить — найдём по имени, телефону, email или cres-id.
            </p>
          ) : loading && results.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Loader2 size={20} className="animate-spin" color={T.textTertiary} />
            </div>
          ) : results.length === 0 ? (
            <p style={{ ...TYPE.caption, color: T.textTertiary, textAlign: 'center', padding: '24px 0', margin: 0 }}>
              Ничего не нашли. Можно записать вручную ниже.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map((r) => {
                const isAdding = adding.has(r.id);
                return (
                  <li
                    key={`${r.type}:${r.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      background: T.surfaceElevated,
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: R.md,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: T.bgSubtle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: T.text,
                      }}
                    >
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatarUrl} alt={r.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (r.fullName[0] || '?').toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.fullName}
                      </p>
                      <p style={{ ...TYPE.micro, color: T.textTertiary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.type === 'master' ? 'Мастер' : r.type === 'salon' ? 'Команда' : 'Клиент'}
                        {r.subtitle ? ` · ${r.subtitle}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addCard(r)}
                      disabled={r.isLinked || isAdding}
                      style={{
                        flexShrink: 0,
                        padding: '8px 12px',
                        borderRadius: R.pill,
                        border: 'none',
                        background: r.isLinked ? T.bgSubtle : T.text,
                        color: r.isLinked ? T.textTertiary : T.bg,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: r.isLinked ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: isAdding ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : r.isLinked ? (
                        <><Check size={12} /> В контактах</>
                      ) : (
                        <><UserPlus size={12} /> Добавить</>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Manual entry fallback */}
        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '8px 0',
              textDecoration: 'underline',
            }}
          >
            Этот человек не в CRES-CA → записать вручную
          </button>
        ) : (
          <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: `1px solid ${T.borderSubtle}` }}>
            <p style={{ ...TYPE.caption, color: T.textSecondary, margin: 0 }}>
              Записать вручную (для тех, кто не в CRES-CA)
            </p>
            <input
              autoFocus
              placeholder="Имя"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: T.surfaceElevated,
                fontSize: 13,
                color: T.text,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <input
              placeholder="Телефон"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              inputMode="tel"
              style={{
                padding: '10px 12px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: T.surfaceElevated,
                fontSize: 13,
                color: T.text,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <input
              placeholder="Email"
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: R.md,
                border: `1px solid ${T.border}`,
                background: T.surfaceElevated,
                fontSize: 13,
                color: T.text,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {manualErr && <p style={{ color: T.danger, fontSize: 12, margin: 0 }}>{manualErr}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: R.pill,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={manualBusy}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: R.pill,
                  border: 'none',
                  background: T.text,
                  color: T.bg,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: manualBusy ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {manualBusy && <Loader2 size={14} className="animate-spin" />} Добавить
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
