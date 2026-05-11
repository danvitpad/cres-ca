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
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { getCached, setCached } from '@/lib/miniapp/cache';

const I18N: Record<MiniAppLang, {
  pageTitle: string;
  clientsCount: (n: number) => string;
  visitsCount: (n: number, money: string) => string;
  tabClients: string; tabPartners: string;
  searchPh: string;
  yourClients: string;
  inCresca: string;
  notFoundTitle: string; notFoundDesc: string;
  emptyTitle: string; emptyDesc: string;
  noMasterTitle: string;
  wasLast: (text: string) => string; neverCame: string;
  riskBadge: string;
  inContacts: string; addBtn: string;
  typeMaster: string; typeSalon: string; typeClient: string;
  manualLink: string; manualHint: string;
  manualName: string; manualPhone: string; manualEmail: string;
  cancelBtn: string; saveBtn: string;
  statTotal: string; statVip: string; statSleeping: string;
  daysAgoLabels: DaysAgoLabels;
}> = {
  uk: {
    pageTitle: 'Клієнти',
    clientsCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'клієнт'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'клієнти' : 'клієнтів';
      return `${n} ${w}`;
    },
    visitsCount: (n, m) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'візит'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'візити' : 'візитів';
      return `${n} ${w} · ${m} ₴`;
    },
    tabClients: 'Клієнти', tabPartners: 'Партнери',
    searchPh: 'Імʼя, телефон, email або cres-id',
    yourClients: 'Твої клієнти', inCresca: 'У CRES-CA',
    notFoundTitle: 'Нічого не знайшли',
    notFoundDesc: 'Спробуй інший запит або запиши вручну нижче',
    emptyTitle: 'Клієнтів поки немає',
    emptyDesc: 'Починай шукати у рядку вище — знайдемо людей у CRES-CA',
    noMasterTitle: 'Профіль майстра не знайдено',
    wasLast: (s) => `Був ${s}`,
    neverCame: 'Ще не приходив', riskBadge: 'ризик',
    inContacts: 'У контактах', addBtn: 'Додати',
    typeMaster: 'Майстер', typeSalon: 'Команда', typeClient: 'Клієнт',
    manualLink: 'Цієї людини немає в CRES-CA → записати вручну',
    manualHint: 'Записати вручну (для тих, хто не в CRES-CA)',
    manualName: 'Імʼя', manualPhone: 'Телефон', manualEmail: 'Email',
    cancelBtn: 'Скасувати', saveBtn: 'Записати',
    statTotal: 'Всього', statVip: 'VIP', statSleeping: 'Сплячі',
    daysAgoLabels: {
      today: 'сьогодні', yesterday: 'вчора',
      daysAgo: (n) => `${n} дн. тому`,
      weeksAgo: (n) => `${n} тиж. тому`,
      monthsAgo: (n) => `${n} міс. тому`,
      yearsAgo: (n) => `${n} р. тому`,
    },
  },
  ru: {
    pageTitle: 'Клиенты',
    clientsCount: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'клиент'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'клиента' : 'клиентов';
      return `${n} ${w}`;
    },
    visitsCount: (n, m) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'визит'
        : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? 'визита' : 'визитов';
      return `${n} ${w} · ${m} ₴`;
    },
    tabClients: 'Клиенты', tabPartners: 'Партнёры',
    searchPh: 'Имя, телефон, email или cres-id',
    yourClients: 'Ваши клиенты', inCresca: 'В CRES-CA',
    notFoundTitle: 'Ничего не нашли',
    notFoundDesc: 'Попробуй другой запрос или запиши вручную ниже',
    emptyTitle: 'Клиентов пока нет',
    emptyDesc: 'Начни искать в строке выше — найдём людей в CRES-CA',
    noMasterTitle: 'Профиль мастера не найден',
    wasLast: (s) => `Был ${s}`,
    neverCame: 'Ещё не приходил', riskBadge: 'риск',
    inContacts: 'В контактах', addBtn: 'Добавить',
    typeMaster: 'Мастер', typeSalon: 'Команда', typeClient: 'Клиент',
    manualLink: 'Этого человека нет в CRES-CA → записать вручную',
    manualHint: 'Записать вручную (для тех, кто не в CRES-CA)',
    manualName: 'Имя', manualPhone: 'Телефон', manualEmail: 'Email',
    cancelBtn: 'Отмена', saveBtn: 'Записать',
    statTotal: 'Всего', statVip: 'VIP', statSleeping: 'Спящие',
    daysAgoLabels: {
      today: 'сегодня', yesterday: 'вчера',
      daysAgo: (n) => `${n} дн. назад`,
      weeksAgo: (n) => `${n} нед. назад`,
      monthsAgo: (n) => `${n} мес. назад`,
      yearsAgo: (n) => `${n} г. назад`,
    },
  },
  en: {
    pageTitle: 'Clients',
    clientsCount: (n) => `${n} ${n === 1 ? 'client' : 'clients'}`,
    visitsCount: (n, m) => `${n} ${n === 1 ? 'visit' : 'visits'} · ${m} ₴`,
    tabClients: 'Clients', tabPartners: 'Partners',
    searchPh: 'Name, phone, email or cres-id',
    yourClients: 'Your clients', inCresca: 'In CRES-CA',
    notFoundTitle: 'Nothing found',
    notFoundDesc: 'Try another query or add manually below',
    emptyTitle: 'No clients yet',
    emptyDesc: 'Start typing in the search above — we’ll find people on CRES-CA',
    noMasterTitle: 'Master profile not found',
    wasLast: (s) => `Last visit ${s}`,
    neverCame: 'Never visited', riskBadge: 'risk',
    inContacts: 'In contacts', addBtn: 'Add',
    typeMaster: 'Master', typeSalon: 'Team', typeClient: 'Client',
    manualLink: 'Person not on CRES-CA → add manually',
    manualHint: 'Add manually (for people outside CRES-CA)',
    manualName: 'Name', manualPhone: 'Phone', manualEmail: 'Email',
    cancelBtn: 'Cancel', saveBtn: 'Add',
    statTotal: 'Total', statVip: 'VIP', statSleeping: 'Sleeping',
    daysAgoLabels: {
      today: 'today', yesterday: 'yesterday',
      daysAgo: (n) => `${n}d ago`,
      weeksAgo: (n) => `${n}w ago`,
      monthsAgo: (n) => `${n}mo ago`,
      yearsAgo: (n) => `${n}y ago`,
    },
  },
};

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

