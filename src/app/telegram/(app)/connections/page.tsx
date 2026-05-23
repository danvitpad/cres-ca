/** --- YAML
 * name: MiniAppConnectionsPage
 * description: «Мої майстри» Mini App — визуал из mobile-client/my-masters мокапа.
 *              3 tab'а (Усі / Постійні / Останні), карточка мастера с аватаром,
 *              онлайн-точкой, рейтингом, дистанцией, ближайшим слотом, 3-col stats,
 *              кнопки Сторінка/Записатись + favorite-toggle.
 * created: 2026-04-24
 * updated: 2026-05-17
 * --- */

'use client';

import '@/styles/od-client-mini-app.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star, MapPin, Heart, Zap, User, CalendarPlus, Loader2, Search, Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';
import { MobilePage } from '@/components/miniapp/shells';
import { createClient } from '@/lib/supabase/client';
import { useMiniAppLocale } from '@/lib/miniapp/use-locale';
import { showConfirm } from '@/lib/telegram/webapp';

type Lang = 'uk' | 'ru' | 'en';
type Tab = 'all' | 'regular' | 'recent';

interface MasterItem {
  id: string;
  name: string;
  avatar: string | null;
  city: string | null;
  rating: number | null;
  reviewsCount: number;
  specialization: string | null;
  visitCount: number;
  minPrice: number | null;
  nextSlotIso: string | null;
  lastVisitAt: string | null;
}

function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as { Telegram?: { WebApp?: { initData?: string } } };
  const live = w.Telegram?.WebApp?.initData;
  if (live) return live;
  try {
    const stash = sessionStorage.getItem('cres:tg');
    if (stash) {
      const parsed = JSON.parse(stash) as { initData?: string };
      return parsed.initData ?? null;
    }
  } catch {}
  return null;
}
function authHeaders(): Record<string, string> {
  const initData = getInitData();
  return initData ? { 'x-tg-init-data': initData } : {};
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

const T_LABELS: Record<Lang, {
  title: string; subFav: (n: number) => string;
  tabAll: string; tabRegular: string; tabRecent: string;
  freeNearest: string; noSlot: string;
  stat_visits: string; stat_from: string; stat_nearest: string;
  page: string; book: string;
  emptyTitle: string; emptyDesc: string; findCta: string;
  confirmRemove: (n: string) => string;
}> = {
  uk: {
    title: 'Мої майстри', subFav: (n) => `${n} у обраних`,
    tabAll: 'Усі', tabRegular: 'Постійні', tabRecent: 'Останні',
    freeNearest: 'Найближче вільне:', noSlot: '—',
    stat_visits: 'Візитів', stat_from: 'Від', stat_nearest: 'Найближче',
    page: 'Сторінка', book: 'Записатись',
    emptyTitle: 'Поки немає улюблених майстрів',
    emptyDesc: 'Додавайте майстрів у обрані — швидкий доступ і нагадування про слоти.',
    findCta: 'Знайти майстра',
    confirmRemove: (n) => `Видалити ${n} з обраних?`,
  },
  ru: {
    title: 'Мои мастера', subFav: (n) => `${n} в избранных`,
    tabAll: 'Все', tabRegular: 'Постоянные', tabRecent: 'Последние',
    freeNearest: 'Ближайшее окно:', noSlot: '—',
    stat_visits: 'Визитов', stat_from: 'От', stat_nearest: 'Ближайшее',
    page: 'Страница', book: 'Записаться',
    emptyTitle: 'Пока нет любимых мастеров',
    emptyDesc: 'Добавляйте мастеров в избранные — быстрый доступ и напоминания о слотах.',
    findCta: 'Найти мастера',
    confirmRemove: (n) => `Удалить ${n} из избранных?`,
  },
  en: {
    title: 'My masters', subFav: (n) => `${n} in favorites`,
    tabAll: 'All', tabRegular: 'Regular', tabRecent: 'Recent',
    freeNearest: 'Next open:', noSlot: '—',
    stat_visits: 'Visits', stat_from: 'From', stat_nearest: 'Next',
    page: 'Page', book: 'Book',
    emptyTitle: 'No favorite masters yet',
    emptyDesc: 'Add masters to favorites for quick access and slot reminders.',
    findCta: 'Find a master',
    confirmRemove: (n) => `Remove ${n} from favorites?`,
  },
};

function formatNextSlot(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const targetMid = new Date(d); targetMid.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const locMap: Record<Lang, string> = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };
  const todayMap: Record<Lang, string> = { uk: 'сьогодні', ru: 'сегодня', en: 'today' };
  const tomorrowMap: Record<Lang, string> = { uk: 'завтра', ru: 'завтра', en: 'tomorrow' };
  if (targetMid.getTime() === today.getTime()) return `${todayMap[lang]} ${time}`;
  if (targetMid.getTime() === tomorrow.getTime()) return `${tomorrowMap[lang]} ${time}`;
  return `${d.toLocaleDateString(locMap[lang], { day: 'numeric', month: 'short' })} ${time}`;
}

