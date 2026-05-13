/** --- YAML
 * name: MasterMiniAppPartnersList
 * description: Партнёры мастера в Mini App. Список активных + ожидающих +
 *              поиск других мастеров с кнопкой «Пригласить».
 * created: 2026-04-25
 * updated: 2026-05-13
 * --- */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Megaphone, Users, User as UserIcon, Handshake,
  Search, X, Check, UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { getInitData } from '@/lib/telegram/webapp';
import { T, R, TYPE, SHADOW, PAGE_PADDING_X, SPRING, FONT_BASE } from '@/components/miniapp/design';
import { MobilePage, PageHeader } from '@/components/miniapp/shells';
import { useMiniAppLocale, type MiniAppLang } from '@/lib/miniapp/use-locale';

const I18N: Record<MiniAppLang, {
  title: string;
  empty: string; emptyHint: string;
  active: string; pending: string;
  searchPlaceholder: string; searchHint: string;
  invite: string; inviting: string; invited: string;
  errInvite: string;
  noResults: string;
}> = {
  uk: {
    title: 'Партнерство',
    empty: 'Поки немає партнерств', emptyHint: 'Партнер — інший майстер для безкоштовної взаємної реклами. Знайдіть колег нижче.',
    active: 'Активні', pending: 'Очікують відповіді',
    searchPlaceholder: 'Ім\'я, спеціалізація або місто…', searchHint: 'Знайдіть майстра і відправте запрошення',
    invite: 'Запросити', inviting: 'Надсилаємо…', invited: 'Запит надіслано',
    errInvite: 'Не вдалося надіслати', noResults: 'Нікого не знайдено',
  },
  ru: {
    title: 'Партнёрство',
    empty: 'Пока нет партнёрств', emptyHint: 'Партнёр — другой мастер для бесплатной взаимной рекламы. Найдите коллег ниже.',
    active: 'Активные', pending: 'Ожидают ответа',
    searchPlaceholder: 'Имя, специализация или город…', searchHint: 'Найдите мастера и отправьте приглашение',
    invite: 'Пригласить', inviting: 'Отправляем…', invited: 'Запрос отправлен',
    errInvite: 'Не удалось отправить', noResults: 'Никого не найдено',
  },
  en: {
    title: 'Partnership',
    empty: 'No partnerships yet', emptyHint: 'A partner is another master for free mutual promotion. Find colleagues below.',
    active: 'Active', pending: 'Pending reply',
    searchPlaceholder: 'Name, specialty or city…', searchHint: 'Find a master and send an invite',
    invite: 'Invite', inviting: 'Sending…', invited: 'Request sent',
    errInvite: 'Failed to send', noResults: 'No results found',
  },
};

interface PartnershipItem {
  id: string;
  status: string;
  cross_promotion: boolean;
  youInitiated: boolean;
  partner: {
    id: string | null;
    specialization: string | null;
    is_team: boolean;
    full_name: string | null;
    avatar_url: string | null;
    slug: string | null;
  };
}

interface SearchResult {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  specialization: string | null;
  city: string | null;
}

