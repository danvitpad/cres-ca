/** --- YAML
 * name: ClientFeedPage
 * description: Утилитарная домашняя страница клиента — приветствие со статистикой
 *              (визиты / мастера / потрачено) с фильтром периода, следующая запись,
 *              свободные слоты у своих мастеров, повтор постоянной услуги, категории,
 *              рекомендуемые мастера. Визуал — web-client/home мокап (cobalt 2026-05-11).
 * created: 2026-04-14
 * updated: 2026-05-17
 * --- */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, CalendarPlus, ChevronLeft, ChevronRight, Clock, Coins, Droplets, Eye,
  Hand, Loader2, MapPin, MoreHorizontal, Repeat, Scissors, Search,
  Smile, Star, Zap, Heart, CalendarRange,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FeedSlot {
  id: string;
  master: {
    id: string;
    name: string | null;
    avatar: string | null;
    specialization: string | null;
    slug?: string | null;
  } | null;
  service: {
    id: string;
    name: string;
    price: number | null;
    duration_minutes: number | null;
  } | null;
  starts_at: string | null;
}

interface RegularItem {
  master_id: string;
  master_name: string;
  master_slug: string;
  service_id: string;
  service_name: string;
  service_duration: number | null;
  service_price: number | null;
  visit_count: number;
}

interface FeaturedMaster {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
  city: string | null;
  specialization: string | null;
  rating: number | null;
  reviewsCount: number;
  topServices: Array<{ name: string; price: number; currency: string }>;
}

interface NextAppointment {
  id: string;
  starts_at: string;
  service_name: string | null;
  duration_minutes: number | null;
  price: number | null;
  master_name: string;
  master_slug: string | null;
  address: string | null;
}

interface PeriodStats {
  visits: number;
  masters: number;
  spent: number;
}

type FilterMode = 'month' | 'half' | 'year' | 'pick-month' | 'pick-range';

const CATEGORIES = [
  { key: 'hair',    label: 'Волосся',  icon: Scissors },
  { key: 'nails',   label: 'Нігті',    icon: Hand },
  { key: 'face',    label: 'Обличчя',  icon: Smile },
  { key: 'massage', label: 'Масаж',    icon: Activity },
  { key: 'brows',   label: 'Брови',    icon: Eye },
  { key: 'laser',   label: 'Лазер',    icon: Zap },
  { key: 'skin',    label: 'Шкіра',    icon: Droplets },
  { key: 'all',     label: 'Усі',      icon: MoreHorizontal },
] as const;

const MONTH_NAMES_UK = [
  'Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер',
  'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру',
];

