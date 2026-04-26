/** --- YAML
 * name: MasterMiniAppClientsList
 * description: Master Mini App clients — searchable list with avatars, behavior badges. Flat cards, flat avatars (Phase 7.3).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, Star, Crown, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (!userId) return;
    (async () => {
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
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

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

      {/* Search */}
      <div style={{ position: 'relative', padding: `12px ${PAGE_PADDING_X}px 0` }}>
        <Search
          size={18}
          color={T.textTertiary}
          style={{ position: 'absolute', left: PAGE_PADDING_X + 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или телефону"
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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 48 }}>{rows.length === 0 ? '👋' : '🔍'}</span>}
            title={rows.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}
            desc={rows.length === 0 ? 'Они появятся после первых записей' : 'Попробуй другой запрос'}
          />
        ) : (
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
        )}
      </div>
    </MobilePage>
  );
}