export default function MasterMiniAppPartnersList() {
  const { userId } = useAuthStore();
  const { haptic } = useTelegram();
  const lang = useMiniAppLocale();
  const t = I18N[lang];

  const [items, setItems] = useState<PartnershipItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const initData = getInitData();
    if (!initData) { setLoading(false); return; }
    const res = await fetch('/api/telegram/m/partners/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setItems((json.partnerships ?? []) as PartnershipItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [userId, load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const initData = getInitData();
        const res = await fetch('/api/telegram/m/partners/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(initData ? { 'X-TG-Init-Data': initData } : {}),
          },
          body: JSON.stringify({ q }),
        });
        if (res.ok) {
          const json = await res.json() as { results: SearchResult[] };
          setSearchResults(json.results ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  async function sendInvite(masterId: string) {
    if (invitingId) return;
    haptic('light');
    setInvitingId(masterId);
    try {
      const initData = getInitData();
      const res = await fetch('/api/telegram/m/partners/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-TG-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ partner_id: masterId }),
      });
      if (res.ok) {
        haptic('light');
        setInvitedIds((prev) => new Set(prev).add(masterId));
      }
    } finally {
      setInvitingId(null);
    }
  }

  const active = items.filter((i) => i.status === 'active');
  const pending = items.filter((i) => i.status === 'pending');
  const showSearch = query.trim().length >= 2;

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: T.textTertiary }} />
      </div>
    );
  }

  return (
    <MobilePage>
      <PageHeader title={t.title} />

      <div style={{ padding: `0 ${PAGE_PADDING_X}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Строка поиска */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.bgSubtle, borderRadius: R.md,
          padding: '0 14px', border: `1px solid ${T.borderSubtle}`,
        }}>
          <Search size={16} color={T.textTertiary} style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, fontWeight: 400, color: T.text, caretColor: T.accent,
              padding: '12px 0', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSearchResults([]); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: T.textTertiary }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Подсказка под поиском когда пусто */}
        {!showSearch && (
          <p style={{ ...TYPE.caption, color: T.textTertiary, margin: '-8px 4px 0', lineHeight: 1.5 }}>
            {t.searchHint}
          </p>
        )}

        {/* Результаты поиска */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={SPRING.default}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {searching ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                  <Loader2 size={18} color={T.textTertiary} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : searchResults.length === 0 ? (
                <p style={{ ...TYPE.caption, color: T.textTertiary, padding: '8px 4px' }}>{t.noResults}</p>
              ) : (
                searchResults.map((r) => (
                  <SearchResultCard
                    key={r.id}
                    result={r}
                    invited={invitedIds.has(r.id)}
                    inviting={invitingId === r.id}
                    t={t}
                    onInvite={() => sendInvite(r.id)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Список партнёрств (скрыть пока идёт поиск) */}
        {!showSearch && (
          <>
            {items.length === 0 ? (
              <div style={{
                padding: 24, border: `1px dashed ${T.border}`, borderRadius: R.md,
                background: T.surface, textAlign: 'center',
              }}>
                <div style={{
                  width: 44, height: 44, margin: '0 auto', borderRadius: 12,
                  background: T.bgSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Handshake size={20} color={T.textTertiary} />
                </div>
                <p style={{ marginTop: 12, ...TYPE.bodyStrong, color: T.text }}>{t.empty}</p>
                <p style={{ marginTop: 4, ...TYPE.caption, color: T.textTertiary, lineHeight: 1.5 }}>{t.emptyHint}</p>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <Section title={`${t.active} (${active.length})`}>
                    {active.map((p) => <PartnerCard key={p.id} item={p} haptic={haptic} />)}
                  </Section>
                )}
                {pending.length > 0 && (
                  <Section title={`${t.pending} (${pending.length})`}>
                    {pending.map((p) => <PartnerCard key={p.id} item={p} haptic={haptic} dim />)}
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </MobilePage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...TYPE.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textTertiary, margin: '0 4px 8px' }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function PartnerCard({ item, haptic, dim }: { item: PartnershipItem; haptic: (k: 'light') => void; dim?: boolean }) {
  const name = item.partner.full_name || 'Партнёр';
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—';

  return (
    <Link
      href={`/telegram/m/partners/${item.id}`}
      onClick={() => haptic('light')}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: R.md,
        border: `1px solid ${T.borderSubtle}`, background: T.surface,
        boxShadow: SHADOW.card, opacity: dim ? 0.65 : 1, textDecoration: 'none',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, ...TYPE.bodyStrong, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            borderRadius: R.pill, background: T.bgSubtle,
            padding: '2px 6px', fontSize: 10, fontWeight: 500, color: T.textSecondary, flexShrink: 0,
          }}>
            {item.partner.is_team ? <Users size={9} /> : <UserIcon size={9} />}
            {item.partner.is_team ? 'Команда' : 'Соло'}
          </span>
        </div>
        <p style={{ margin: '2px 0 0', ...TYPE.caption, color: T.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.partner.specialization || (item.status === 'pending' ? 'Ждём подтверждения' : 'Мастер')}
        </p>
      </div>
      {item.status === 'active' && item.cross_promotion && (
        <Megaphone size={14} color="#16a34a" style={{ flexShrink: 0 }} />
      )}
    </Link>
  );
}

function SearchResultCard({
  result, invited, inviting, t, onInvite,
}: {
  result: SearchResult;
  invited: boolean;
  inviting: boolean;
  t: typeof I18N['ru'];
  onInvite: () => void;
}) {
  const name = result.full_name || result.slug || '—';
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '—';
  const sub = [result.specialization, result.city].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: R.md,
      border: `1px solid ${T.borderSubtle}`, background: T.surface,
      boxShadow: SHADOW.card,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: T.bgSubtle, color: T.textSecondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, ...TYPE.bodyStrong, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </p>
        {sub && (
          <p style={{ margin: '2px 0 0', ...TYPE.caption, color: T.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onInvite}
        disabled={invited || !!inviting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: R.pill,
          border: invited ? 'none' : `1px solid ${T.accent}`,
          background: invited ? T.bgSubtle : T.accentSoft,
          color: invited ? T.textTertiary : T.accent,
          fontSize: 12, fontWeight: 600, cursor: invited ? 'default' : 'pointer',
          fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
          opacity: inviting ? 0.6 : 1,
        }}
      >
        {inviting ? (
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        ) : invited ? (
          <Check size={12} />
        ) : (
          <UserPlus size={12} />
        )}
        {inviting ? t.inviting : invited ? t.invited : t.invite}
      </button>
    </div>
  );
}
