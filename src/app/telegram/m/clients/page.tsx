/** --- YAML
 * name: MasterMiniAppClientsList
 * description: Master Mini App clients — searchable list with avatars, behavior badges. Flat cards, flat avatars (Phase 7.3).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, Star, Crown, Loader2, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, PageHeader, AvatarCircle, EmptyState } from '@/components/miniapp/shells';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X } from '@/components/miniapp/design';

function getInitData(): string | null {
  // 1) Live initData from Telegram WebApp
  if (typeof window !== 'undefined') {
    const w = window as { Telegram?: { WebApp?: { initData?: string } } };
    const live = w.Telegram?.WebApp?.initData;
    if (live) return live;
    // 2) Fallback to sessionStorage stash from /telegram entry
    try {
      const stash = sessionStorage.getItem('cres:tg');
      if (stash) {
        const parsed = JSON.parse(stash) as { initData?: string };
        if (parsed.initData) return parsed.initData;
      }
    } catch { /* ignore */ }
  }
  return null;
}

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  has_health_alert: boolean;
  behavior_indicators: string[] | null;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  if (diff < 30) return `${Math.round(diff / 7)} нед. назад`;
  if (diff < 365) return `${Math.round(diff / 30)} мес. назад`;
  return `${Math.round(diff / 365)} г. назад`;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export default function MasterMiniAppClientsPage() {
  const { ready, haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [masterId, setMasterId] = useState<string | null>(null);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // System search results (other people in CRES-CA, excluding existing clients)
  interface SystemCard {
    id: string;
    type: 'client' | 'master' | 'salon';
    fullName: string;
    subtitle: string | null;
    avatarUrl: string | null;
    isLinked: boolean;
    payload: { profileId?: string; masterId?: string; salonId?: string };
  }
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
    if (!userId) return;
    (async () => {
      setLoading(true);
      const initData = getInitData();
      if (!initData) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/telegram/m/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        setMasterId(json.masterId ?? null);
        setRows((json.clients ?? []) as ClientRow[]);
      } catch { /* network error */ }
      setLoading(false);
    })();
  }, [userId, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Multi-word AND: all tokens must appear in name or phone
    const tokens = q.split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const hay = `${r.full_name.toLowerCase()} ${(r.phone ?? '').toLowerCase()}`;
      return tokens.every((t) => hay.includes(t));
    });
  }, [rows, query]);

  // Live API search: 200ms debounce, only when query >= 2 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
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
  }, [query]);

  const existingClientProfileIds = useMemo(() => {
    // We only have full_name in ClientRow — match by name to existing clients
    return new Set(rows.map((r) => r.full_name.toLowerCase()));
  }, [rows]);

  const systemFiltered = useMemo(() => {
    return systemResults.filter((c) => !existingClientProfileIds.has(c.fullName.toLowerCase()) || !c.isLinked);
  }, [systemResults, existingClientProfileIds]);

  async function addContact(card: SystemCard) {
    if (!card.payload.profileId || adding.has(card.id) || card.isLinked) return;
    haptic('selection');
    setAdding((s) => new Set(s).add(card.id));
    try {
      const res = await fetch('/api/master/clients', {
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
      const res = await fetch('/api/master/clients', {
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

  if (!ready) {
    return (
      <MobilePage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Loader2 size={24} className="animate-spin" color={T.textTertiary} />
        </div>
      </MobilePage>
    );
  }

  return (
    <MobilePage>
      <PageHeader title="Клиенты" subtitle={rows.length > 0 ? `${rows.length} ${plural(rows.length, ['клиент', 'клиента', 'клиентов'])}` : undefined} />

      {/* Tabs: Clients / Partners */}
      <div style={{ display: 'flex', gap: 6, padding: `8px ${PAGE_PADDING_X}px 0` }}>
        <button
          type="button"
          onClick={() => haptic('selection')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: R.pill,
            border: 'none',
            background: T.text,
            color: T.bg,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Клиенты
        </button>
        <Link
          href="/telegram/m/partners"
          onClick={() => haptic('selection')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: R.pill,
            border: `1px solid ${T.border}`,
            background: 'transparent',
            color: T.textSecondary,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Партнёры
        </Link>
      </div>

      {/* Universal search — clients filter + people from CRES-CA */}
      <div style={{ padding: `12px ${PAGE_PADDING_X}px 0` }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            color={T.textTertiary}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон, email или cres-id"
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              borderRadius: R.pill,
              border: `1px solid ${T.border}`,
              background: T.surfaceElevated,
              ...TYPE.body,
              color: T.text,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {searching && (
            <Loader2
              size={16}
              className="animate-spin"
              color={T.textTertiary}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
          )}
        </div>
      </div>

      <div style={{ padding: `16px ${PAGE_PADDING_X}px 0` }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{ height: 72, borderRadius: R.md, background: T.bgSubtle }}
              />
            ))}
          </div>
        ) : !masterId ? (
          <EmptyState
            icon={<span style={{ fontSize: 48 }}>👥</span>}
            title="Профиль мастера не найден"
          />
        ) : (
          <>
          {/* Section: Existing clients (filtered) */}
          {filtered.length > 0 && (
            <>
              {query.trim().length >= 2 && (
                <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Ваши клиенты
                </p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((c, i) => {
              const isVIP = c.total_visits >= 10;
              const isExcellent = (c.behavior_indicators ?? []).includes('excellent');
              const isRisky = (c.behavior_indicators ?? []).some(
                (b) => b === 'frequent_canceller' || b === 'rude' || b === 'often_late',
              );
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.02 }}
                >
                  <Link
                    href={`/telegram/m/clients/${c.id}`}
                    onClick={() => haptic('light')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: T.surface,
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: R.md,
                      textDecoration: 'none',
                      color: T.text,
                      boxShadow: SHADOW.card,
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <AvatarCircle url={null} name={initials(c.full_name) || '—'} size={48} />
                      {c.has_health_alert && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: T.danger,
                            border: `2px solid ${T.surface}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AlertTriangle size={10} color="#fff" />
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.full_name}
                        </p>
                        {isVIP && <Crown size={13} color="#f59e0b" fill="#f59e0b" />}
                        {isExcellent && <Star size={13} color="#f59e0b" fill="#f59e0b" />}
                      </div>
                      <p style={{ ...TYPE.caption, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                        {c.total_visits} {plural(c.total_visits, ['визит', 'визита', 'визитов'])} · {Number(c.total_spent).toFixed(0)} ₴
                      </p>
                      <p style={{ ...TYPE.micro, marginTop: 2 }}>
                        {c.last_visit_at ? `Был ${daysAgo(c.last_visit_at)}` : 'Ещё не приходил'}
                      </p>
                    </div>
                    {isRisky && (
                      <span
                        style={{
                          flexShrink: 0,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: `1px solid ${T.danger}40`,
                          background: T.dangerSoft,
                          color: T.danger,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        риск
                      </span>
                    )}
                  </Link>
                </motion.li>
              );
            })}
              </ul>
            </>
          )}

          {/* Empty state when no clients and no system search yet */}
          {filtered.length === 0 && query.trim().length < 2 && rows.length === 0 && (
            <EmptyState
              icon={<span style={{ fontSize: 48 }}>👋</span>}
              title="Клиентов пока нет"
              desc="Начни искать в строке выше — найдём людей в CRES-CA"
            />
          )}

          {/* Section: People in CRES-CA matching the query */}
          {query.trim().length >= 2 && systemFiltered.length > 0 && (
            <div style={{ marginTop: filtered.length > 0 ? 24 : 0 }}>
              <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                В CRES-CA
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {systemFiltered.map((c) => {
                  const isAdding = adding.has(c.id);
                  return (
                    <li
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        background: T.surface,
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: R.md,
                      }}
                    >
                      <AvatarCircle url={c.avatarUrl} name={initials(c.fullName) || '—'} size={48} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...TYPE.bodyStrong, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.fullName}
                        </p>
                        <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.type === 'master' ? 'Мастер' : c.type === 'salon' ? 'Команда' : 'Клиент'}
                          {c.subtitle ? ` · ${c.subtitle}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addContact(c)}
                        disabled={c.isLinked || isAdding}
                        style={{
                          flexShrink: 0,
                          padding: '8px 14px',
                          borderRadius: R.pill,
                          border: 'none',
                          background: c.isLinked ? T.bgSubtle : T.text,
                          color: c.isLinked ? T.textTertiary : T.bg,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: c.isLinked ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          opacity: isAdding ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          minHeight: 36,
                        }}
                      >
                        {isAdding ? <Loader2 size={12} className="animate-spin" />
                          : c.isLinked ? <><Check size={12} /> В контактах</>
                          : <><UserPlus size={12} /> Добавить</>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Empty search */}
          {query.trim().length >= 2 && filtered.length === 0 && systemFiltered.length === 0 && !searching && (
            <EmptyState
              icon={<span style={{ fontSize: 48 }}>🔍</span>}
              title="Ничего не нашли"
              desc="Попробуй другой запрос или запиши вручную ниже"
            />
          )}

          {/* Manual fallback link */}
          {query.trim().length >= 2 && (
            <div style={{ marginTop: 16, paddingBottom: 24 }}>
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
                    padding: 0,
                    textDecoration: 'underline',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  Этого человека нет в CRES-CA → записать вручную
                </button>
              ) : (
                <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: R.md, background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}` }}>
                  <p style={{ ...TYPE.caption, color: T.textSecondary, margin: 0 }}>Записать вручную (для тех, кто не в CRES-CA)</p>
                  <input
                    placeholder="Имя"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    placeholder="Телефон"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    inputMode="tel"
                    style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowManual(false)}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: R.pill, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={manualBusy || !manualName.trim()}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: R.pill, border: 'none', background: T.text, color: T.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: manualBusy || !manualName.trim() ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {manualBusy && <Loader2 size={14} className="animate-spin" />} Записать
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          </>
        )}
      </div>
    </MobilePage>
  );
}

