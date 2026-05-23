/** --- YAML
 * name: ClientMyMastersPage
 * description: Мої майстри — 3 вкладки (Усі / Постійні / Останні візити) у стилі
 *              web-client/my-masters мокапа: hero-метрики, картка з 56px аватаром,
 *              онлайн-точкою, рейтингом, 3-колоночним блоком статистики та діями.
 * created: 2026-04-12
 * updated: 2026-05-17
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Star, MapPin, User, CalendarPlus, Heart, Zap, Search, UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';

type MMLang = 'uk' | 'ru' | 'en';
const MM_LABELS: Record<MMLang, {
  title: string;
  inFavorites: (n: number) => string;
  withFreeToday: (n: number) => string;
  master: string;
  removeTitle: string; removeDescription: (name: string) => string;
  removeConfirm: string; removeFailed: string; removeOk: string;
  tabAll: string; tabRegular: string; tabRecent: string;
  removeAria: string;
  todayAt: (t: string) => string;
  statVisits: string; statFrom: string; statSlots: string; statHas: string;
  page: string; book: string;
  emptyTitle: string; emptyDesc: string; emptyCta: string;
}> = {
  uk: {
    title: 'Мої майстри',
    inFavorites: (n) => `${n} в обраних`,
    withFreeToday: (n) => `${n} з вільними слотами сьогодні`,
    master: 'Майстер',
    removeTitle: 'Видалити з обраних?',
    removeDescription: (name) => `${name} більше не буде у списку «Мої майстри».`,
    removeConfirm: 'Видалити', removeFailed: 'Не вдалось видалити', removeOk: 'Видалено з обраних',
    tabAll: 'Усі', tabRegular: 'Постійні', tabRecent: 'Останні візити',
    removeAria: 'Прибрати з обраних',
    todayAt: (t) => `Сьогодні запис о ${t}`,
    statVisits: 'Візитів', statFrom: 'Від', statSlots: 'Слотів', statHas: 'Є',
    page: 'Сторінка', book: 'Записатись',
    emptyTitle: 'Поки немає улюблених майстрів',
    emptyDesc: 'Додавай мастерів у обрані — будеш бачити їх найближчі вікна, акції та зможеш записуватись в один клік.',
    emptyCta: 'Знайти майстра',
  },
  ru: {
    title: 'Мои мастера',
    inFavorites: (n) => `${n} в избранных`,
    withFreeToday: (n) => `${n} со свободными слотами сегодня`,
    master: 'Мастер',
    removeTitle: 'Удалить из избранных?',
    removeDescription: (name) => `${name} больше не будет в списке «Мои мастера».`,
    removeConfirm: 'Удалить', removeFailed: 'Не удалось удалить', removeOk: 'Удалено из избранных',
    tabAll: 'Все', tabRegular: 'Постоянные', tabRecent: 'Последние визиты',
    removeAria: 'Убрать из избранных',
    todayAt: (t) => `Сегодня запись в ${t}`,
    statVisits: 'Визитов', statFrom: 'От', statSlots: 'Слотов', statHas: 'Есть',
    page: 'Страница', book: 'Записаться',
    emptyTitle: 'Пока нет любимых мастеров',
    emptyDesc: 'Добавляй мастеров в избранные — будешь видеть их ближайшие окна, акции и сможешь записываться в один клик.',
    emptyCta: 'Найти мастера',
  },
  en: {
    title: 'My masters',
    inFavorites: (n) => `${n} in favorites`,
    withFreeToday: (n) => `${n} with free slots today`,
    master: 'Master',
    removeTitle: 'Remove from favorites?',
    removeDescription: (name) => `${name} will no longer be in your "My masters" list.`,
    removeConfirm: 'Remove', removeFailed: 'Failed to remove', removeOk: 'Removed from favorites',
    tabAll: 'All', tabRegular: 'Regulars', tabRecent: 'Recent visits',
    removeAria: 'Remove from favorites',
    todayAt: (t) => `Today's appointment at ${t}`,
    statVisits: 'Visits', statFrom: 'From', statSlots: 'Slots', statHas: 'Yes',
    page: 'Page', book: 'Book',
    emptyTitle: 'No favorite masters yet',
    emptyDesc: 'Add masters to favorites — you will see their next openings, promotions and book in one click.',
    emptyCta: 'Find a master',
  },
};

type SalonEmbed =
  | { id: string; name: string; logo_url: string | null; city: string | null }
  | null;

interface MasterRow {
  id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  specialization: string | null;
  rating: number | null;
  reviewsCount: number;
  city: string | null;
  nextVisit: string | null;
  visitCount: number;
  minPrice: number | null;
  lastVisitAt: string | null;
}

type Tab = 'all' | 'regular' | 'recent';

export default function MyMastersPage() {
  const { userId } = useAuthStore();
  const confirm = useConfirm();
  const localeRaw = useLocale();
  const lang: MMLang = (['uk', 'ru', 'en'].includes(localeRaw) ? localeRaw : 'uk') as MMLang;
  const L = MM_LABELS[lang];
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [unsubscribing, setUnsubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: links } = await supabase
        .from('client_master_links')
        .select('master_id, masters:masters!client_master_links_master_id_fkey(id, slug, invite_code, specialization, rating, city, display_name, avatar_url, profiles:profiles!masters_profile_id_fkey(full_name, avatar_url), salon:salons(id, name, city))')
        .eq('profile_id', userId);

      if (cancelled) return;
      if (!links || links.length === 0) { setMasters([]); setLoading(false); return; }

      const masterIds = links.map((l) => l.master_id as string);

      // clients rows for this user mapped to master_id
      const { data: clientRows } = await supabase
        .from('clients').select('id, master_id')
        .eq('profile_id', userId).in('master_id', masterIds);
      const clientIds = (clientRows ?? []).map((c) => (c as { id: string }).id);
      const clientMasterMap = new Map<string, string>(
        (clientRows ?? []).map((c) => [(c as { id: string }).id, (c as { master_id: string }).master_id]),
      );

      const nextByMaster = new Map<string, string>();
      const visitsByMaster = new Map<string, number>();
      const lastVisitByMaster = new Map<string, string>();
      const minPriceByMaster = new Map<string, number>();

      // Min price per master = catalog minimum (same semantics as /search «Від ₴X»).
      // Раньше брали мин. цену из исторических записей — это сбивало клиента, потому что
      // в /search показывалось «від ₴250», а тут «від ₴800». Теперь синхронно по каталогу.
      const { data: servicesRows } = await supabase
        .from('services').select('master_id, price, is_active')
        .in('master_id', masterIds);
      (servicesRows ?? []).forEach((s) => {
        const r = s as { master_id: string; price: number | string | null; is_active?: boolean | null };
        if (r.is_active === false) return;
        if (r.price == null) return;
        const p = Number(r.price);
        if (!p || p <= 0) return;
        const cur = minPriceByMaster.get(r.master_id);
        if (cur == null || p < cur) minPriceByMaster.set(r.master_id, p);
      });

      if (clientIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { data: upcoming } = await supabase
          .from('appointments').select('client_id, master_id, starts_at')
          .in('client_id', clientIds).gte('starts_at', nowIso)
          .order('starts_at', { ascending: true });
        (upcoming ?? []).forEach((a) => {
          const r = a as { client_id: string; master_id: string | null; starts_at: string };
          const mId = r.master_id ?? clientMasterMap.get(r.client_id);
          if (mId && !nextByMaster.has(mId)) nextByMaster.set(mId, r.starts_at);
        });

        const { data: past } = await supabase
          .from('appointments').select('client_id, master_id, status, starts_at, price')
          .in('client_id', clientIds).lt('starts_at', nowIso);
        (past ?? []).forEach((a) => {
          const r = a as { client_id: string; master_id: string | null; status: string; starts_at: string; price: number | string | null };
          if (['cancelled', 'cancelled_by_client', 'cancelled_by_master', 'no_show'].includes(r.status)) return;
          const mId = r.master_id ?? clientMasterMap.get(r.client_id);
          if (!mId) return;
          visitsByMaster.set(mId, (visitsByMaster.get(mId) ?? 0) + 1);
          const prev = lastVisitByMaster.get(mId);
          if (!prev || r.starts_at > prev) lastVisitByMaster.set(mId, r.starts_at);
        });
      }

      // Reviews counts
      const { data: reviewsRows } = await supabase
        .from('reviews').select('target_id')
        .eq('target_type', 'master').in('target_id', masterIds);
      const reviewsByMaster = new Map<string, number>();
      (reviewsRows ?? []).forEach((r) => {
        const id = (r as { target_id: string }).target_id;
        reviewsByMaster.set(id, (reviewsByMaster.get(id) ?? 0) + 1);
      });

      const list: MasterRow[] = (links.map((row) => {
        const m = (row as { masters: unknown }).masters as {
          id?: string;
          slug?: string | null;
          invite_code?: string | null;
          specialization?: string | null;
          rating?: number | null;
          city?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
          salon?: SalonEmbed | SalonEmbed[];
        } | null;
        if (!m?.id) return null;
        const salonRaw = Array.isArray(m.salon) ? m.salon[0] : m.salon;
        return {
          id: m.id,
          slug: m.slug ?? m.invite_code ?? m.id ?? null,
          full_name: (m.display_name ?? m.profiles?.full_name ?? L.master).toString(),
          avatar_url: m.avatar_url ?? m.profiles?.avatar_url ?? null,
          specialization: m.specialization ?? null,
          rating: m.rating ?? null,
          reviewsCount: reviewsByMaster.get(m.id) ?? 0,
          city: salonRaw?.city ?? m.city ?? null,
          nextVisit: nextByMaster.get(m.id) ?? null,
          visitCount: visitsByMaster.get(m.id) ?? 0,
          minPrice: minPriceByMaster.get(m.id) ?? null,
          lastVisitAt: lastVisitByMaster.get(m.id) ?? null,
        } satisfies MasterRow;
      }) as Array<MasterRow | null>).filter((x): x is MasterRow => x !== null);

      setMasters(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleUnsubscribe = useCallback(async (master: MasterRow) => {
    const ok = await confirm({
      title: L.removeTitle,
      description: L.removeDescription(master.full_name),
      confirmLabel: L.removeConfirm,
      destructive: true,
    });
    if (!ok) return;
    setUnsubscribing(master.id);
    try {
      const res = await fetch('/api/follow/crm/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: master.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { following?: boolean };
      if (!res.ok || json.following !== false) {
        toast.error(L.removeFailed); return;
      }
      setMasters((prev) => prev.filter((m) => m.id !== master.id));
      toast.success(L.removeOk);
    } catch {
      toast.error(L.removeFailed);
    } finally { setUnsubscribing(null); }
  }, [confirm, L]);

  const counts = useMemo(() => {
    const regular = masters.filter((m) => m.visitCount >= 3);
    return { all: masters.length, regular: regular.length };
  }, [masters]);

  const displayed = useMemo(() => {
    if (tab === 'all') return masters;
    if (tab === 'regular') return masters.filter((m) => m.visitCount >= 3);
    return [...masters].sort((a, b) => {
      const at = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
      const bt = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
      return bt - at;
    });
  }, [tab, masters]);

  const todayFreeCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    return masters.filter((m) => {
      if (!m.nextVisit) return false;
      const v = new Date(m.nextVisit);
      return v >= today && v < tomorrow;
    }).length;
  }, [masters]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-60 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
          <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero */}
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight">{L.title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {L.inFavorites(masters.length)}
          {todayFreeCount > 0 ? ` · ${L.withFreeToday(todayFreeCount)}` : ''}
        </p>
      </header>

      {/* 3 tabs */}
      <div className="inline-flex rounded-full bg-muted p-1">
        {([
          ['all', L.tabAll, counts.all],
          ['regular', L.tabRegular, counts.regular],
          ['recent', L.tabRecent, null],
        ] as const).map(([k, label, count]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k as Tab)}
              className={cn(
                'flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition-colors',
                active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count != null && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  active ? 'bg-[#2563eb] text-white' : 'bg-muted-foreground/30 text-muted-foreground',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <EmptyState L={L} />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((m) => (
            <MasterCard
              key={m.id}
              m={m}
              busy={unsubscribing === m.id}
              onUnfollow={() => handleUnsubscribe(m)}
              L={L}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MasterCard({ m, busy, onUnfollow, L }: { m: MasterRow; busy: boolean; onUnfollow: () => void; L: typeof MM_LABELS[MMLang] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const next = m.nextVisit ? new Date(m.nextVisit) : null;
  const isOnlineToday = next && next >= today && next < tomorrow;
  const nextTime = next ? `${next.getHours().toString().padStart(2, '0')}:${next.getMinutes().toString().padStart(2, '0')}` : null;

  return (
    <div className={cn(
      'flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/40 hover:shadow-md',
      busy && 'opacity-60 pointer-events-none',
    )}>
      {/* Head */}
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          {m.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.avatar_url}
              alt={m.full_name}
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-[#2563eb]/12 text-[18px] font-extrabold text-[#2563eb]">
              {initials(m.full_name)}
            </div>
          )}
          {isOnlineToday && (
            <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-[2.5px] border-card bg-emerald-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-foreground">{m.full_name}</div>
          {m.specialization && (
            <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{m.specialization}</div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <strong className="text-foreground">{m.rating ? m.rating.toFixed(1) : '—'}</strong>
              {m.reviewsCount > 0 ? ` · ${m.reviewsCount}` : ''}
            </span>
            {m.city && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {m.city}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onUnfollow}
          aria-label={L.removeAria}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-red-400/50 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20"
        >
          <Heart className="size-4 fill-current" />
        </button>
      </div>

      {/* Free slot today */}
      {isOnlineToday && nextTime && (
        <div className="flex items-center gap-1.5 rounded-xl bg-[#2563eb]/12 px-3 py-2 text-[12px] font-semibold text-[#2563eb]">
          <Zap className="size-3.5" /> {L.todayAt(nextTime)}
        </div>
      )}

      {/* 3-col stats */}
      <div className="grid grid-cols-3 gap-2 border-y border-border py-3">
        <Stat n={m.visitCount.toString()} label={L.statVisits} />
        <Stat n={m.minPrice != null ? `₴${Math.round(m.minPrice)}` : '—'} label={L.statFrom} />
        <Stat n={isOnlineToday ? L.statHas : '—'} label={L.statSlots} />
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <Link
          href={`/m/${m.slug}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card py-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          <User className="size-3.5" /> {L.page}
        </Link>
        <Link
          href={`/book?master=${m.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#2563eb] py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
        >
          <CalendarPlus className="size-3.5" /> {L.book}
        </Link>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[15px] font-extrabold tabular-nums text-foreground">{n}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function EmptyState({ L }: { L: typeof MM_LABELS[MMLang] }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/50 p-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#2563eb]">
        <UserPlus className="size-7" />
      </div>
      <p className="mt-5 text-[16px] font-semibold">{L.emptyTitle}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
        {L.emptyDesc}
      </p>
      <Link
        href="/search"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
      >
        <Search className="size-4" /> {L.emptyCta}
      </Link>
    </div>
  );
}