export default function MiniAppConnectionsPage() {
  const router = useRouter();
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const lang = useMiniAppLocale();
  const t = T_LABELS[lang];

  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [removing, setRemoving] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Followed masters list
        const res = await fetch('/api/me/contacts', { headers: authHeaders() });
        if (!res.ok || cancelled) { setLoading(false); return; }
        const data = await res.json() as {
          masters: Array<{
            id: string;
            name: string | null;
            avatar: string | null;
            city: string | null;
            rating: number | null;
            specialization: string | null;
          }>;
        };
        const baseMasters = data.masters ?? [];
        const masterIds = baseMasters.map((m) => m.id);

        if (masterIds.length === 0) {
          if (!cancelled) { setMasters([]); setLoading(false); }
          return;
        }

        const supabase = createClient();

        // Parallel enrich: visit counts/last visit, next slot, min price, reviews count.
        const [clientsRes, reviewsRes, servicesRes, slotsRes] = await Promise.all([
          supabase
            .from('clients')
            .select('id, master_id')
            .eq('profile_id', userId)
            .in('master_id', masterIds),
          supabase
            .from('reviews')
            .select('target_id')
            .eq('target_type', 'master')
            .in('target_id', masterIds),
          supabase
            .from('services')
            .select('master_id, price')
            .in('master_id', masterIds)
            .eq('is_active', true),
          fetch(`/api/me/followed-slots?profileId=${userId}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        // Reviews count per master
        const reviewsByMaster = new Map<string, number>();
        ((reviewsRes.data ?? []) as Array<{ target_id: string }>).forEach((r) => {
          reviewsByMaster.set(r.target_id, (reviewsByMaster.get(r.target_id) ?? 0) + 1);
        });

        // Min price per master
        const minPriceByMaster = new Map<string, number>();
        ((servicesRes.data ?? []) as Array<{ master_id: string; price: number | string | null }>).forEach((s) => {
          if (s.price == null) return;
          const p = Number(s.price); if (!p) return;
          const cur = minPriceByMaster.get(s.master_id);
          if (cur == null || p < cur) minPriceByMaster.set(s.master_id, p);
        });

        // Visit counts + last visit per master
        const clientIds = (clientsRes.data ?? []).map((c) => (c as { id: string }).id);
        const clientToMaster = new Map<string, string>(
          (clientsRes.data ?? []).map((c) => [(c as { id: string }).id, (c as { master_id: string }).master_id]),
        );
        const visitsByMaster = new Map<string, number>();
        const lastVisitByMaster = new Map<string, string>();
        if (clientIds.length > 0) {
          const { data: apptRows } = await supabase
            .from('appointments')
            .select('client_id, master_id, status, starts_at')
            .in('client_id', clientIds)
            .lt('starts_at', new Date().toISOString());
          if (cancelled) return;
          ((apptRows ?? []) as Array<{ client_id: string; master_id: string | null; status: string; starts_at: string }>).forEach((a) => {
            if (['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(a.status)) return;
            const mId = a.master_id ?? clientToMaster.get(a.client_id);
            if (!mId) return;
            visitsByMaster.set(mId, (visitsByMaster.get(mId) ?? 0) + 1);
            const prev = lastVisitByMaster.get(mId);
            if (!prev || a.starts_at > prev) lastVisitByMaster.set(mId, a.starts_at);
          });
        }

        // Next slot per master
        const nextSlotByMaster = new Map<string, string>();
        if (slotsRes?.items) {
          for (const s of slotsRes.items as Array<{ masterId: string; iso: string }>) {
            if (!nextSlotByMaster.has(s.masterId)) {
              nextSlotByMaster.set(s.masterId, s.iso);
            }
          }
        }

        const enriched: MasterItem[] = baseMasters.map((m) => ({
          id: m.id,
          name: m.name ?? '—',
          avatar: m.avatar,
          city: m.city,
          rating: m.rating,
          reviewsCount: reviewsByMaster.get(m.id) ?? 0,
          specialization: m.specialization,
          visitCount: visitsByMaster.get(m.id) ?? 0,
          minPrice: minPriceByMaster.get(m.id) ?? null,
          nextSlotIso: nextSlotByMaster.get(m.id) ?? null,
          lastVisitAt: lastVisitByMaster.get(m.id) ?? null,
        }));

        if (!cancelled) setMasters(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const unfollow = useCallback(async (id: string, name: string) => {
    if (removing) return;
    // showConfirm = TG-нативный диалог (попап в стиле Telegram). window.confirm
    // на iOS Mini App может не появиться вовсе. Если TG-провайдера нет
    // (открыли в браузере) — fallback на window.confirm.
    const ok = await showConfirm(t.confirmRemove(name));
    if (!ok) return;
    setRemoving(id);
    haptic('warning');
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ masterId: id }),
      });
      if (res.ok) {
        // Локально убираем карточку для мгновенного UX...
        setMasters((prev) => prev.filter((m) => m.id !== id));
        // ...и сразу же перечитываем с сервера — защита от случая когда unfollow
        // прошёл, но локальный filter не сработал (например id-несовпадение).
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setRemoving(null);
    }
  }, [removing, t, haptic]);

  const counts = useMemo(() => ({
    all: masters.length,
    regular: masters.filter((m) => m.visitCount >= 3).length,
  }), [masters]);

  const displayed = useMemo(() => {
    if (tab === 'all') return masters;
    if (tab === 'regular') return masters.filter((m) => m.visitCount >= 3);
    return [...masters].sort((a, b) => {
      const at = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
      const bt = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
      return bt - at;
    });
  }, [tab, masters]);

  return (
    <MobilePage className="od-client-mini-app">
      {/* Top bar */}
      <div className="mc-top">
        <div>
          <div className="mc-top-title">{t.title}</div>
          <div className="mc-top-sub" style={{ marginTop: 0 }}>{t.subFav(masters.length)}</div>
        </div>
      </div>

      {/* Segment tabs */}
      <div className="mc-seg">
        {([
          ['all', t.tabAll, counts.all],
          ['regular', t.tabRegular, counts.regular],
          ['recent', t.tabRecent, null],
        ] as const).map(([k, label, count]) => (
          <button
            key={k}
            className={`mc-seg-b ${tab === k ? 'active' : ''}`}
            onClick={() => { setTab(k as Tab); haptic('selection'); }}
          >
            {label}
            {count != null && <span className="c">{count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mc-loading"><Loader2 size={24} className="animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <div className="mc-empty">
          <Users size={36} strokeWidth={1.5} />
          <p className="mc-empty-t">{t.emptyTitle}</p>
          <span className="mc-empty-s">{t.emptyDesc}</span>
          <Link
            href="/telegram/search"
            onClick={() => haptic('light')}
            className="mc-result-cta"
            style={{ marginTop: 16, padding: '8px 16px' }}
          >
            <Search size={12} /> {t.findCta}
          </Link>
        </div>
      ) : (
        <div className="mc-mml">
          {displayed.map((m) => (
            <MasterCard
              key={m.id}
              m={m}
              t={t}
              lang={lang}
              busy={removing === m.id}
              onUnfollow={() => unfollow(m.id, m.name)}
              onOpen={() => { haptic('light'); router.push(`/telegram/search/${m.id}`); }}
              onBook={() => { haptic('light'); router.push(`/telegram/book?master_id=${m.id}`); }}
            />
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </MobilePage>
  );
}

function MasterCard({
  m, t, lang, busy, onUnfollow, onOpen, onBook,
}: {
  m: MasterItem;
  t: typeof T_LABELS[Lang];
  lang: Lang;
  busy: boolean;
  onUnfollow: () => void;
  onOpen: () => void;
  onBook: () => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const next = m.nextSlotIso ? new Date(m.nextSlotIso) : null;
  const isOnlineToday = next && next >= today && next < tomorrow;

  return (
    <div className={`mc-mm ${busy ? 'is-busy' : ''}`}>
      <div className="mc-mm-h">
        <div className={`mc-mm-av ${isOnlineToday ? 'online' : ''}`}>
          {m.avatar
            ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initialsOf(m.name)}
        </div>
        <div className="mc-mm-i">
          <div className="mc-mm-n">{m.name}</div>
          {m.specialization && (
            <div className="mc-mm-s">{m.specialization}</div>
          )}
          <div className="mc-mm-m">
            <span>
              <Star className="star" size={10} />
              <b style={{ color: 'var(--fg)' }}>{m.rating ? m.rating.toFixed(1) : '—'}</b>
              {m.reviewsCount > 0 ? ` · ${m.reviewsCount}` : ''}
            </span>
            {m.city && (
              <span>
                <MapPin size={10} /> {m.city}
              </span>
            )}
          </div>
        </div>
        <button
          className="mc-mm-fav"
          onClick={onUnfollow}
          disabled={busy}
          aria-label="Unfollow"
        >
          <Heart size={14} />
        </button>
      </div>

      {/* Nearest slot row */}
      {m.nextSlotIso && (
        <div className="mc-mm-next">
          <Zap size={12} /> {t.freeNearest} <b>{formatNextSlot(m.nextSlotIso, lang)}</b>
        </div>
      )}

      {/* 2-col stats. По запросу 2026-05-19 убран средний столбец «от ₴X» —
          не имеет смысла на preview (цена видна на странице мастера). */}
      <div className="mc-mm-stats mc-mm-stats-2">
        <div>
          <div className="mc-mm-sn">{m.visitCount}</div>
          <div className="mc-mm-sl">{t.stat_visits}</div>
        </div>
        <div>
          <div className="mc-mm-sn">
            {m.nextSlotIso
              ? <span className="mc-free-on">{formatNextSlot(m.nextSlotIso, lang)}</span>
              : <span className="mc-free-off">{t.noSlot}</span>}
          </div>
          <div className="mc-mm-sl">{t.stat_nearest}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mc-mm-acts">
        <button className="mc-mma" onClick={onOpen}>
          <User size={12} /> {t.page}
        </button>
        <button className="mc-mma primary" onClick={onBook}>
          <CalendarPlus size={12} /> {t.book}
        </button>
      </div>
    </div>
  );
}
