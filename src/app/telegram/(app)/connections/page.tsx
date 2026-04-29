/** --- YAML
 * name: MiniAppContactsPage
 * description: Mini App "Контакты" — заменяет Fresha "Избранное". 3 таба: Мои мастера (client_master_links),
 *              Мои салоны (follows → salons.owner_id), Друзья (mutual follows других клиентов).
 * created: 2026-04-24
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Building2, Users, Star, MapPin, ChevronRight, Loader2, Search as SearchIcon, Clock, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTelegram } from '@/components/miniapp/telegram-provider';

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
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const initData = getInitData();
  return initData ? { 'x-tg-init-data': initData } : {};
}

type Tab = 'masters' | 'salons' | 'friends';

interface MasterItem {
  id: string;
  name: string | null;
  avatar: string | null;
  city: string | null;
  rating: number | null;
  specialization: string | null;
  salonName: string | null;
}

interface SalonItem {
  id: string;
  name: string;
  logo: string | null;
  city: string | null;
  rating: number | null;
}

interface FriendItem {
  id: string;
  name: string | null;
  avatar: string | null;
  publicId: string | null;
  slug: string | null;
}

interface NextSlot {
  masterId: string;
  name: string | null;
  avatar: string | null;
  date: string;
  time: string;
  iso: string;
}

export default function MiniAppContactsPage() {
  const { haptic } = useTelegram();
  const { userId } = useAuthStore();
  const [tab, setTab] = useState<Tab>('masters');
  const [loading, setLoading] = useState(true);

  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [salons, setSalons] = useState<SalonItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [nextSlots, setNextSlots] = useState<NextSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/me/contacts', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json() as {
            masters: MasterItem[];
            salons: SalonItem[];
            friends: FriendItem[];
          };
          setMasters(data.masters ?? []);
          setSalons(data.salons ?? []);
          setFriends(data.friends ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Load nearest slots in parallel (independent of the three main lists)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch(`/api/me/followed-slots?profileId=${userId}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setNextSlots((data.items ?? []).slice(0, 5));
        }
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [userId]);

  const counts = {
    masters: masters.length,
    salons: salons.length,
    friends: friends.length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-5 pt-6 pb-6"
    >
      <h1 className="text-[24px] font-bold leading-tight">Контакты</h1>
      <p className="mt-1 text-[13px] text-neutral-500">Твои мастера, салоны и друзья</p>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-neutral-200 bg-white border-neutral-200 p-1">
        <TabBtn active={tab === 'masters'} onClick={() => { setTab('masters'); haptic('light'); }} icon={User} label="Мастера" count={counts.masters} />
        <TabBtn active={tab === 'salons'} onClick={() => { setTab('salons'); haptic('light'); }} icon={Building2} label="Салоны" count={counts.salons} />
        <TabBtn active={tab === 'friends'} onClick={() => { setTab('friends'); haptic('light'); }} icon={Users} label="Друзья" count={counts.friends} />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : tab === 'masters' ? (
          masters.length === 0 ? (
            <EmptyState
              icon={User}
              title="Ты пока не подписан на мастеров"
              desc="Найди мастера и подпишись, чтобы видеть их обновления и быстро записываться."
              ctaLabel="Найти мастера"
              ctaHref="/telegram/search"
            />
          ) : (
            <>
              {/* Nearest free slots among followed masters */}
              {!slotsLoading && nextSlots.length > 0 && (
                <div className="mb-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-3">
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <Sparkles className="size-3.5 text-violet-600" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700/80">
                      Ближайшие окна
                    </p>
                  </div>
                  <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
                    {nextSlots.map((s) => (
                      <Link
                        key={s.masterId + s.iso}
                        href={`/telegram/book?master_id=${s.masterId}&date=${s.date}&time=${encodeURIComponent(s.time)}`}
                        onClick={() => haptic('light')}
                        className="flex min-w-[140px] snap-start flex-col items-start gap-1.5 rounded-xl border border-neutral-200 bg-white/[0.05] px-3 py-2.5 active:bg-neutral-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar src={s.avatar} name={s.name} />
                          <p className="truncate text-[12px] font-semibold">{s.name ?? 'Мастер'}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-700">
                          <Clock className="size-3" />
                          {formatSlotDate(s.date, s.time)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <ul className="space-y-2">
              {masters.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/telegram/m/${m.id}`}
                    onClick={() => haptic('light')}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white border-neutral-200 px-3 py-3 active:bg-neutral-50 transition-colors"
                  >
                    <Avatar src={m.avatar} name={m.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{m.name ?? 'Мастер'}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        {m.specialization && <span className="truncate">{m.specialization}</span>}
                        {m.salonName && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <Building2 className="size-3" />
                            {m.salonName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        {m.rating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="size-3 fill-amber-400 stroke-amber-400" />
                            <span className="text-neutral-700">{m.rating.toFixed(1)}</span>
                          </span>
                        )}
                        {m.city && (
                          <span className="inline-flex items-center gap-0.5 text-neutral-500">
                            <MapPin className="size-3" />
                            {m.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                </li>
              ))}
              </ul>
            </>
          )
        ) : tab === 'salons' ? (
          salons.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Ты пока не подписан на салоны"
              desc="Следи за обновлениями любимых салонов — новые мастера, акции, окна в расписании."
              ctaLabel="Найти салон"
              ctaHref="/telegram/search"
            />
          ) : (
            <ul className="space-y-2">
              {salons.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/telegram/salon/${s.id}`}
                    onClick={() => haptic('light')}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white border-neutral-200 px-3 py-3 active:bg-neutral-50 transition-colors"
                  >
                    <Avatar src={s.logo} name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{s.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        {s.city && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" />
                            {s.city}
                          </span>
                        )}
                        {s.rating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="size-3 fill-amber-400 stroke-amber-400" />
                            <span className="text-neutral-700">{s.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : (
          // friends
          friends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="У тебя пока нет друзей"
              desc="Подпишись на других клиентов — и если они подпишутся в ответ, вы окажетесь в списке друзей."
              ctaLabel="Поиск"
              ctaHref="/telegram/search"
            />
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li key={f.id}>
                  <Link
                    href={f.publicId ? `/telegram/u/${f.publicId}` : '#'}
                    onClick={() => haptic('light')}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white border-neutral-200 px-3 py-3 active:bg-neutral-50 transition-colors"
                  >
                    <Avatar src={f.avatar} name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{f.name ?? 'Пользователь'}</p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {f.slug ? `@${f.slug}` : f.publicId ?? ''}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </motion.div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-colors ${
        active ? 'bg-white/10 text-neutral-900' : 'text-neutral-500 active:bg-white border-neutral-200'
      }`}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      <span className={`text-[10px] ${active ? 'text-neutral-700' : 'text-neutral-400'}`}>{count}</span>
    </button>
  );
}

function formatSlotDate(dateStr: string, time: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.getTime() === today.getTime()) return `Сегодня ${time}`;
  if (d.getTime() === tomorrow.getTime()) return `Завтра ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`;
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-900">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        (name?.[0] ?? '?').toUpperCase()
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-neutral-200 bg-white border-neutral-200 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-neutral-200 bg-white border-neutral-200">
        <Icon className="size-6 text-neutral-600" />
      </div>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-neutral-500">{desc}</p>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--brand-radius-lg)] bg-white px-4 py-2 text-[12px] font-semibold text-black active:bg-white/80 transition-colors"
      >
        <SearchIcon className="size-3.5" />
        {ctaLabel}
      </Link>
    </div>
  );
}