export default function ClientFeedPage() {
  const [firstName, setFirstName] = useState<string>('');
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [nextAppt, setNextAppt] = useState<NextAppointment | null>(null);
  const [slots, setSlots] = useState<FeedSlot[]>([]);
  const [regulars, setRegulars] = useState<RegularItem[]>([]);
  const [featured, setFeatured] = useState<FeaturedMaster[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Период статистики
  const [filter, setFilter] = useState<FilterMode>('month');
  const today = useMemo(() => new Date(), []);
  const [pickMonth, setPickMonth] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo, setRangeTo] = useState<Date | null>(null);

  const period = useMemo(() => {
    const now = new Date();
    if (filter === 'month') {
      const f = new Date(now); f.setMonth(now.getMonth() - 1);
      return { from: f, to: now };
    }
    if (filter === 'half') {
      const f = new Date(now); f.setMonth(now.getMonth() - 6);
      return { from: f, to: now };
    }
    if (filter === 'year') {
      const f = new Date(now); f.setFullYear(now.getFullYear() - 1);
      return { from: f, to: now };
    }
    if (filter === 'pick-month') {
      const f = new Date(pickMonth.year, pickMonth.month, 1, 0, 0, 0);
      const t = new Date(pickMonth.year, pickMonth.month + 1, 0, 23, 59, 59);
      return { from: f, to: t };
    }
    if (filter === 'pick-range' && rangeFrom && rangeTo) {
      const f = new Date(rangeFrom); f.setHours(0, 0, 0, 0);
      const t = new Date(rangeTo); t.setHours(23, 59, 59, 999);
      return { from: f, to: t };
    }
    // pick-range без обоих дат → fallback на месяц
    const f = new Date(now); f.setMonth(now.getMonth() - 1);
    return { from: f, to: now };
  }, [filter, pickMonth, rangeFrom, rangeTo]);

  // Загрузка профиля, имени, client_id
  useEffect(() => {
    try {
      const c = typeof window !== 'undefined' ? localStorage.getItem('cres-ca-city') : null;
      if (c) setCity(c);
    } catch {}

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          const p = profile as { first_name?: string | null; full_name?: string | null };
          setFirstName((p.first_name || p.full_name?.split(' ')[0] || '').trim());
        }

        const { data: clientRows } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', user.id);
        const ids = (clientRows ?? []).map((c) => (c as { id: string }).id);
        setClientIds(ids);

        // Следующая запись (всегда от now → future, не зависит от фильтра)
        if (ids.length > 0) {
          const nowIso = new Date().toISOString();
          const { data: apptRows } = await supabase
            .from('appointments')
            .select(`
              id, starts_at, ends_at, price,
              service:services(name, duration_minutes),
              master:masters(
                id, display_name, slug, invite_code,
                profile:profiles!masters_profile_id_fkey(full_name),
                salon:salons(name, address, city)
              )
            `)
            .in('client_id', ids)
            .gte('starts_at', nowIso)
            .in('status', ['confirmed', 'pending'])
            .order('starts_at', { ascending: true })
            .limit(1);
          const next = (apptRows ?? [])[0];
          if (next) {
            const svc = Array.isArray(next.service) ? next.service[0] : next.service;
            const mst = Array.isArray(next.master) ? next.master[0] : next.master;
            const mstProfile = mst ? (Array.isArray(mst.profile) ? mst.profile[0] : mst.profile) : null;
            const mstSalon = mst ? (Array.isArray(mst.salon) ? mst.salon[0] : mst.salon) : null;
            const dur = svc?.duration_minutes ?? null;
            const startMs = new Date(next.starts_at).getTime();
            const endMs = next.ends_at ? new Date(next.ends_at).getTime() : null;
            const computedDur = dur ?? (endMs ? Math.round((endMs - startMs) / 60000) : null);
            setNextAppt({
              id: next.id as string,
              starts_at: next.starts_at as string,
              service_name: svc?.name ?? null,
              duration_minutes: computedDur,
              price: next.price ? Number(next.price) : null,
              master_name: (mst?.display_name || mstProfile?.full_name || 'Майстер').toString(),
              master_slug: mst?.slug ?? mst?.invite_code ?? mst?.id ?? null,
              address: mstSalon?.address ?? mstSalon?.city ?? null,
            });
          }
        }
      } catch {}
    })();

    // Слоты
    (async () => {
      try {
        const r = await fetch('/api/feed');
        if (r.ok) {
          const d = await r.json();
          setSlots(((d.items ?? []) as FeedSlot[]).slice(0, 4));
        }
      } catch {} finally { setLoadingSlots(false); }
    })();

    // Постоянные услуги
    (async () => {
      try {
        const r = await fetch('/api/me/regular-services');
        if (r.ok) {
          const j = await r.json();
          setRegulars((Array.isArray(j.items) ? j.items : []).slice(0, 3));
        }
      } catch {}
    })();

    // Рекомендуемые мастера
    (async () => {
      try {
        const qs = new URLSearchParams();
        const c = typeof window !== 'undefined' ? localStorage.getItem('cres-ca-city') : null;
        if (c) qs.set('city', c);
        qs.set('limit', '4');
        const r = await fetch(`/api/marketplace/featured?${qs.toString()}`);
        if (r.ok) {
          const j = await r.json();
          setFeatured((Array.isArray(j.items) ? j.items : []).slice(0, 4));
        }
      } catch {}
    })();
  }, []);

  // Загрузка статистики при изменении периода
  useEffect(() => {
    if (clientIds.length === 0) {
      setStats({ visits: 0, masters: 0, spent: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('appointments')
          .select('master_id, price, status')
          .in('client_id', clientIds)
          .eq('status', 'completed')
          .gte('starts_at', period.from.toISOString())
          .lte('starts_at', period.to.toISOString());
        if (cancelled) return;
        const rows = (data ?? []) as Array<{ master_id: string | null; price: number | string | null }>;
        const visits = rows.length;
        const masters = new Set(rows.map((r) => r.master_id).filter(Boolean)).size;
        const spent = rows.reduce((s, r) => s + (r.price ? Number(r.price) : 0), 0);
        setStats({ visits, masters, spent });
      } catch {
        if (!cancelled) setStats({ visits: 0, masters: 0, spent: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [clientIds, period.from, period.to]);

  return (
    <div className="space-y-9">
      {/* 0. Greeting + period stats */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground mb-1">Привіт,</div>
          <div className="text-[28px] font-extrabold tracking-tight text-foreground">
            {firstName || 'друже'} 👋
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:items-end">
          <PeriodFilter
            filter={filter}
            setFilter={setFilter}
            pickMonth={pickMonth}
            setPickMonth={setPickMonth}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            setRangeFrom={setRangeFrom}
            setRangeTo={setRangeTo}
          />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard
              label="Візити"
              value={stats?.visits ?? 0}
              suffix=""
            />
            <StatCard
              label="Майстри"
              value={stats?.masters ?? 0}
              suffix=""
            />
            <StatCard
              label="Витрачено"
              value={stats?.spent ?? 0}
              suffix=" ₴"
              wide
            />
            {/*
            Бонусы — закомментировано по запросу 2026-05-17, оставляем код
            на случай возврата программы лояльности.
            <StatCard label="Бонуси" value={stats?.bonuses ?? 0} />
            */}
          </div>
        </div>
      </header>

      {/* 1. Hero — следующая запись */}
      {nextAppt ? (
        <Link
          href="/appointments"
          className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] p-7 text-white shadow-md transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] opacity-80">
              Наступний запис
            </div>
            <div className="mt-2 text-[24px] font-extrabold">
              {nextAppt.service_name ?? 'Запис'}
            </div>
            <div className="mt-1 text-[15px] opacity-90">
              у {nextAppt.master_name} · {formatWhen(nextAppt.starts_at)}
            </div>
            <div className="mt-3 flex flex-wrap gap-5 text-[13px] opacity-85">
              {nextAppt.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {nextAppt.address}
                </span>
              )}
              {nextAppt.duration_minutes && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {nextAppt.duration_minutes} хв
                </span>
              )}
              {nextAppt.price != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="size-3.5" /> ₴{Math.round(nextAppt.price)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 sm:shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#2563eb]">
              Деталі запису
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-white/40 bg-white/15 px-5 py-3 text-[14px] font-semibold text-white">
              <MapPin className="size-3.5" /> Маршрут
            </span>
          </div>
        </Link>
      ) : (
        <Link
          href="/search"
          className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] p-7 text-white shadow-md transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] opacity-80">
              Поки немає записів
            </div>
            <div className="mt-2 text-[24px] font-extrabold">Знайти майстра</div>
            <div className="mt-1 text-[15px] opacity-90">
              Підбери послугу, час та локацію — все в одному вікні.
            </div>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#2563eb] sm:self-auto">
            <Search className="size-4" /> До пошуку
          </span>
        </Link>
      )}

      {/* 2. Free slots */}
      <Section
        title="Вільні слоти у ваших майстрів"
        moreHref="/my-masters"
        moreLabel="Усі мої майстри"
      >
        {loadingSlots ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : slots.length === 0 ? (
          <EmptyHint
            text="Підпишись на майстрів — їх найближчі вікна з'являться тут."
            ctaLabel="Знайти майстрів"
            ctaHref="/search"
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {slots.map((s) => <FreeSlotCard key={s.id} slot={s} />)}
          </div>
        )}
      </Section>

      {/* 3. Your regulars */}
      {regulars.length > 0 && (
        <Section
          title="Ваші постійні"
          moreHref="/appointments?tab=past"
          moreLabel="Уся історія"
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {regulars.map((r) => (
              <Link
                key={`${r.master_id}-${r.service_id}`}
                href={`/book?master=${r.master_id}&service=${r.service_id}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/40 hover:shadow-md"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/12 text-[15px] font-bold text-[#2563eb]">
                  {initialsOf(r.master_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-foreground">
                    {r.service_name}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {r.master_name}
                  </div>
                  <div className="mt-1 flex gap-2 text-[11px] text-muted-foreground/80">
                    <span>{r.visit_count} раз{plural(r.visit_count)}</span>
                    {r.service_price != null && (
                      <>
                        <span>·</span>
                        <span>₴{Math.round(Number(r.service_price))}</span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/12 text-[#2563eb] transition-colors group-hover:bg-[#2563eb] group-hover:text-white"
                  aria-label="Повторити"
                >
                  <Repeat className="size-[18px]" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* 4. Categories */}
      <Section
        title="Знайти нового майстра"
        moreHref="/search"
        moreLabel="Усі категорії"
      >
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/search?cat=${key}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3.5 text-center transition-all hover:-translate-y-0.5 hover:border-[#2563eb]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#2563eb]/12 text-[#2563eb]">
                <Icon className="size-5" />
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* 5. Recommended */}
      {featured.length > 0 && (
        <Section
          title={city ? `Рекомендовані у ${city}` : 'Рекомендовані'}
          moreHref="/search"
          moreLabel="Усі майстри"
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {featured.map((m) => (
              <Link
                key={m.id}
                href={`/m/${m.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="relative h-[110px] bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] dark:from-[#1e3a8a] dark:to-[#1e40af]">
                  <span className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-white/90 text-muted-foreground backdrop-blur dark:bg-neutral-900/80">
                    <Heart className="size-4" />
                  </span>
                  <span className="absolute -bottom-7 left-3.5 flex size-[56px] items-center justify-center rounded-full border-[3px] border-card bg-white text-[16px] font-bold text-[#2563eb] shadow-sm dark:bg-neutral-800 dark:text-blue-300">
                    {initialsOf(m.fullName)}
                  </span>
                </div>
                <div className="px-3.5 pb-3.5 pt-9">
                  <div className="truncate text-[14px] font-semibold text-foreground">
                    {m.fullName}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {m.specialization || m.city || '—'}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                      <Star className="size-[11px] fill-amber-400 text-amber-400" />
                      {m.rating ? m.rating.toFixed(1) : '—'} · {m.reviewsCount}
                    </span>
                    {m.topServices[0]?.price && (
                      <span className="text-[12px] font-bold text-[#2563eb]">
                        від ₴{Math.round(m.topServices[0].price)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ─── PERIOD FILTER ─── */

function PeriodFilter({
  filter, setFilter, pickMonth, setPickMonth,
  rangeFrom, rangeTo, setRangeFrom, setRangeTo,
}: {
  filter: FilterMode;
  setFilter: (m: FilterMode) => void;
  pickMonth: { year: number; month: number };
  setPickMonth: (v: { year: number; month: number }) => void;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  setRangeFrom: (d: Date | null) => void;
  setRangeTo: (d: Date | null) => void;
}) {
  const monthLabel = `${MONTH_NAMES_UK[pickMonth.month]} ${pickMonth.year}`;
  const rangeLabel = rangeFrom && rangeTo
    ? `${formatShort(rangeFrom)} – ${formatShort(rangeTo)}`
    : 'Період';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip active={filter === 'month'} onClick={() => setFilter('month')}>Місяць</Chip>
      <Chip active={filter === 'half'} onClick={() => setFilter('half')}>Півроку</Chip>
      <Chip active={filter === 'year'} onClick={() => setFilter('year')}>Рік</Chip>

      <Popover>
        <PopoverTrigger
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors inline-flex items-center gap-1.5',
            filter === 'pick-month'
              ? 'border-[#2563eb] bg-[#2563eb] text-white'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <CalendarRange className="size-3.5" />
          {filter === 'pick-month' ? monthLabel : 'Місяць'}
          <ChevronRight className="size-3 rotate-90 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[260px] p-3">
          <MonthPicker
            value={pickMonth}
            onChange={(v) => { setPickMonth(v); setFilter('pick-month'); }}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors inline-flex items-center gap-1.5',
            filter === 'pick-range'
              ? 'border-[#2563eb] bg-[#2563eb] text-white'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <CalendarRange className="size-3.5" />
          {filter === 'pick-range' && rangeFrom && rangeTo ? rangeLabel : 'Період'}
          <ChevronRight className="size-3 rotate-90 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] p-3">
          <RangePicker
            from={rangeFrom}
            to={rangeTo}
            onChange={(f, t) => {
              setRangeFrom(f);
              setRangeTo(t);
              if (f && t) setFilter('pick-range');
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? 'border-[#2563eb] bg-[#2563eb] text-white'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function MonthPicker({
  value, onChange,
}: {
  value: { year: number; month: number };
  onChange: (v: { year: number; month: number }) => void;
}) {
  const [year, setYear] = useState(value.year);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setYear(year - 1)} className="rounded-md p-1 hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[14px] font-semibold">{year}</span>
        <button onClick={() => setYear(year + 1)} className="rounded-md p-1 hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_NAMES_UK.map((m, i) => {
          const isActive = value.year === year && value.month === i;
          return (
            <button
              key={i}
              onClick={() => onChange({ year, month: i })}
              className={cn(
                'rounded-lg py-2 text-[12px] font-medium transition-colors',
                isActive
                  ? 'bg-[#2563eb] text-white'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangePicker({
  from, to, onChange,
}: {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
}) {
  const initial = from ?? new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const offset = (first.getDay() + 6) % 7;
    const arr: (Date | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= last.getDate(); i++) arr.push(new Date(month.getFullYear(), month.getMonth(), i));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [month]);

  function clickDay(d: Date) {
    if (!from || (from && to)) {
      // Старт нового выбора
      onChange(d, null);
    } else {
      // Завершение выбора
      if (d.getTime() < from.getTime()) {
        onChange(d, from);
      } else {
        onChange(from, d);
      }
    }
  }

  function isInRange(d: Date) {
    if (!from || !to) return false;
    return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
  }
  function isBoundary(d: Date) {
    return (from && isSameDay(d, from)) || (to && isSameDay(d, to));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-md p-1 hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[14px] font-semibold">
          {MONTH_NAMES_UK[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-md p-1 hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const inRange = isInRange(d);
          const boundary = isBoundary(d);
          return (
            <button
              key={i}
              onClick={() => clickDay(d)}
              className={cn(
                'aspect-square rounded-md text-[12px] transition-colors',
                boundary
                  ? 'bg-[#2563eb] text-white font-semibold'
                  : inRange
                    ? 'bg-[#2563eb]/15 text-foreground'
                    : 'hover:bg-muted text-foreground',
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {from ? formatShort(from) : '—'} <ChevronRight className="inline size-3" /> {to ? formatShort(to) : '—'}
        </span>
        {(from || to) && (
          <button
            onClick={() => onChange(null, null)}
            className="font-medium text-[#2563eb] hover:underline"
          >
            Скинути
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── STAT CARD ─── */

function StatCard({ label, value, suffix, wide }: { label: string; value: number; suffix?: string; wide?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card px-3.5 py-3 text-right transition-colors hover:border-[#2563eb]/40',
        wide && 'col-span-1',
      )}
    >
      <div className="text-[20px] font-extrabold tabular-nums text-[#2563eb] sm:text-[22px]">
        {formatBigNumber(value)}{suffix}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 sm:text-[11px]">
        {label}
      </div>
    </div>
  );
}

/* ─── SECTION SHELL ─── */

function Section({
  title, moreHref, moreLabel, children,
}: {
  title: string;
  moreHref: string;
  moreLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-bold tracking-tight text-foreground">{title}</h2>
        <Link
          href={moreHref}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2563eb] hover:underline"
        >
          {moreLabel} <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function FreeSlotCard({ slot }: { slot: FeedSlot }) {
  const masterName = slot.master?.name ?? 'Майстер';
  const starts = slot.starts_at ? new Date(slot.starts_at) : null;
  const isToday = starts && isSameDay(starts, new Date());
  const isTomorrow = starts && isSameDay(starts, addDays(new Date(), 1));
  const timeLabel = starts
    ? isToday
      ? formatHHMM(starts)
      : isTomorrow
        ? `завтра ${formatHHMM(starts)}`
        : starts.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' ' + formatHHMM(starts)
    : '';
  const dateParam = starts ? starts.toISOString().slice(0, 10) : '';
  const timeParam = starts ? formatHHMM(starts) : '';
  const href = `/book?master=${slot.master?.id ?? ''}${slot.service?.id ? `&service=${slot.service.id}` : ''}${dateParam ? `&date=${dateParam}` : ''}${timeParam ? `&time=${encodeURIComponent(timeParam)}` : ''}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/40 hover:shadow-md"
    >
      <div className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/12 text-[14px] font-extrabold text-[#2563eb]">
        {initialsOf(masterName)}
        {isToday && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-[2.5px] border-card bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-foreground">{masterName}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {slot.service?.name ?? '—'}
          {slot.service?.duration_minutes ? ` · ${slot.service.duration_minutes} хв` : ''}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-[13px] font-bold tabular-nums ${isToday ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {timeLabel}
        </div>
        {slot.service?.price != null && (
          <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/80">
            ₴{Math.round(slot.service.price)}
          </div>
        )}
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2563eb] text-white transition-colors group-hover:bg-[#1d4ed8]">
        <CalendarPlus className="size-[15px]" />
      </span>
    </Link>
  );
}

function EmptyHint({ text, ctaLabel, ctaHref }: { text: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
      <p className="text-[13px] text-muted-foreground">{text}</p>
      <Link
        href={ctaHref}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]"
      >
        <Search className="size-3.5" /> {ctaLabel}
      </Link>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return '';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'и';
  return 'ів';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatHHMM(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatShort(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES_UK[d.getMonth()].toLowerCase()}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = isSameDay(d, today);
  const isTomorrow = isSameDay(d, addDays(today, 1));
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (isToday) return `сьогодні о ${time}`;
  if (isTomorrow) return `завтра о ${time}`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) + ` о ${time}`;
}

function formatBigNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString('uk-UA').replace(/\s/g, ' ');
}
