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
import { Search, AlertTriangle, Star, Crown, Loader2, UserPlus, Check, SlidersHorizontal, X, Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage, AvatarCircle, EmptyState } from '@/components/miniapp/shells';
import { T, R, TYPE, PAGE_PADDING_X } from '@/components/miniapp/design';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';
import { getCached, setCached } from '@/lib/miniapp/cache';
import '@/styles/od-master-clients.css';

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
  filterAll: string; filterVip: string; filterNew: string; filterSleeping: string; filterPending: string;
  pendingTitle: string; pendingDesc: string; followBack: string; dismissAria: string;
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
    yourClients: 'Ваші клієнти', inCresca: 'У CRES-CA',
    notFoundTitle: 'Нічого не знайшли',
    notFoundDesc: 'Спробуйте інший запит або запишите вручну нижче',
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
    filterAll: 'Всі', filterVip: 'VIP', filterNew: 'Нові', filterSleeping: 'Сплячі', filterPending: 'Нові підписники',
    pendingTitle: 'Нові підписники', pendingDesc: 'Підписалися на вас',
    followBack: 'Підписатися у відповідь', dismissAria: 'Сховати',
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
    notFoundDesc: 'Попробуйте другой запрос или запишите вручную ниже',
    emptyTitle: 'Клиентов пока нет',
    emptyDesc: 'Начните искать в строке выше — найдём людей в CRES-CA',
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
    filterAll: 'Все', filterVip: 'VIP', filterNew: 'Новые', filterSleeping: 'Спящие', filterPending: 'Новые подписчики',
    pendingTitle: 'Новые подписчики', pendingDesc: 'Подписались на вас',
    followBack: 'Подписаться в ответ', dismissAria: 'Скрыть',
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
    filterAll: 'All', filterVip: 'VIP', filterNew: 'New', filterSleeping: 'Sleeping', filterPending: 'New subscribers',
    pendingTitle: 'New subscribers', pendingDesc: 'Followed you',
    followBack: 'Follow back', dismissAria: 'Hide',
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
  const [filter, setFilter] = useState<'all' | 'vip' | 'new' | 'sleeping' | 'pending'>('all');
  interface PendingClient { profileId: string; name: string; avatar: string | null; phone: string | null; }
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [busyPending, setBusyPending] = useState<string | null>(null);
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
        const headers: HeadersInit = {};
        if (initData) headers['X-TG-Init-Data'] = initData;
        const [listRes, pendingRes] = await Promise.all([
          fetch('/api/telegram/m/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: initData ?? null }),
          }),
          fetch('/api/master/pending-clients', { headers }),
        ]);
        if (!listRes.ok) {
          setLoading(false);
          return;
        }
        const json = await listRes.json();
        const fresh: CachedList = {
          masterId: json.masterId ?? null,
          rows: (json.clients ?? []) as ClientRow[],
        };
        setMasterId(fresh.masterId);
        setRows(fresh.rows);
        setCached<CachedList>(cacheKey, fresh);
        if (pendingRes.ok) {
          const pj = await pendingRes.json() as { clients: PendingClient[] };
          setPendingClients(pj.clients ?? []);
        }
      } catch { /* network error */ }
      setLoading(false);
    })();
  }, [userId, reloadKey, cacheKey]);

  async function followBackClient(profileId: string) {
    if (busyPending) return;
    setBusyPending(profileId);
    haptic('selection');
    try {
      const res = await fetch('/api/follow/crm/back', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientProfileId: profileId }),
      });
      if (res.ok) {
        setPendingClients((prev) => prev.filter((c) => c.profileId !== profileId));
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusyPending(null);
    }
  }

  async function dismissPendingClient(profileId: string) {
    if (busyPending) return;
    setBusyPending(profileId);
    haptic('light');
    try {
      const res = await fetch('/api/follow/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: 'master', clientProfileId: profileId }),
      });
      if (res.ok) setPendingClients((prev) => prev.filter((c) => c.profileId !== profileId));
    } finally {
      setBusyPending(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      // Search by name/phone tokens
      if (tokens.length) {
        const hay = `${r.full_name.toLowerCase()} ${(r.phone ?? '').toLowerCase()}`;
        if (!tokens.every((tok) => hay.includes(tok))) return false;
      }
      // Filter chip (Open Design master-clients): all / vip / new / sleeping
      if (filter === 'vip') return r.total_visits >= 10;
      if (filter === 'new') return r.total_visits <= 1;
      if (filter === 'sleeping') {
        if (!r.last_visit_at) return r.total_visits === 0;
        return now - new Date(r.last_visit_at).getTime() >= NINETY_DAYS;
      }
      return true;
    });
  }, [rows, query, filter]);

  // Stats: VIP = ≥10 visits, Спящий = не было ≥90 дней (или never), Новый = ≤1 визита.
  // Цифры подставляются прямо в чипы-фильтры (Все 1 · VIP 0 · Новые 0 · Спящие 0).
  const stats = useMemo(() => {
    let vip = 0, sleeping = 0, fresh = 0;
    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    for (const r of rows) {
      if (r.total_visits >= 10) vip++;
      if (r.total_visits <= 1) fresh++;
      if (r.last_visit_at) {
        const last = new Date(r.last_visit_at).getTime();
        if (now - last >= NINETY_DAYS) sleeping++;
      } else if (r.total_visits === 0) {
        sleeping++;
      }
    }
    return { total: rows.length, vip, sleeping, fresh };
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
    <MobilePage className="od-master-clients">
      {/* Литерально .ip-hd / .ip-hd-title / .ip-hd-actions / .ip-icon-btn
          из OD master-clients.html. Кнопка sliders-horizontal — фильтр,
          пока заглушка (toast). */}
      <header className="ip-hd">
        <div className="ip-hd-title">{t.pageTitle}</div>
        <div className="ip-hd-actions">
          <button
            type="button"
            className="ip-icon-btn"
            aria-label="Фильтр"
            onClick={() => haptic('selection')}
          >
            <SlidersHorizontal size={17} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Литерально .ip-search из OD. */}
      <div className="ip-search">
        <Search size={15} strokeWidth={2} className="ip-search-ico" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPh}
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

      {/* Чипы-фильтры с inline-счётчиками. Раньше отдельный блок
          «Всего / VIP / Спящие» давал двойной просмотр тех же цифр —
          убрали по запросу Данила 2026-05-13, цифры теперь в чипах. */}
      {(rows.length > 0 || pendingClients.length > 0) && !loading && (
        <div className="ip-chips">
          {([
            ['all', t.filterAll, stats.total],
            ['vip', t.filterVip, stats.vip],
            ['new', t.filterNew, stats.fresh],
            ['sleeping', t.filterSleeping, stats.sleeping],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`chip${filter === key ? ' on' : ''}`}
              onClick={() => { haptic('selection'); setFilter(key); }}
            >
              {label} {count}
            </button>
          ))}
          {pendingClients.length > 0 && (
            <button
              type="button"
              className={`chip${filter === 'pending' ? ' on' : ''}`}
              onClick={() => { haptic('selection'); setFilter('pending'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Bell size={12} />
              {t.filterPending} {pendingClients.length}
            </button>
          )}
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
        ) : filter === 'pending' ? (
          <>
            {pendingClients.length === 0 ? (
              <EmptyState
                icon={<span style={{ fontSize: 48 }}>🔔</span>}
                title={t.pendingTitle}
              />
            ) : (
              <div className="client-list">
                {pendingClients.map((p, i) => {
                  const AV_COLORS = ['c-av-blue', 'c-av-green', 'c-av-amber', 'c-av-purple', 'c-av-red'] as const;
                  const avClass = AV_COLORS[i % AV_COLORS.length];
                  const initial = (initials(p.name) || '—').slice(0, 2).toUpperCase();
                  const busy = busyPending === p.profileId;
                  return (
                    <div key={p.profileId} className="client-row" style={{ alignItems: 'center' }}>
                      <div className={`c-av ${avClass}`}>
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : initial}
                      </div>
                      <div className="c-body">
                        <p className="c-name">{p.name}</p>
                        <p className="c-sub">{t.pendingDesc}{p.phone ? ` · ${p.phone}` : ''}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => followBackClient(p.profileId)}
                          disabled={busy}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'var(--m-accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 999,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: busy ? 'default' : 'pointer',
                            opacity: busy ? 0.5 : 1,
                            fontFamily: 'inherit',
                          }}
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          {t.followBack}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissPendingClient(p.profileId)}
                          disabled={busy}
                          aria-label={t.dismissAria}
                          style={{
                            width: 32,
                            height: 32,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 16,
                            color: T.textTertiary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: busy ? 'default' : 'pointer',
                            opacity: busy ? 0.5 : 1,
                            fontFamily: 'inherit',
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
              {/* Литерально .client-list / .client-row / .c-av / .c-body /
                  .c-name / .c-sub / .c-right из OD master-clients.html. */}
              <div className="client-list">
                {filtered.map((c, i) => {
              const isVIP = c.total_visits >= 10;
              const isExcellent = (c.behavior_indicators ?? []).includes('excellent');
              const isRisky = (c.behavior_indicators ?? []).some(
                (b) => b === 'frequent_canceller' || b === 'rude' || b === 'often_late',
              );
              // Avatar color — крутим по 5 OD-цветам c-av-blue/green/amber/purple/red
              const AV_COLORS = ['c-av-blue', 'c-av-green', 'c-av-amber', 'c-av-purple', 'c-av-red'] as const;
              const avClass = AV_COLORS[i % AV_COLORS.length];
              const initial = (initials(c.full_name) || '—').slice(0, 2).toUpperCase();
              return (
                <Link
                  key={c.id}
                  href={`/telegram/m/clients/${c.id}`}
                  className="client-row"
                  onClick={() => haptic('light')}
                >
                  <div className={`c-av ${avClass}`} style={{ position: 'relative' }}>
                    {initial}
                    {c.has_health_alert && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: -2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'var(--m-danger, #ef4444)',
                          border: `2px solid var(--m-surface)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AlertTriangle size={10} color="#fff" />
                      </span>
                    )}
                  </div>
                  {/* Литерально .c-body / .c-name / .c-sub */}
                  <div className="c-body">
                    <p className="c-name">
                      {c.full_name}
                      {isVIP && <Crown size={13} color="#f59e0b" fill="#f59e0b" style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                      {isExcellent && <Star size={13} color="#f59e0b" fill="#f59e0b" style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                    </p>
                    <p className="c-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {t.visitsCount(c.total_visits, Number(c.total_spent).toFixed(0))}
                      {' · '}
                      {c.last_visit_at ? t.wasLast(daysAgo(c.last_visit_at, t.daysAgoLabels)) : t.neverCame}
                    </p>
                  </div>
                  {/* Литерально .c-right с .badge.badge-{gold|green|grey|red|blue} */}
                  <div className="c-right">
                    {isVIP ? (
                      <span className="badge badge-gold">VIP</span>
                    ) : c.total_visits <= 1 ? (
                      <span className="badge badge-green">{t.filterNew}</span>
                    ) : isRisky ? (
                      <span className="badge badge-red">{t.riskBadge}</span>
                    ) : (
                      <span className="badge badge-grey">{lang === 'uk' ? 'Регуляр' : lang === 'en' ? 'Regular' : 'Регуляр'}</span>
                    )}
                    {c.total_spent > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--m-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        ₴ {Number(c.total_spent).toFixed(0)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
              </div>
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

      {/* Литерально .fab из OD master-clients.html. Стили в
          /styles/od-master-clients.css (адаптирован под наш floating
          bottom-nav: bottom 88px + safe-area). */}
      {ready && masterId && (
        <button
          type="button"
          className="fab"
          onClick={() => { haptic('selection'); setShowManual(true); setQuery(''); }}
          aria-label={t.manualHint}
        >
          <UserPlus size={22} strokeWidth={2} />
        </button>
      )}
    </MobilePage>
  );
}