type DaysAgoLabels = {
  today: string; yesterday: string;
  daysAgo: (n: number) => string; weeksAgo: (n: number) => string;
  monthsAgo: (n: number) => string; yearsAgo: (n: number) => string;
};
function daysAgo(iso: string | null, l: DaysAgoLabels): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return l.today;
  if (diff === 1) return l.yesterday;
  if (diff < 7) return l.daysAgo(diff);
  if (diff < 30) return l.weeksAgo(Math.round(diff / 7));
  if (diff < 365) return l.monthsAgo(Math.round(diff / 30));
  return l.yearsAgo(Math.round(diff / 365));
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
  const lang = useMiniAppLocale();
  const t = I18N[lang];
  const { userId } = useAuthStore();
  // Кэш на 60с — вернулся на таб → данные мгновенно из памяти, в фоне обновляется.
  type CachedList = { masterId: string | null; rows: ClientRow[] };
  const cacheKey = userId ? `m-clients:${userId}` : null;
  const initial = cacheKey ? getCached<CachedList>(cacheKey) : undefined;
  const [masterId, setMasterId] = useState<string | null>(initial?.masterId ?? null);
  const [rows, setRows] = useState<ClientRow[]>(initial?.rows ?? []);
  const [loading, setLoading] = useState(!initial);
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
    if (!userId || !cacheKey) return;
    const hasCache = !!getCached<CachedList>(cacheKey);
    (async () => {
      // Скелет — только если данных совсем нет. Если есть кэш — silent refresh.
      if (!hasCache) setLoading(true);
      const initData = getInitData();
      // initData необязателен — API принимает и cookie session (browser users)
      try {
        const res = await fetch('/api/telegram/m/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: initData ?? null }),
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        const fresh: CachedList = {
          masterId: json.masterId ?? null,
          rows: (json.clients ?? []) as ClientRow[],
        };
        setMasterId(fresh.masterId);
        setRows(fresh.rows);
        setCached<CachedList>(cacheKey, fresh);
      } catch { /* network error */ }
      setLoading(false);
    })();
  }, [userId, reloadKey, cacheKey]);

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

  // Stats: VIP = ≥10 visits, Спящий = не было ≥90 дней (или never)
  const stats = useMemo(() => {
    let vip = 0, sleeping = 0;
    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    for (const r of rows) {
      if (r.total_visits >= 10) vip++;
      if (r.last_visit_at) {
        const last = new Date(r.last_visit_at).getTime();
        if (now - last >= NINETY_DAYS) sleeping++;
      }
    }
    return { total: rows.length, vip, sleeping };
  }, [rows]);

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
      <PageHeader title={t.pageTitle} subtitle={rows.length > 0 ? t.clientsCount(rows.length) : undefined} />

      {/* Раньше тут был переключатель «Клиенты / Партнёры», но Партнёры —
          отдельный раздел в табе «Ещё», ссылка дублировала ту же страницу.
          Убрано по запросу 2026-05-07. */}

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
            placeholder={t.searchPh}
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

      {/* Stats strip — 3 карточки (Open Design). Показываем когда есть клиенты. */}
      {rows.length > 0 && !loading && (
        <div style={{ padding: `12px ${PAGE_PADDING_X}px 0` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            <ClientStatCard label={t.statTotal} value={stats.total} color={T.text} />
            <ClientStatCard label={t.statVip} value={stats.vip} color={T.accent} />
            <ClientStatCard label={t.statSleeping} value={stats.sleeping} color={T.danger} />
          </div>
        </div>
      )}

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
            title={t.noMasterTitle}
          />
        ) : (
          <>
          {/* Section: Existing clients (filtered) */}
          {filtered.length > 0 && (
            <>
              {query.trim().length >= 2 && (
                <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  {t.yourClients}
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
                        {t.visitsCount(c.total_visits, Number(c.total_spent).toFixed(0))}
                      </p>
                      <p style={{ ...TYPE.micro, marginTop: 2 }}>
                        {c.last_visit_at ? t.wasLast(daysAgo(c.last_visit_at, t.daysAgoLabels)) : t.neverCame}
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
                        {t.riskBadge}
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
              title={t.emptyTitle}
              desc={t.emptyDesc}
            />
          )}

          {/* Section: People in CRES-CA matching the query */}
          {query.trim().length >= 2 && systemFiltered.length > 0 && (
            <div style={{ marginTop: filtered.length > 0 ? 24 : 0 }}>
              <p style={{ ...TYPE.micro, color: T.textTertiary, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {t.inCresca}
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
                          {c.type === 'master' ? t.typeMaster : c.type === 'salon' ? t.typeSalon : t.typeClient}
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
                          : c.isLinked ? <><Check size={12} /> {t.inContacts}</>
                          : <><UserPlus size={12} /> {t.addBtn}</>}
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
              title={t.notFoundTitle}
              desc={t.notFoundDesc}
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
                  {t.manualLink}
                </button>
              ) : (
                <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: R.md, background: T.surfaceElevated, border: `1px solid ${T.borderSubtle}` }}>
                  <p style={{ ...TYPE.caption, color: T.textSecondary, margin: 0 }}>{t.manualHint}</p>
                  <input
                    placeholder={t.manualName}
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    placeholder={t.manualPhone}
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    inputMode="tel"
                    style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    placeholder={t.manualEmail}
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
                      {t.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={manualBusy || !manualName.trim()}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: R.pill, border: 'none', background: T.text, color: T.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: manualBusy || !manualName.trim() ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {manualBusy && <Loader2 size={14} className="animate-spin" />} {t.saveBtn}
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

function ClientStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: R.md,
      background: T.surface,
      border: `1px solid ${T.borderSubtle}`,
      boxShadow: SHADOW.card,
      textAlign: 'center',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <div style={{
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 11,
        color: T.textTertiary,
        marginTop: 3,
        fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  );
}

